/*
    Yuno Gasai. A Discord.JS based bot, with multiple features.
    Copyright (C) 2018 Maeeen <maeeennn@gmail.com>
*/
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const crypto = require("crypto");

// Regex patterns
const DISCORD_INVITE_REGEX = /(https)*(http)*:*(\/\/)*discord(.gg|app.com\/invite)\/[a-zA-Z0-9]{1,}/i;
const LINK_REGEX = /(ftp|http|https):\/\/(www\.)??[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
const IMAGE_LINK_REGEX = /(https?:\/\/(?:www\.)?(?:imgur\.com|i\.imgur\.com|prnt\.sc|prntscr\.com|ibb\.co|i\.ibb\.co|postimg\.cc|i\.postimg\.cc|imgbb\.com|flickr\.com|staticflickr\.com|gyazo\.com|i\.gyazo\.com|tinypic\.com|photobucket\.com|imageshack\.us|pbs\.twimg\.com|media\.discordapp\.net|cdn\.discordapp\.com)\/[^\s]+|https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp|tiff|svg)(?:\?[^\s]*)?)/gi;

// Sliding window base (ms)
const BASE_WINDOW_MS = 5000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Warning trackers
const warnings = {
    spam: new Set(),
    textInNsfw: new Set(),
    imageLink: new Set()
};

// State Maps
const nsfwRepeatState = new Map();
const imageChecksumState = new Map();
const ghostSpamState = new Map(); // New Rule 3 State

let yunoRef = null;

/**
 * State Management Helpers
 */
function getOrCreateState(stateMap, userId) {
    let state = stateMap.get(userId);
    if (!state) {
        state = { history: [], jitter: 0.5 + Math.random() };
        stateMap.set(userId, state);
    }
    return state;
}

function pruneHistory(state) {
    const window = BASE_WINDOW_MS * state.jitter;
    const cutoff = Date.now() - window;
    state.history = state.history.filter(e => (e.ts || e) > cutoff);
    if (state.history.length === 0) {
        state.jitter = 0.5 + Math.random();
    }
}

/**
 * Image Processing & Network Helpers
 */
async function downloadImage(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const len = parseInt(res.headers.get("content-length") || "0", 10);
        if (len > MAX_IMAGE_BYTES) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.length > MAX_IMAGE_BYTES ? null : buf;
    } catch { return null; }
    finally { clearTimeout(timer); }
}

async function processImageChecksums(msg) {
    if (!yunoRef || !msg.member) return;
    const imageAttachments = [...msg.attachments.values()].filter(a => a.contentType?.startsWith("image/"));

    for (const attachment of imageAttachments) {
        const buf = await downloadImage(attachment.url);
        if (!buf) continue;

        const checksum = crypto.createHash("sha256").update(buf).digest("hex");
        const guildId = msg.guild.id;

        if (await yunoRef.dbCommands.isKnownSpamChecksum(yunoRef.database, checksum, guildId)) {
            safeDelete(msg);
            return await banUser(msg.member, "Autobanned: known spam image detected");
        }

        const userId = msg.author.id;
        const state = getOrCreateState(imageChecksumState, userId);
        pruneHistory(state);

        if (state.history.filter(e => e.checksum === checksum).length >= 2) {
            await yunoRef.dbCommands.addSpamChecksum(yunoRef.database, checksum, guildId);
            safeDelete(msg);
            await banUser(msg.member, "Autobanned: repeated image spam detected");
            imageChecksumState.delete(userId);
            return;
        }
        state.history.push({ checksum, ts: Date.now() });
    }
}

/**
 * Moderation Helpers
 */
const safeDelete = (msg) => msg.deletable && msg.delete().catch(() => {});

const banUser = async (member, reason) => {
    try {
        await member.ban({ deleteMessageSeconds: 86400, reason });
        return true;
    } catch { return false; }
};

const handleWarnBan = async (msg, warningSet, { banReason, banDM, warnDM, channelWarn }) => {
    safeDelete(msg);
    if (warningSet.has(msg.author.id)) {
        warningSet.delete(msg.author.id);
        try { await msg.author.send(banDM); } catch {}
        return await banUser(msg.member, banReason);
    }
    warningSet.add(msg.author.id);
    try {
        await msg.author.send(warnDM);
    } catch {
        if (channelWarn) {
            const warningMsg = await msg.channel.send(channelWarn);
            setTimeout(() => safeDelete(warningMsg), 60000);
        }
    }
    return true;
};

/**
 * Spam Rules Definition
 */
const spamRules = [
    {
        name: "discord-invite",
        test: (content) => DISCORD_INVITE_REGEX.test(content),
        action: async (msg) => await banUser(msg.member, "Autobanned for invite link")
    },
    {
        name: "image-link",
        test: (content) => IMAGE_LINK_REGEX.test(content),
        action: async (msg) => await handleWarnBan(msg, warnings.imageLink, {
            banReason: "Autobanned: Image link scam prevention",
            banDM: "Banned for repeatedly posting image links.",
            warnDM: "**Rule 2:** Post content as separate messages, not links. Final warning.",
            channelWarn: `<@${msg.author.id}> Please don't post image links. Final warning.`
        })
    },
    {
        name: "nsfw-text-only",
        test: (content, msg) => {
            if (!msg.channel.name.toLowerCase().startsWith("nsfw_")) return false;
            return !content.toLowerCase().includes("http") && !LINK_REGEX.test(content) && !msg.attachments.first();
        },
        action: async (msg) => await handleWarnBan(msg, warnings.textInNsfw, {
            banReason: "Autobanned: Text in NSFW channel",
            banDM: "Banned for text-only posts in NSFW channels.",
            warnDM: "Rule 8: Only links/media allowed in NSFW channels. Use main chat for comments."
        })
    },
    {
        name: "nsfw-repeat-text-media",
        test: (content, msg) => {
            if (!msg.channel.name.toLowerCase().startsWith("nsfw_")) return false;
            return content.toLowerCase().includes("http") || msg.attachments.size > 0;
        },
        action: async (msg, content) => {
            const state = getOrCreateState(nsfwRepeatState, msg.author.id);
            pruneHistory(state);
            const text = content.trim().toLowerCase();
            if (state.history.filter(e => e.text === text).length >= 2) {
                safeDelete(msg);
                await banUser(msg.member, "Autobanned: repeated media spam in nsfw");
                nsfwRepeatState.delete(msg.author.id);
            } else {
                state.history.push({ text, ts: Date.now() });
            }
        }
    },
    {
        name: "mass-mention",
        test: (content) => content.includes("@everyone") || content.includes("@here"),
        action: async (msg) => await banUser(msg.member, "Autobanned: @everyone/@here mention")
    },
    {
        name: "main-channel-links",
        test: (content, msg) => msg.channel.name.toLowerCase().startsWith("main") && LINK_REGEX.test(content),
        action: async (msg) => await handleWarnBan(msg, warnings.spam, {
            banReason: "Autobanned: Link spam",
            banDM: "Banned for sending links in main.",
            warnDM: "Links are not allowed in main. Final warning."
        })
    },
    {
        name: "message-spam",
        test: (content, msg) => {
            if (!msg.channel.name.toLowerCase().startsWith("main")) return false;
            const recent = Array.from(msg.channel.messages.cache.values()).slice(-4);
            return recent.length === 4 && recent.every(m => m.author.id === msg.author.id);
        },
        action: async (msg) => await handleWarnBan(msg, warnings.spam, {
            banReason: "Autobanned: Message limit",
            banDM: "Banned for sending 4+ consecutive messages.",
            warnDM: "Please keep messages under 4 in a row. Final warning."
        })
    },
    {
        name: "image-checksum",
        test: (content, msg) => msg.attachments.size > 0 && [...msg.attachments.values()].some(a => a.contentType?.startsWith("image/")),
        action: (msg) => processImageChecksums(msg).catch(() => {})
    }
];

/**
 * EXPORTS
 */
module.exports.id = "447665600135823361";

module.exports.message = async function(content, msg) {
    if (!msg.guild || msg.author.bot) return;

    // Permissions check
    if (msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    for (const rule of spamRules) {
        if (rule.test(content, msg)) {
            await rule.action(msg, content);
            return;
        }
    }
};

module.exports.messageDelete = async function(msg) {
    if (!msg.author || msg.author.bot || !msg.guild || !msg.member) return;
    if (msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    const now = Date.now();
    // Ghost spam: Delete within 1.5s of sending
    if (now - msg.createdTimestamp > 1500) return;

    const state = getOrCreateState(ghostSpamState, msg.author.id);
    pruneHistory(state);

    state.history.push(now);

    if (state.history.length >= 3) {
        await msg.member.ban({
            deleteMessageSeconds: 604800,
            reason: `Autobanned: Ghost-spamming detected (${state.history.length} rapid deletes)`
        });
        ghostSpamState.delete(msg.author.id);
    }
};

module.exports.discordConnected = function(Yuno) {
    yunoRef = Yuno;
};

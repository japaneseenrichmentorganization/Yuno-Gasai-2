/*
    Yuno Gasai. A Discord.JS based bot, with multiple features.
    Copyright (C) 2018 Maeeen <maeeennn@gmail.com>
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see https://www.gnu.org/licenses/.
*/

const { PermissionsBitField } = require("discord.js");
const crypto = require("crypto");

// Regex patterns
const DISCORD_INVITE_REGEX = /(https)*(http)*:*(\/\/)*discord(.gg|app.com\/invite)\/[a-zA-Z0-9]{1,}/i;
const LINK_REGEX = /(ftp|http|https):\/\/(www\.)??[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
const IMAGE_LINK_REGEX = /(https?:\/\/(?:www\.)?(?:imgur\.com|i\.imgur\.com|prnt\.sc|prntscr\.com|ibb\.co|i\.ibb\.co|postimg\.cc|i\.postimg\.cc|imgbb\.com|flickr\.com|staticflickr\.com|gyazo\.com|i\.gyazo\.com|tinypic\.com|photobucket\.com|imageshack\.us|pbs\.twimg\.com|media\.discordapp\.net|cdn\.discordapp\.com)\/[^\s]+|https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp|tiff|svg)(?:\?[^\s]*)?)/gi;

// Warning trackers
const warnings = {
    spam: new Set(),
    textInNsfw: new Set(),
    imageLink: new Set()
};

// Sliding window base (ms) — both rules share this
const BASE_WINDOW_MS = 5000;

// Rule 1: per-user nsfw repeat-text tracking
// userId -> { history: [{text: string, ts: number}], jitter: number }
const nsfwRepeatState = new Map();

// Rule 2: per-user image checksum tracking
// userId -> { history: [{checksum: string, ts: number}], jitter: number }
const imageChecksumState = new Map();

// Yuno reference (set by discordConnected export)
let yunoRef = null;

/**
 * Get or create per-user sliding window state.
 * Jitter is randomized per burst (re-randomized when history is empty after prune).
 */
function getOrCreateState(stateMap, userId) {
    let state = stateMap.get(userId);
    if (!state) {
        state = { history: [], jitter: 0.5 + Math.random() };
        stateMap.set(userId, state);
    }
    return state;
}

/**
 * Prune entries older than the effective window.
 * Re-randomizes jitter if history empties (new burst will have a different window).
 */
function pruneHistory(state) {
    const window = BASE_WINDOW_MS * state.jitter;
    const cutoff = Date.now() - window;
    state.history = state.history.filter(e => e.ts > cutoff);
    if (state.history.length === 0) {
        state.jitter = 0.5 + Math.random();
    }
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB (current non-Nitro Discord upload limit)

/**
 * Download an image URL into a Buffer.
 * Returns null on error, timeout, or if the file exceeds MAX_IMAGE_BYTES.
 */
async function downloadImage(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000); // 10s timeout
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const len = parseInt(res.headers.get("content-length") || "0", 10);
        if (len > MAX_IMAGE_BYTES) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_IMAGE_BYTES) return null;
        return buf;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Non-blocking image checksum processor.
 * Called fire-and-forget from the image-checksum rule action.
 */
async function processImageChecksums(msg) {
    if (!yunoRef || !msg.member) return;

    const imageAttachments = [...msg.attachments.values()].filter(
        a => a.contentType?.startsWith("image/")
    );

    for (const attachment of imageAttachments) {
        const buf = await downloadImage(attachment.url);
        if (!buf) continue;

        const checksum = crypto.createHash("sha256").update(buf).digest("hex");
        const guildId = msg.guild.id;

        // Fast path: known spam checksum in DB
        const isKnown = await yunoRef.dbCommands.isKnownSpamChecksum(
            yunoRef.database, checksum, guildId
        );
        if (isKnown) {
            safeDelete(msg);
            await banUser(msg.member, "Autobanned: known spam image detected");
            return;
        }

        // Accumulation path: rolling window
        const userId = msg.author.id;
        const state = getOrCreateState(imageChecksumState, userId);
        pruneHistory(state);

        const matching = state.history.filter(e => e.checksum === checksum);

        if (matching.length >= 2) {
            // 3rd match — store checksum, delete triggering message, ban
            // (ban with deleteMessageSeconds:86400 cleans up prior messages server-side)
            await yunoRef.dbCommands.addSpamChecksum(yunoRef.database, checksum, guildId);
            safeDelete(msg);
            await banUser(msg.member, "Autobanned: repeated image spam detected");
            imageChecksumState.delete(userId);
            return;
        }

        state.history.push({ checksum, ts: Date.now() });
    }
}

// Ban configuration
const BAN_CONFIG = {
    deleteMessageSeconds: 86400
};

// Helper: Safe delete message
const safeDelete = (msg) => msg.deletable && msg.delete().catch(() => {});

// Helper: Safe DM user
const safeDM = async (user, message) => {
    try {
        await user.send(message);
        return true;
    } catch {
        return false;
    }
};

// Helper: Ban user with reason
const banUser = async (member, reason) => {
    try {
        await member.ban({ ...BAN_CONFIG, reason });
        return true;
    } catch {
        return false;
    }
};

// Helper: Handle warn-then-ban pattern
const handleWarnBan = async (msg, warningSet, { banReason, banDM, warnDM, channelWarn }) => {
    safeDelete(msg);

    if (warningSet.has(msg.author.id)) {
        warningSet.delete(msg.author.id);
        await safeDM(msg.author, banDM);
        await banUser(msg.member, banReason);
        return true;
    }

    warningSet.add(msg.author.id);
    const dmSent = await safeDM(msg.author, warnDM);

    if (!dmSent && channelWarn) {
        const warningMsg = await msg.channel.send(channelWarn);
        setTimeout(() => safeDelete(warningMsg), 60000);
    }

    return true;
};

// Spam rule handlers - order matters, first match wins
const spamRules = [
    // Discord invite links - immediate ban
    {
        name: "discord-invite",
        test: (content) => DISCORD_INVITE_REGEX.test(content),
        action: async (msg) => {
            await banUser(msg.member, "Autobanned for invite link");
        }
    },

    // Image links - warn then ban (scam prevention)
    {
        name: "image-link",
        test: (content) => IMAGE_LINK_REGEX.test(content),
        action: async (msg) => {
            await handleWarnBan(msg, warnings.imageLink, {
                banReason: "Autobanned for posting image links after warning (scam prevention)",
                banDM: "You have been banned for repeatedly posting image links after being warned.",
                warnDM: "**Rule 2:** Please post in appropriate channels. When posting content post it as separate messages. Also do not post discord links to content.\n\nThis is your only warning - if you do it again, you will be automatically banned.",
                channelWarn: `<@${msg.author.id}> **Rule 2:** Please post in appropriate channels. When posting content post it as separate messages. Also do not post discord links to content.\n\nThis is your only warning - if you do it again, you will be automatically banned.`
            });
        }
    },

    // NSFW channels - text only not allowed (links/attachments required)
    {
        name: "nsfw-text-only",
        test: (content, msg) => {
            const channelName = msg.channel.name.toLowerCase();
            if (!channelName.startsWith("nsfw_")) return false;

            // Allow if has link or attachment
            const hasLink = content.toLowerCase().includes("http") || LINK_REGEX.test(content);
            const hasAttachment = !!msg.attachments.first();
            return !hasLink && !hasAttachment;
        },
        action: async (msg) => {
            await handleWarnBan(msg, warnings.textInNsfw, {
                banReason: "Autobanned messages hentai channel",
                banDM: "You have been banned for repeatedly posting text in NSFW channels.",
                warnDM: "8. Text other than links is not allowed in hentai channels. If you wish to comment on something in a hentai channel, #media or #meme-machine do so in main chat and reference the channel youre commenting on. This is to prevent unnecessary clutter so people can easily see the content posted in the channels."
            });
        }
    },

    // NSFW channels - same text+media posted rapidly = spam bot
    {
        name: "nsfw-repeat-text-media",
        test: (content, msg) => {
            const channelName = msg.channel.name.toLowerCase();
            if (!channelName.startsWith("nsfw_")) return false;
            // Must have a link or attachment (pure-text is handled by nsfw-text-only above)
            const hasLink = content.toLowerCase().includes("http");
            const hasAttachment = msg.attachments.size > 0;
            return hasLink || hasAttachment;
        },
        action: async (msg, content) => {
            const userId = msg.author.id;
            const text = content.trim().toLowerCase();

            const state = getOrCreateState(nsfwRepeatState, userId);
            pruneHistory(state);

            const matchCount = state.history.filter(e => e.text === text).length;

            if (matchCount >= 2) {
                // 3rd repetition (2 prior + current) — ban
                safeDelete(msg);
                await banUser(msg.member, "Autobanned: repeated text+media spam in nsfw channels");
                nsfwRepeatState.delete(userId);
                return;
            }

            state.history.push({ text, ts: Date.now() });
        }
    },

    // @everyone/@here mentions - immediate ban
    {
        name: "mass-mention",
        test: (content) => content.includes("@everyone") || content.includes("@here"),
        action: async (msg) => {
            await banUser(msg.member, "Autobanned by spam filter: usage of @everyone/@here");
        }
    },

    // Links in main channel - warn then ban
    {
        name: "main-channel-links",
        test: (content, msg) => {
            const isMainChannel = msg.channel.name.toLowerCase().startsWith("main");
            return isMainChannel && LINK_REGEX.test(content);
        },
        action: async (msg) => {
            await handleWarnBan(msg, warnings.spam, {
                banReason: "Autobanned for sending links",
                banDM: "You have been banned for repeatedly sending links after being warned.",
                warnDM: "Please do not send links. This is your one and only warning.\nFailure to comply will result in a ban."
            });
        }
    },

    // Message spam in main channel (4+ consecutive messages)
    {
        name: "message-spam",
        test: (content, msg) => {
            const isMainChannel = msg.channel.name.toLowerCase().startsWith("main");
            if (!isMainChannel) return false;

            const recentMessages = Array.from(msg.channel.messages.cache.values()).slice(-4);
            return recentMessages.length === 4 &&
                   recentMessages.every(m => m.author.id === msg.author.id);
        },
        action: async (msg) => {
            await handleWarnBan(msg, warnings.spam, {
                banReason: "Autobanned message limit",
                banDM: "You have been banned for message spam after being warned.",
                warnDM: "Please keep your messages under 4 messages long. This is your one and only warning.\nFailure to comply will result in a ban."
            });
        }
    },

    // Cross-channel rapid image spam - checksum-based detection
    {
        name: "image-checksum",
        test: (content, msg) => {
            return msg.attachments.size > 0 &&
                [...msg.attachments.values()].some(a => a.contentType?.startsWith("image/"));
        },
        action: (msg) => {
            // Non-blocking: heavy async work runs in background, message pipeline unblocked
            processImageChecksums(msg).catch(e =>
                console.error("[image-checksum]", e.message)
            );
        }
    }
];

module.exports.id = "447665600135823361";

module.exports.message = async function(content, msg) {
    // Ensure member is cached
    if (msg.guild && !msg.guild.members.cache.has(msg.author.id) && !msg.webhookID) {
        try {
            msg.member = await msg.guild.members.fetch(msg.author.id);
        } catch {
            return; // User not in guild
        }
    }

    // Ensure bot is cached
    if (msg.guild && !msg.guild.members.cache.has(msg.client.user.id)) {
        try {
            await msg.guild.members.fetch(msg.client.user.id);
        } catch {
            // Bot not in cache, continue anyway
        }
    }

    // Skip users with ManageMessages permission
    if (msg.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    // Run through spam rules - first match wins
    for (const rule of spamRules) {
        if (rule.test(content, msg)) {
            await rule.action(msg, content);
            return;
        }
    }
};

module.exports.discordConnected = function(Yuno) {
    yunoRef = Yuno;
};

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

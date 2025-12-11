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

module.exports.modulename = "dm-handler";

const { EmbedBuilder } = require("discord.js");

let DISCORD_EVENTED = false,
    discClient = null,
    yunoInstance = null,
    messageHandler = null;

// Rate limit tracking for DM forwarding
const rateLimitState = new Map();

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

/**
 * Truncate content if too long
 */
function truncate(str, maxLen = 1024) {
    if (!str) return "";
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + "...";
}

/**
 * Create embed for forwarded DM
 * @param {User} user - The user who sent the DM
 * @param {Message} message - The DM message
 * @param {number} inboxId - The inbox ID
 * @param {boolean} isMasterServer - Whether this is being sent to the master server
 * @param {Guild} sourceGuild - The guild context (for non-master servers)
 */
function createDmEmbed(user, message, inboxId, isMasterServer = false, sourceGuild = null) {
    const embed = new EmbedBuilder()
        .setAuthor({
            name: user.tag,
            iconURL: user.displayAvatarURL({ size: 64 })
        })
        .setDescription(truncate(message.content) || "*No text content*")
        .setColor(0x5865F2)
        .setTimestamp();

    // Footer shows different info based on context
    let footerText = `User ID: ${user.id} | Inbox #${inboxId}`;
    if (isMasterServer) {
        footerText += " | Master Server";
    } else if (sourceGuild) {
        footerText += ` | Member of: ${sourceGuild.name}`;
    }
    embed.setFooter({ text: footerText });

    // Add attachments field if present
    if (message.attachments.size > 0) {
        const attachmentList = message.attachments
            .map(a => `[${a.name}](${a.url})`)
            .join("\n");
        embed.addFields({
            name: "Attachments",
            value: truncate(attachmentList, 1024)
        });

        // Set first image as thumbnail if it's an image
        const firstImage = message.attachments.find(a =>
            a.contentType?.startsWith("image/")
        );
        if (firstImage) {
            embed.setThumbnail(firstImage.url);
        }
    }

    return embed;
}

/**
 * Forward a DM to a channel
 * @param {TextChannel} channel - The channel to forward to
 * @param {User} user - The user who sent the DM
 * @param {Message} message - The DM message
 * @param {number} inboxId - The inbox ID
 * @param {boolean} isMasterServer - Whether this is the master server
 * @param {Guild} sourceGuild - The guild context (for non-master servers)
 */
async function forwardToChannel(channel, user, message, inboxId, isMasterServer = false, sourceGuild = null) {
    // Check rate limit
    const rateLimit = rateLimitState.get(channel.id);
    if (rateLimit && Date.now() < rateLimit.retryAfter) {
        return false;
    }

    try {
        const embed = createDmEmbed(user, message, inboxId, isMasterServer, sourceGuild);
        await channel.send({ embeds: [embed] });
        rateLimitState.delete(channel.id);
        return true;
    } catch (e) {
        if (e.status === 429 || e.code === 429 || e.message?.includes("rate limit")) {
            const retryAfter = e.retryAfter || e.retry_after || 10000;
            rateLimitState.set(channel.id, {
                retryAfter: Date.now() + retryAfter
            });
        }
        return false;
    }
}

/**
 * Handle incoming DM
 */
async function onMessage(message) {
    // Ignore messages from guilds (only handle DMs)
    if (message.guild) return;

    // Ignore messages from bots
    if (message.author.bot) return;

    const user = message.author;

    try {
        // Check if user is bot-banned
        const banStatus = await yunoInstance.dbCommands.isBotBanned(
            yunoInstance.database,
            user.id,
            null
        );

        if (banStatus.banned) {
            // Silently ignore DMs from banned users
            return;
        }

        // Save to inbox
        const attachments = message.attachments.map(a => a.url);
        const inboxId = await yunoInstance.dbCommands.saveDm(
            yunoInstance.database,
            user.id,
            user.tag,
            message.content,
            attachments
        );

        // Get master server ID from config
        const masterServer = yunoInstance.configManager.getValue("masterServer");

        // Get all DM configs
        const dmConfigs = await yunoInstance.dbCommands.getAllDmConfigs(yunoInstance.database);

        // Forward to configured channels
        for (const config of dmConfigs) {
            const guild = discClient.guilds.cache.get(config.guildId);
            if (!guild) continue;

            const channel = guild.channels.cache.get(config.channelId);
            if (!channel) continue;

            // Check if this is master server (receives ALL DMs)
            const isMasterServer = config.guildId === masterServer;

            if (isMasterServer) {
                // Master server receives ALL DMs from anyone
                await forwardToChannel(channel, user, message, inboxId, true, null);
            } else {
                // Other servers only receive DMs from their own members
                const member = guild.members.cache.get(user.id);
                if (member) {
                    await forwardToChannel(channel, user, message, inboxId, false, guild);
                }
            }
        }

        // Log to terminal
        yunoInstance.prompt.info(`[DM] ${user.tag} (${user.id}): ${truncate(message.content, 100)}`);

    } catch (e) {
        yunoInstance.prompt.error(`[DM Handler] Error processing DM: ${e.message}`);
    }
}

let discordConnected = async function(Yuno) {
    discClient = Yuno.dC;
    yunoInstance = Yuno;

    if (!DISCORD_EVENTED) {
        messageHandler = onMessage;
        discClient.on("messageCreate", messageHandler);
    }

    DISCORD_EVENTED = true;

    // Clean up old DMs periodically (every 24 hours)
    setInterval(async () => {
        try {
            const deleted = await yunoInstance.dbCommands.clearOldDms(
                yunoInstance.database,
                30 // Keep DMs for 30 days
            );
            if (deleted > 0) {
                yunoInstance.prompt.info(`[DM Handler] Cleaned up ${deleted} old DM(s)`);
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }, 24 * 60 * 60 * 1000);
};

module.exports.init = function(Yuno, hotReloaded) {
    if (hotReloaded)
        discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected);
};

module.exports.configLoaded = function() {};

module.exports.beforeShutdown = async function(Yuno) {
    rateLimitState.clear();

    if (discClient && messageHandler) {
        discClient.removeListener("messageCreate", messageHandler);
    }

    DISCORD_EVENTED = false;
    messageHandler = null;
};

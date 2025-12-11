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

const { ChannelType, PermissionsBitField } = require("discord.js");

// Track active watch sessions
const activeWatches = new Map();

/**
 * Find a channel across all guilds
 */
function findChannel(client, channelId) {
    for (const guild of client.guilds.cache.values()) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) return channel;
    }
    return null;
}

/**
 * Format a message for real-time display
 */
function formatMessage(msg) {
    const time = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });

    const author = msg.author.tag;
    const content = msg.content || "";

    // Truncate long messages
    const maxLen = 150;
    const truncatedContent = content.length > maxLen
        ? content.substring(0, maxLen) + "..."
        : content;

    // Handle attachments
    const attachments = msg.attachments.size > 0
        ? ` [${msg.attachments.size} file(s)]`
        : "";

    // Handle embeds
    const embeds = msg.embeds.length > 0
        ? ` [embed]`
        : "";

    return `[${time}] ${author}: ${truncatedContent}${attachments}${embeds}`;
}

module.exports.runTerminal = async function(yuno, args, rawInput, rl) {
    if (args.length < 1) {
        // Show status if no args
        if (activeWatches.size > 0) {
            console.log("\n=== Active Watches ===\n");
            for (const [channelId, info] of activeWatches) {
                console.log(`#${info.channelName} [${channelId}] in ${info.guildName}`);
            }
            console.log("\nUse 'watch stop <channel-id>' to stop watching.");
            console.log("Use 'watch stop all' to stop all watches.");
        } else {
            console.log("Usage: watch <channel-id>");
            console.log("       watch stop <channel-id|all>");
            console.log("");
            console.log("Start real-time message streaming from a channel.");
            console.log("Messages will appear as they are sent.");
            console.log("");
            console.log("Examples:");
            console.log("  watch 123456789012345678");
            console.log("  watch stop 123456789012345678");
            console.log("  watch stop all");
        }
        return;
    }

    // Handle stop command
    if (args[0].toLowerCase() === "stop") {
        const target = args[1];

        if (!target) {
            console.log("Usage: watch stop <channel-id|all>");
            return;
        }

        if (target.toLowerCase() === "all") {
            const count = activeWatches.size;
            for (const [channelId, info] of activeWatches) {
                yuno.dC.removeListener("messageCreate", info.handler);
            }
            activeWatches.clear();
            console.log(`Stopped watching ${count} channel(s).`);
            return;
        }

        const watchInfo = activeWatches.get(target);
        if (!watchInfo) {
            console.log(`Not watching channel: ${target}`);
            return;
        }

        yuno.dC.removeListener("messageCreate", watchInfo.handler);
        activeWatches.delete(target);
        console.log(`Stopped watching #${watchInfo.channelName}`);
        return;
    }

    const channelId = args[0];
    if (!/^\d{17,19}$/.test(channelId)) {
        console.log("Error: Invalid channel ID format.");
        return;
    }

    // Check if already watching
    if (activeWatches.has(channelId)) {
        console.log("Already watching this channel.");
        console.log("Use 'watch stop " + channelId + "' to stop.");
        return;
    }

    const channel = findChannel(yuno.dC, channelId);
    if (!channel) {
        console.log(`Error: Channel not found: ${channelId}`);
        return;
    }

    // Check if it's a text-based channel
    if (channel.type !== ChannelType.GuildText &&
        channel.type !== ChannelType.GuildAnnouncement &&
        channel.type !== ChannelType.PublicThread &&
        channel.type !== ChannelType.PrivateThread &&
        channel.type !== ChannelType.AnnouncementThread) {
        console.log("Error: Cannot watch this channel type.");
        return;
    }

    // Check permissions
    const botMember = channel.guild.members.cache.get(yuno.dC.user.id);
    if (!channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ViewChannel)) {
        console.log("Error: Bot does not have permission to view this channel.");
        return;
    }

    // Create message handler
    const handler = (message) => {
        if (message.channel.id === channelId) {
            console.log(formatMessage(message));
        }
    };

    // Register handler
    yuno.dC.on("messageCreate", handler);

    // Store watch info
    activeWatches.set(channelId, {
        handler,
        channelName: channel.name,
        guildName: channel.guild.name,
        startTime: Date.now()
    });

    console.log(`\n=== Now watching #${channel.name} in ${channel.guild.name} ===`);
    console.log(`Messages will appear in real-time.`);
    console.log(`Use 'watch stop ${channelId}' to stop watching.\n`);
}

// Cleanup function for module shutdown
module.exports.cleanup = function(yuno) {
    for (const [channelId, info] of activeWatches) {
        yuno.dC.removeListener("messageCreate", info.handler);
    }
    activeWatches.clear();
}

module.exports.about = {
    "command": "watch",
    "description": "Real-time message streaming from a Discord channel.",
    "usage": "watch <channel-id> | watch stop <channel-id|all>",
    "examples": [
        "watch 123456789012345678",
        "watch stop 123456789012345678",
        "watch stop all"
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["stream", "listen"]
}

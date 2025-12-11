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
 * Format a message for display
 */
function formatMessage(msg) {
    const time = msg.createdAt.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
    const date = msg.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    });

    const author = msg.author.tag;
    const content = msg.content || "";

    // Truncate long messages
    const maxLen = 200;
    const truncatedContent = content.length > maxLen
        ? content.substring(0, maxLen) + "..."
        : content;

    // Handle attachments
    const attachments = msg.attachments.size > 0
        ? ` [${msg.attachments.size} attachment(s)]`
        : "";

    // Handle embeds
    const embeds = msg.embeds.length > 0
        ? ` [${msg.embeds.length} embed(s)]`
        : "";

    // Handle replies
    const reply = msg.reference
        ? " (reply)"
        : "";

    return `[${date} ${time}] ${author}${reply}: ${truncatedContent}${attachments}${embeds}`;
}

module.exports.runTerminal = async function(yuno, args) {
    if (args.length < 1) {
        console.log("Usage: messages <channel-id> [count]");
        console.log("");
        console.log("Fetches the last N messages from a channel (default: 20)");
        console.log("");
        console.log("Examples:");
        console.log("  messages 123456789012345678");
        console.log("  messages 123456789012345678 50");
        return;
    }

    const channelId = args[0];
    if (!/^\d{17,19}$/.test(channelId)) {
        console.log("Error: Invalid channel ID format.");
        return;
    }

    const count = Math.min(Math.max(parseInt(args[1]) || 20, 1), 100);

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
        console.log("Error: Cannot read messages from this channel type.");
        return;
    }

    // Check permissions
    const botMember = channel.guild.members.cache.get(yuno.dC.user.id);
    if (!channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ViewChannel)) {
        console.log("Error: Bot does not have permission to view this channel.");
        return;
    }
    if (!channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ReadMessageHistory)) {
        console.log("Error: Bot does not have permission to read message history.");
        return;
    }

    console.log(`Fetching last ${count} messages from #${channel.name}...`);

    try {
        const messages = await channel.messages.fetch({ limit: count });

        if (messages.size === 0) {
            console.log("No messages found in this channel.");
            return;
        }

        console.log(`\n=== #${channel.name} in ${channel.guild.name} ===\n`);

        // Sort by timestamp (oldest first)
        const sorted = [...messages.values()].sort((a, b) =>
            a.createdTimestamp - b.createdTimestamp
        );

        for (const msg of sorted) {
            console.log(formatMessage(msg));
        }

        console.log(`\n--- ${messages.size} message(s) ---`);
    } catch (e) {
        console.log(`Error fetching messages: ${e.message}`);
    }
}

module.exports.about = {
    "command": "messages",
    "description": "Fetch message history from a Discord channel.",
    "usage": "messages <channel-id> [count]",
    "examples": [
        "messages 123456789012345678",
        "messages 123456789012345678 50"
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["history", "msgs"]
}

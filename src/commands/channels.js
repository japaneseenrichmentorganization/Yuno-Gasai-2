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

const CHANNEL_TYPE_NAMES = {
    [ChannelType.GuildText]: "text",
    [ChannelType.GuildVoice]: "voice",
    [ChannelType.GuildCategory]: "category",
    [ChannelType.GuildAnnouncement]: "announcement",
    [ChannelType.AnnouncementThread]: "announcement-thread",
    [ChannelType.PublicThread]: "thread",
    [ChannelType.PrivateThread]: "private-thread",
    [ChannelType.GuildStageVoice]: "stage",
    [ChannelType.GuildForum]: "forum",
    [ChannelType.GuildMedia]: "media"
};

const CHANNEL_ICONS = {
    [ChannelType.GuildText]: "#",
    [ChannelType.GuildVoice]: "V",
    [ChannelType.GuildCategory]: "=",
    [ChannelType.GuildAnnouncement]: "!",
    [ChannelType.AnnouncementThread]: "t",
    [ChannelType.PublicThread]: "t",
    [ChannelType.PrivateThread]: "t",
    [ChannelType.GuildStageVoice]: "S",
    [ChannelType.GuildForum]: "F",
    [ChannelType.GuildMedia]: "M"
};

/**
 * Find a guild by ID or name (partial match)
 */
function findGuild(client, query) {
    // Try by ID first
    const byId = client.guilds.cache.get(query);
    if (byId) return byId;

    // Try by exact name
    const byExactName = client.guilds.cache.find(
        g => g.name.toLowerCase() === query.toLowerCase()
    );
    if (byExactName) return byExactName;

    // Try by partial name
    const byPartialName = client.guilds.cache.find(
        g => g.name.toLowerCase().includes(query.toLowerCase())
    );
    return byPartialName || null;
}

module.exports.runTerminal = async function(yuno, args) {
    if (args.length < 1) {
        console.log("Usage: channels <server-id|server-name>");
        console.log("");
        console.log("Examples:");
        console.log("  channels 123456789012345678");
        console.log("  channels \"My Server\"");
        console.log("  channels MyServer");
        return;
    }

    const query = args.join(" ");
    const guild = findGuild(yuno.dC, query);

    if (!guild) {
        console.log(`Error: Server not found: ${query}`);
        console.log("Use 'servers' command to see all available servers.");
        return;
    }

    const botMember = guild.members.cache.get(yuno.dC.user.id);

    console.log(`\n=== Channels in "${guild.name}" ===\n`);

    // Get all channels and organize by category
    const channels = guild.channels.cache;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory);
    const uncategorized = channels.filter(c =>
        c.type !== ChannelType.GuildCategory && !c.parentId
    );

    // Print uncategorized channels first
    if (uncategorized.size > 0) {
        console.log("= (No Category) =");
        printChannels(uncategorized, botMember);
        console.log("");
    }

    // Print each category with its channels
    const sortedCategories = [...categories.values()].sort((a, b) => a.position - b.position);

    for (const category of sortedCategories) {
        const categoryChannels = channels.filter(c => c.parentId === category.id);
        console.log(`= ${category.name.toUpperCase()} =`);
        printChannels(categoryChannels, botMember);
        console.log("");
    }

    // Summary
    const textCount = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceCount = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const categoryCount = categories.size;
    const otherCount = channels.size - textCount - voiceCount - categoryCount;

    console.log(`--- Summary ---`);
    console.log(`Text: ${textCount} | Voice: ${voiceCount} | Categories: ${categoryCount} | Other: ${otherCount}`);
    console.log(`Total: ${channels.size} channels`);
}

function printChannels(channels, botMember) {
    const sorted = [...channels.values()]
        .filter(c => c.type !== ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position);

    for (const channel of sorted) {
        const icon = CHANNEL_ICONS[channel.type] || "?";
        const typeName = CHANNEL_TYPE_NAMES[channel.type] || "unknown";

        // Check bot permissions
        let perms = "";
        if (botMember) {
            const canSend = channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.SendMessages);
            const canView = channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ViewChannel);

            if (channel.type === ChannelType.GuildText ||
                channel.type === ChannelType.GuildAnnouncement ||
                channel.type === ChannelType.GuildForum) {
                perms = ` - View: ${canView ? "Y" : "N"} Send: ${canSend ? "Y" : "N"}`;
            }
        }

        // Truncate ID for display
        const shortId = channel.id.slice(0, 8) + "...";

        console.log(`   [${icon}] ${channel.name} [${shortId}] (${typeName})${perms}`);
    }
}

module.exports.about = {
    "command": "channels",
    "description": "List all channels in a server with hierarchy and permissions.",
    "usage": "channels <server-id|server-name>",
    "examples": [
        "channels 123456789012345678",
        "channels \"My Server\""
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["channellist", "chs"]
}

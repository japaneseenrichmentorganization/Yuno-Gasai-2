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

const { EmbedBuilder } = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    const dmConfig = await yuno.dbCommands.getDmConfig(yuno.database, msg.guild.id);
    const masterServer = yuno.configManager.getValue("masterServer");
    const isMaster = msg.guild.id === masterServer;
    const unreadCount = await yuno.dbCommands.getUnreadDmCount(yuno.database);

    const embed = new EmbedBuilder()
        .setTitle("DM Forwarding Status")
        .setColor(dmConfig ? 0x00ff00 : 0xff0000)
        .setTimestamp();

    if (!dmConfig) {
        embed.setDescription(":x: DM forwarding is **not configured** for this server.\n\nUse `set-dm-channel #channel` to enable.");
    } else {
        const channel = msg.guild.channels.cache.get(dmConfig.channelId);
        const channelDisplay = channel ? `<#${channel.id}>` : `*Unknown (${dmConfig.channelId})*`;

        let description = `:white_check_mark: DM forwarding is **enabled**.\n\n`;
        description += `**Channel:** ${channelDisplay}\n`;
        description += `**Status:** ${dmConfig.enabled ? "Active" : "Disabled"}\n`;

        if (isMaster) {
            description += `\n:star: **Master Server** - All DMs are forwarded here.`;
        } else {
            description += `\nOnly DMs from this server's members are forwarded.`;
        }

        embed.setDescription(description);
    }

    embed.addFields({
        name: "Inbox Status",
        value: `**${unreadCount}** unread DM(s) in the inbox.\n\nUse the terminal \`inbox\` command to view.`,
        inline: false
    });

    if (isMaster) {
        embed.setFooter({ text: "Master Server" });
    }

    msg.channel.send({ embeds: [embed] });
}

module.exports.about = {
    "command": "dm-status",
    "description": "View DM forwarding configuration for this server.",
    "usage": "dm-status",
    "examples": ["dm-status"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["dmstatus", "dm-config"]
}

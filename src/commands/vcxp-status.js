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
    const config = await yuno.dbCommands.getVcXpConfig(yuno.database, msg.guild.id);
    const sessions = await yuno.dbCommands.getGuildVcSessions(yuno.database, msg.guild.id);

    const embed = new EmbedBuilder()
        .setTitle("Voice Channel XP Configuration")
        .setColor(config.enabled ? 0x00ff00 : 0xff0000)
        .setTimestamp();

    // Status
    const statusText = config.enabled ? ":white_check_mark: **Enabled**" : ":x: **Disabled**";

    // Calculate XP per hour
    const intervalsPerHour = 3600 / config.intervalSeconds;
    const xpPerHour = Math.floor(intervalsPerHour * config.xpPerInterval);

    embed.addFields(
        { name: "Status", value: statusText, inline: true },
        { name: "XP per Interval", value: `${config.xpPerInterval} XP`, inline: true },
        { name: "Interval", value: `${config.intervalSeconds}s (${Math.floor(config.intervalSeconds / 60)}m)`, inline: true },
        { name: "XP per Hour", value: `~${xpPerHour} XP/hour`, inline: true },
        { name: "Ignore AFK Channel", value: config.ignoreAfkChannel ? "Yes" : "No", inline: true },
        { name: "Active VC Sessions", value: `${sessions.length} users`, inline: true }
    );

    // Show users currently earning XP
    if (sessions.length > 0 && sessions.length <= 10) {
        const now = Date.now();
        const userList = sessions.map(session => {
            const member = msg.guild.members.cache.get(session.oderId);
            const displayName = member ? member.displayName : `User ${session.oderId}`;
            const timeInVc = Math.floor((now - session.joinedAt) / 60000); // minutes
            return `• ${displayName} (${timeInVc}m)`;
        }).join("\n");

        embed.addFields({ name: "Users in Voice", value: userList || "None" });
    } else if (sessions.length > 10) {
        embed.addFields({ name: "Users in Voice", value: `${sessions.length} users currently in voice channels` });
    }

    // AFK channel info
    if (msg.guild.afkChannelId) {
        const afkChannel = msg.guild.channels.cache.get(msg.guild.afkChannelId);
        if (afkChannel) {
            embed.addFields({
                name: "AFK Channel",
                value: `<#${afkChannel.id}> ${config.ignoreAfkChannel ? "(not granting XP)" : "(granting XP)"}`
            });
        }
    }

    msg.channel.send({ embeds: [embed] });
}

module.exports.about = {
    "command": "vcxp-status",
    "description": "View voice channel XP configuration and active sessions.",
    "usage": "vcxp-status",
    "examples": ["vcxp-status"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["voicestatus", "vcstatus"]
}

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

const LOG_TYPE_DESCRIPTIONS = {
    unified: "All logs (fallback)",
    voice: "Voice channel events",
    nickname: "Nickname changes",
    avatar: "Avatar changes",
    presence: "Presence status changes"
};

module.exports.run = async function(yuno, author, args, msg) {
    const logChannels = await yuno.dbCommands.getLogChannels(yuno.database, msg.guild.id);
    const logSettings = await yuno.dbCommands.getLogSettings(yuno.database, msg.guild.id);

    const embed = new EmbedBuilder()
        .setTitle("Activity Logging Configuration")
        .setColor(0x0099ff)
        .setTimestamp();

    if (Object.keys(logChannels).length === 0) {
        embed.setDescription("No log channels configured.\n\nUse `set-logchannel <type> <#channel>` to configure logging.");
    } else {
        let description = "";

        for (const [logType, config] of Object.entries(logChannels)) {
            const channel = msg.guild.channels.cache.get(config.channelId);
            const channelDisplay = channel ? `<#${channel.id}>` : `*Unknown (${config.channelId})*`;
            const status = config.enabled ? ":white_check_mark:" : ":x:";

            description += `**${logType}** - ${LOG_TYPE_DESCRIPTIONS[logType] || "Unknown"}\n`;
            description += `${status} Channel: ${channelDisplay}\n\n`;
        }

        embed.setDescription(description);
    }

    embed.addFields(
        {
            name: "Batching Settings",
            value: `**Flush Interval:** ${logSettings.flushInterval}s\n**Max Buffer:** ${logSettings.maxBufferSize} entries\n\nUse \`set-logsettings\` to configure`,
            inline: true
        },
        {
            name: "Available Log Types",
            value: Object.entries(LOG_TYPE_DESCRIPTIONS)
                .map(([type, desc]) => `\`${type}\` - ${desc}`)
                .join("\n")
        }
    );

    msg.channel.send({ embeds: [embed] });
}

module.exports.about = {
    "command": "log-status",
    "description": "View current activity logging configuration for this guild.",
    "usage": "log-status",
    "examples": ["log-status"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["logstatus", "logs"]
}

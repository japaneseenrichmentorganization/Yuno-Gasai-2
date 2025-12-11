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

const VALID_LOG_TYPES = ["unified", "voice", "nickname", "avatar", "presence"];

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length < 1) {
        return msg.channel.send(`:negative_squared_cross_mark: Not enough arguments.\nUsage: \`set-logchannel <type> <#channel|none>\`\nValid types: ${VALID_LOG_TYPES.join(", ")}`);
    }

    const logType = args[0].toLowerCase();

    if (!VALID_LOG_TYPES.includes(logType)) {
        return msg.channel.send(`:negative_squared_cross_mark: Invalid log type. Valid types: ${VALID_LOG_TYPES.join(", ")}`);
    }

    // If "none" is specified, remove the log channel
    if (args[1] && args[1].toLowerCase() === "none") {
        await yuno.dbCommands.removeLogChannel(yuno.database, msg.guild.id, logType);
        return msg.channel.send(`:white_check_mark: Removed **${logType}** log channel.`);
    }

    // Get the channel from mentions or by ID
    let channel = msg.mentions.channels.first();
    if (!channel && args[1]) {
        // Try to parse as channel ID
        try {
            channel = await msg.guild.channels.fetch(args[1].replace(/[<#>]/g, ""));
        } catch(e) {
            return msg.channel.send(":negative_squared_cross_mark: Invalid channel. Please mention a channel or provide a valid channel ID.");
        }
    }

    if (!channel) {
        return msg.channel.send(":negative_squared_cross_mark: Please specify a channel. Usage: `set-logchannel <type> <#channel|none>`");
    }

    // Verify it's a text channel
    if (!channel.isTextBased()) {
        return msg.channel.send(":negative_squared_cross_mark: The specified channel must be a text channel.");
    }

    // Check if bot can send messages to the channel
    const botMember = msg.guild.members.cache.get(msg.client.user.id);
    if (!channel.permissionsFor(botMember).has("SendMessages")) {
        return msg.channel.send(":negative_squared_cross_mark: I don't have permission to send messages in that channel.");
    }

    // Save the log channel
    await yuno.dbCommands.setLogChannel(yuno.database, msg.guild.id, logType, channel.id);

    const typeDescriptions = {
        unified: "all log types (fallback)",
        voice: "voice channel join/leave/move",
        nickname: "nickname changes",
        avatar: "avatar changes",
        presence: "presence status changes (online/offline/idle/dnd)"
    };

    msg.channel.send(`:white_check_mark: Set **${logType}** log channel to ${channel}.\nThis will log: ${typeDescriptions[logType]}`);
}

module.exports.about = {
    "command": "set-logchannel",
    "description": "Configure logging channels for activity logging (voice, nickname, avatar, presence changes).",
    "usage": "set-logchannel <type> <#channel|none>",
    "examples": [
        "set-logchannel unified #logs",
        "set-logchannel voice #voice-logs",
        "set-logchannel nickname #member-logs",
        "set-logchannel avatar #member-logs",
        "set-logchannel presence #presence-logs",
        "set-logchannel voice none"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["setlog", "slc"],
    "onlyMasterUsers": true
}

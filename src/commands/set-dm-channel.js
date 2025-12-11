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

const { ChannelType } = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length < 1) {
        return msg.channel.send(`:information_source: **DM Forwarding Setup**

This command configures a channel where DMs sent to the bot will be forwarded.

**Usage:**
\`set-dm-channel <#channel>\` - Set the DM forwarding channel
\`set-dm-channel none\` - Disable DM forwarding

**Note:** If this is the master server (configured in config.json), ALL DMs will be forwarded here. Otherwise, only DMs from members of this server will be forwarded.`);
    }

    const input = args[0].toLowerCase();

    // Handle "none" to disable
    if (input === "none" || input === "off" || input === "disable") {
        await yuno.dbCommands.removeDmConfig(yuno.database, msg.guild.id);
        return msg.channel.send(":white_check_mark: DM forwarding has been disabled for this server.");
    }

    // Parse channel mention or ID
    const channelMatch = args[0].match(/^<#(\d+)>$/) || args[0].match(/^(\d{17,19})$/);

    if (!channelMatch) {
        return msg.channel.send(":negative_squared_cross_mark: Please mention a channel or provide a valid channel ID.");
    }

    const channelId = channelMatch[1];
    const channel = msg.guild.channels.cache.get(channelId);

    if (!channel) {
        return msg.channel.send(":negative_squared_cross_mark: Channel not found in this server.");
    }

    // Check if it's a text channel
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        return msg.channel.send(":negative_squared_cross_mark: Please select a text channel.");
    }

    // Check if bot can send messages there
    const botMember = msg.guild.members.cache.get(yuno.dC.user.id);
    if (!channel.permissionsFor(botMember)?.has("SendMessages")) {
        return msg.channel.send(":negative_squared_cross_mark: I don't have permission to send messages in that channel.");
    }

    // Save the configuration
    await yuno.dbCommands.setDmConfig(yuno.database, msg.guild.id, channelId);

    // Check if this is the master server
    const masterServer = yuno.configManager.getValue("masterServer");
    const isMaster = msg.guild.id === masterServer;

    let response = `:white_check_mark: DM forwarding channel set to <#${channelId}>.\n\n`;

    if (isMaster) {
        response += ":star: **This is the master server.** ALL DMs sent to the bot will be forwarded here.";
    } else {
        response += "DMs from members of this server will be forwarded here.";
    }

    msg.channel.send(response);
}

module.exports.about = {
    "command": "set-dm-channel",
    "description": "Configure the channel where DMs to the bot are forwarded.",
    "usage": "set-dm-channel <#channel|none>",
    "examples": [
        "set-dm-channel #bot-dms",
        "set-dm-channel none"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "onlyMasterUsers": true,
    "aliases": ["dmchannel", "dm-channel"]
}

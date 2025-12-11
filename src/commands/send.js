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
    // Search all guilds for the channel
    for (const guild of client.guilds.cache.values()) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) return channel;
    }
    return null;
}

module.exports.runTerminal = async function(yuno, args, rawInput, rl) {
    if (args.length < 1) {
        console.log("Usage: send <channel-id> [message]");
        console.log("");
        console.log("If message is not provided, you can type a multi-line message.");
        console.log("End with an empty line or Ctrl+D.");
        console.log("");
        console.log("Examples:");
        console.log("  send 123456789012345678 Hello world!");
        console.log("  send 123456789012345678");
        return;
    }

    const channelId = args[0];
    if (!/^\d{17,19}$/.test(channelId)) {
        console.log("Error: Invalid channel ID format.");
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
        channel.type !== ChannelType.PrivateThread) {
        console.log("Error: Cannot send messages to this channel type.");
        return;
    }

    // Check permissions
    const botMember = channel.guild.members.cache.get(yuno.dC.user.id);
    if (!channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.SendMessages)) {
        console.log("Error: Bot does not have permission to send messages in this channel.");
        return;
    }

    let message = args.slice(1).join(" ");

    // If no message provided, read multi-line input
    if (!message && rl) {
        console.log("Enter message (end with empty line or Ctrl+D):");
        const lines = [];

        const readLine = () => {
            return new Promise((resolve) => {
                rl.question("", (line) => {
                    resolve(line);
                });
            });
        };

        while (true) {
            try {
                const line = await readLine();
                if (line === "") {
                    break;
                }
                lines.push(line);
            } catch (e) {
                break;
            }
        }

        message = lines.join("\n");
    }

    if (!message) {
        console.log("Error: No message provided.");
        return;
    }

    try {
        await channel.send(message);
        console.log(`Message sent to #${channel.name} in ${channel.guild.name}`);
    } catch (e) {
        console.log(`Error sending message: ${e.message}`);
    }
}

module.exports.about = {
    "command": "send",
    "description": "Send a message to a Discord channel.",
    "usage": "send <channel-id> [message]",
    "examples": [
        "send 123456789012345678 Hello!",
        "send 123456789012345678"
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["msg", "say"]
}

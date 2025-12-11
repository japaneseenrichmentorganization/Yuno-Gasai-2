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

module.exports.runTerminal = async function(yuno, args) {
    if (args.length < 2) {
        console.log("Usage: tban <server-id> <user-id> [reason]");
        console.log("");
        console.log("Ban a user from a server via terminal.");
        console.log("");
        console.log("Examples:");
        console.log("  tban 123456789012345678 987654321098765432");
        console.log("  tban 123456789012345678 987654321098765432 Spamming");
        return;
    }

    const serverId = args[0];
    const userId = args[1];
    const reason = args.slice(2).join(" ") || "Terminal ban";

    if (!/^\d{17,19}$/.test(serverId)) {
        console.log("Error: Invalid server ID format.");
        return;
    }

    if (!/^\d{17,19}$/.test(userId)) {
        console.log("Error: Invalid user ID format.");
        return;
    }

    const guild = yuno.dC.guilds.cache.get(serverId);
    if (!guild) {
        console.log(`Error: Server not found: ${serverId}`);
        console.log("Use 'servers' command to see available servers.");
        return;
    }

    // Check if bot has ban permission
    const botMember = guild.members.cache.get(yuno.dC.user.id);
    if (!botMember?.permissions.has("BanMembers")) {
        console.log("Error: Bot does not have ban permission in this server.");
        return;
    }

    // Try to get user info
    let userTag = userId;
    try {
        const user = await yuno.dC.users.fetch(userId);
        userTag = user.tag;
    } catch (e) {
        // User not found, proceed anyway
    }

    // Check if already banned
    try {
        const existingBan = await guild.bans.fetch(userId);
        if (existingBan) {
            console.log(`User ${userTag} is already banned from ${guild.name}.`);
            console.log(`Reason: ${existingBan.reason || "No reason"}`);
            return;
        }
    } catch (e) {
        // Not banned, continue
    }

    try {
        await guild.members.ban(userId, {
            reason: `[Terminal] ${reason}`,
            deleteMessageSeconds: 0
        });

        console.log(`Successfully banned ${userTag} from ${guild.name}`);
        console.log(`Reason: ${reason}`);

        // Log to mod actions
        await yuno.dbCommands.addModAction(
            yuno.database,
            serverId,
            "terminal",
            userId,
            "ban",
            reason,
            Date.now()
        );
    } catch (e) {
        console.log(`Error banning user: ${e.message}`);
    }
}

module.exports.about = {
    "command": "tban",
    "description": "Ban a user from a server via terminal.",
    "usage": "tban <server-id> <user-id> [reason]",
    "examples": [
        "tban 123456789012345678 987654321098765432",
        "tban 123456789012345678 987654321098765432 Spamming"
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["termban", "terminalban"]
}

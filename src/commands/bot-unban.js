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

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length < 1) {
        return msg.channel.send(`:negative_squared_cross_mark: Usage: \`bot-unban <id>\`

**Example:**
\`bot-unban 123456789012345678\``);
    }

    const id = args[0];
    if (!/^\d{17,19}$/.test(id)) {
        return msg.channel.send(":negative_squared_cross_mark: Invalid ID format. Must be a Discord snowflake (17-19 digits).");
    }

    // Check if banned
    const existingBan = await yuno.dbCommands.getBotBan(yuno.database, id);
    if (!existingBan) {
        return msg.channel.send(":negative_squared_cross_mark: This ID is not bot-banned.");
    }

    // Remove the ban
    await yuno.dbCommands.removeBotBan(yuno.database, id);

    // Try to get info about what was unbanned
    let targetInfo = id;
    if (existingBan.type === "user") {
        try {
            const user = await yuno.dC.users.fetch(id);
            targetInfo = `${user.tag} (${id})`;
        } catch (e) {
            targetInfo = id;
        }
    } else {
        const guild = yuno.dC.guilds.cache.get(id);
        if (guild) {
            targetInfo = `${guild.name} (${id})`;
        }
    }

    msg.channel.send(`:white_check_mark: Successfully removed bot-ban for ${existingBan.type}: **${targetInfo}**

They can now use the bot again.`);
}

module.exports.runTerminal = async function(yuno, args) {
    if (args.length < 1) {
        console.log("Usage: bot-unban <id>");
        console.log("");
        console.log("Example:");
        console.log("  bot-unban 123456789012345678");
        return;
    }

    const id = args[0];
    if (!/^\d{17,19}$/.test(id)) {
        console.log("Error: Invalid ID format. Must be a Discord snowflake (17-19 digits).");
        return;
    }

    // Check if banned
    const existingBan = await yuno.dbCommands.getBotBan(yuno.database, id);
    if (!existingBan) {
        console.log("Error: This ID is not bot-banned.");
        return;
    }

    // Remove the ban
    await yuno.dbCommands.removeBotBan(yuno.database, id);

    // Try to get info about what was unbanned
    let targetInfo = id;
    if (existingBan.type === "user") {
        try {
            const user = await yuno.dC.users.fetch(id);
            targetInfo = `${user.tag} (${id})`;
        } catch (e) {
            targetInfo = id;
        }
    } else {
        const guild = yuno.dC.guilds.cache.get(id);
        if (guild) {
            targetInfo = `${guild.name} (${id})`;
        }
    }

    console.log(`Successfully removed bot-ban for ${existingBan.type}: ${targetInfo}`);
    console.log("They can now use the bot again.");
}

module.exports.about = {
    "command": "bot-unban",
    "description": "Remove a bot-level ban from a user or server.",
    "usage": "bot-unban <id>",
    "examples": ["bot-unban 123456789012345678"],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": true,
    "onlyMasterUsers": true,
    "aliases": ["botunban"]
}

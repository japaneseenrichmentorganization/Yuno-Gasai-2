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
    // Cache discord client reference
    const { users, guilds } = yuno.dC;

    if (args.length < 2) {
        return msg.channel.send(`:negative_squared_cross_mark: Usage: \`bot-ban <user|server> <id> [reason]\`

**Examples:**
\`bot-ban user 123456789012345678 Spamming the bot\`
\`bot-ban server 987654321098765432 Abuse\``);
    }

    const type = args[0].toLowerCase();
    if (type !== "user" && type !== "server") {
        return msg.channel.send(":negative_squared_cross_mark: Type must be `user` or `server`.");
    }

    const id = args[1];
    if (!/^\d{17,19}$/.test(id)) {
        return msg.channel.send(":negative_squared_cross_mark: Invalid ID format. Must be a Discord snowflake (17-19 digits).");
    }

    const reason = args.slice(2).join(" ") || null;

    // Check if already banned
    const existingBan = await yuno.dbCommands.getBotBan(yuno.database, id);
    if (existingBan) {
        return msg.channel.send(`:warning: This ${type} is already bot-banned.
**Reason:** ${existingBan.reason || "No reason provided"}
**Banned:** <t:${Math.floor(existingBan.bannedAt / 1000)}:R>`);
    }

    // Add the ban
    await yuno.dbCommands.addBotBan(yuno.database, id, type, reason, author.id);

    // Try to get info about what was banned
    let targetInfo = id;
    if (type === "user") {
        try {
            const user = await users.fetch(id);
            targetInfo = `${user.tag} (${id})`;
        } catch (e) {
            targetInfo = id;
        }
    } else {
        const guild = guilds.cache.get(id);
        if (guild) {
            targetInfo = `${guild.name} (${id})`;
        }
    }

    msg.channel.send(`:white_check_mark: Successfully bot-banned ${type}: **${targetInfo}**
${reason ? `**Reason:** ${reason}` : ""}

This ${type} can no longer use the bot.`);
}

module.exports.runTerminal = async function(yuno, args) {
    // Cache discord client reference
    const { users, guilds } = yuno.dC;

    if (args.length < 2) {
        console.log("Usage: bot-ban <user|server> <id> [reason]");
        console.log("");
        console.log("Examples:");
        console.log("  bot-ban user 123456789012345678 Spamming the bot");
        console.log("  bot-ban server 987654321098765432 Abuse");
        return;
    }

    const type = args[0].toLowerCase();
    if (type !== "user" && type !== "server") {
        console.log("Error: Type must be 'user' or 'server'.");
        return;
    }

    const id = args[1];
    if (!/^\d{17,19}$/.test(id)) {
        console.log("Error: Invalid ID format. Must be a Discord snowflake (17-19 digits).");
        return;
    }

    const reason = args.slice(2).join(" ") || null;

    // Check if already banned
    const existingBan = await yuno.dbCommands.getBotBan(yuno.database, id);
    if (existingBan) {
        console.log(`This ${type} is already bot-banned.`);
        console.log(`Reason: ${existingBan.reason || "No reason provided"}`);
        console.log(`Banned: ${new Date(existingBan.bannedAt).toLocaleString()}`);
        return;
    }

    // Add the ban (terminal user = "terminal")
    await yuno.dbCommands.addBotBan(yuno.database, id, type, reason, "terminal");

    // Try to get info about what was banned
    let targetInfo = id;
    if (type === "user") {
        try {
            const user = await users.fetch(id);
            targetInfo = `${user.tag} (${id})`;
        } catch (e) {
            targetInfo = id;
        }
    } else {
        const guild = guilds.cache.get(id);
        if (guild) {
            targetInfo = `${guild.name} (${id})`;
        }
    }

    console.log(`Successfully bot-banned ${type}: ${targetInfo}`);
    if (reason) {
        console.log(`Reason: ${reason}`);
    }
    console.log(`This ${type} can no longer use the bot.`);
}

module.exports.about = {
    "command": "bot-ban",
    "description": "Ban a user or server from using the bot entirely.",
    "usage": "bot-ban <user|server> <id> [reason]",
    "examples": [
        "bot-ban user 123456789012345678 Spamming",
        "bot-ban server 987654321098765432 Abuse"
    ],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": true,
    "onlyMasterUsers": true,
    "aliases": ["botban"]
}

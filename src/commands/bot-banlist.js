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

// Type filter lookup table
const TYPE_FILTERS = {
    users: "user", user: "user",
    servers: "server", server: "server"
};

module.exports.run = async function(yuno, author, args, msg) {
    // Cache discord client references
    const { users, guilds } = yuno.dC;

    const type = TYPE_FILTERS[args[0]?.toLowerCase()] ?? null;
    const bans = await yuno.dbCommands.getAllBotBans(yuno.database, type);

    if (bans.length === 0)
        return msg.channel.send(`:information_source: No bot bans found${type ? ` for ${type}s` : ""}.`);

    const embed = new EmbedBuilder()
        .setTitle(`Bot Bans${type ? ` (${type}s only)` : ""}`)
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({ text: `Total: ${bans.length} ban(s)` });

    let description = "";
    for (const ban of bans.slice(0, 20)) {
        let targetName;
        if (ban.type === "user") {
            try {
                const user = await users.fetch(ban.id);
                targetName = user.tag;
            } catch {
                targetName = "Unknown User";
            }
        } else {
            targetName = guilds.cache.get(ban.id)?.name ?? "Unknown Server";
        }

        const emoji = ban.type === "user" ? ":bust_in_silhouette:" : ":homes:";
        description += `${emoji} **${targetName}**\n`;
        description += `   ID: \`${ban.id}\`\n`;
        description += `   Reason: ${ban.reason || "No reason"}\n`;
        description += `   Banned: <t:${Math.floor(ban.bannedAt / 1000)}:R>\n\n`;
    }

    if (bans.length > 20) {
        description += `\n*...and ${bans.length - 20} more*`;
    }

    embed.setDescription(description || "No bans found");
    msg.channel.send({ embeds: [embed] });
}

module.exports.runTerminal = async function(yuno, args) {
    // Cache discord client references
    const { users, guilds } = yuno.dC;

    const type = TYPE_FILTERS[args[0]?.toLowerCase()] ?? null;
    const bans = await yuno.dbCommands.getAllBotBans(yuno.database, type);

    if (bans.length === 0) {
        console.log(`No bot bans found${type ? ` for ${type}s` : ""}.`);
        return;
    }

    console.log(`\n=== Bot Bans${type ? ` (${type}s only)` : ""} ===\n`);

    for (const ban of bans) {
        let targetName;
        if (ban.type === "user") {
            try {
                const user = await users.fetch(ban.id);
                targetName = user.tag;
            } catch {
                targetName = "Unknown User";
            }
        } else {
            targetName = guilds.cache.get(ban.id)?.name ?? "Unknown Server";
        }

        const icon = ban.type === "user" ? "[USER]" : "[SERVER]";
        console.log(`${icon} ${targetName}`);
        console.log(`   ID: ${ban.id}`);
        console.log(`   Reason: ${ban.reason || "No reason"}`);
        console.log(`   Banned: ${new Date(ban.bannedAt).toLocaleString()}`);
        console.log(`   Banned by: ${ban.bannedBy}`);
        console.log("");
    }

    console.log(`Total: ${bans.length} ban(s)`);
}

module.exports.about = {
    "command": "bot-banlist",
    "description": "View all bot-level bans.",
    "usage": "bot-banlist [users|servers]",
    "examples": [
        "bot-banlist",
        "bot-banlist users",
        "bot-banlist servers"
    ],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": true,
    "onlyMasterUsers": true,
    "aliases": ["botbanlist", "bot-bans", "botbans"]
}

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

const { PermissionsBitField } = require("discord.js");

/**
 * Get permission names from a permission bitfield
 */
function getKeyPermissions(permissions) {
    const keyPerms = [
        "Administrator",
        "ManageGuild",
        "ManageChannels",
        "ManageRoles",
        "ManageMessages",
        "KickMembers",
        "BanMembers",
        "ModerateMembers"
    ];

    const hasPerms = [];
    for (const perm of keyPerms) {
        if (permissions.has(PermissionsBitField.Flags[perm])) {
            hasPerms.push(perm);
        }
    }

    return hasPerms.length > 0 ? hasPerms.join(", ") : "Basic permissions";
}

module.exports.runTerminal = async function(yuno, args) {
    const verbose = args.includes("-v") || args.includes("--verbose");
    const guilds = yuno.dC.guilds.cache;

    if (guilds.size === 0) {
        console.log("Bot is not in any servers.");
        return;
    }

    console.log(`\n=== Servers (${guilds.size}) ===\n`);

    let index = 1;
    for (const [guildId, guild] of guilds) {
        const owner = await guild.fetchOwner().catch(() => null);
        const botMember = guild.members.cache.get(yuno.dC.user.id);
        const permissions = botMember?.permissions;

        // Count channel types
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const totalChannels = guild.channels.cache.size;

        console.log(`${index}. ${guild.name} [${guildId}]`);
        console.log(`   Members: ${guild.memberCount} | Channels: ${totalChannels} | Roles: ${guild.roles.cache.size}`);

        if (verbose) {
            console.log(`   Channel breakdown: ${textChannels} text, ${voiceChannels} voice, ${categories} categories`);
            console.log(`   Bot permissions: ${permissions ? getKeyPermissions(permissions) : "Unknown"}`);
            console.log(`   Owner: ${owner?.user.tag || "Unknown"} (${guild.ownerId})`);
            console.log(`   Created: ${guild.createdAt.toLocaleDateString()}`);

            // Check bot-ban status
            const banStatus = await yuno.dbCommands.getBotBan(yuno.database, guildId);
            if (banStatus) {
                console.log(`   [BOT-BANNED] Reason: ${banStatus.reason || "No reason"}`);
            }
        } else {
            console.log(`   Bot perms: ${permissions ? getKeyPermissions(permissions) : "Unknown"}`);
            console.log(`   Owner: ${owner?.user.tag || "Unknown"}`);
        }

        console.log("");
        index++;
    }

    if (!verbose) {
        console.log("Tip: Use 'servers -v' for more detailed information.");
    }
}

module.exports.about = {
    "command": "servers",
    "description": "List all servers the bot is in with detailed information.",
    "usage": "servers [-v|--verbose]",
    "examples": ["servers", "servers -v"],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["guilds", "serverlist"]
}

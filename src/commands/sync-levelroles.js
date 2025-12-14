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

const {EmbedBuilder} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    // Get the level role map
    let levelRoleMap = await yuno.dbCommands.getLevelRoleMap(yuno.database, msg.guild.id);

    if (levelRoleMap === null || Object.keys(levelRoleMap).length === 0) {
        return msg.channel.send(":negative_squared_cross_mark: No level role map configured for this guild. Use `set-levelrolemap` to configure it first.");
    }

    if (args.length === 0) {
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments. Usage: `sync-levelroles <level>`");
    }

    // Parse the level number
    const targetLevel = parseInt(args[0], 10);
    if (isNaN(targetLevel) || targetLevel < 0) {
        return msg.channel.send(":negative_squared_cross_mark: Level must be a positive number.");
    }

    const processingMsg = await msg.channel.send(`:hourglass: Processing... Fetching all guild members and checking XP data for level **${targetLevel}**...`);

    try {
        // Fetch all guild members
        await msg.guild.members.fetch();

        // Get all members and check their XP data
        let usersAtLevel = [];
        for (const [memberId, member] of msg.guild.members.cache) {
            if (member.user.bot) continue;

            let xpData = await yuno.dbCommands.getXPData(yuno.database, msg.guild.id, memberId);
            if (xpData && xpData.level === targetLevel) {
                usersAtLevel.push(member);
            }
        }

        if (usersAtLevel.length === 0) {
            return processingMsg.edit(`:negative_squared_cross_mark: No users found at level **${targetLevel}**.`);
        }

        await processingMsg.edit(`:hourglass: Found **${usersAtLevel.length}** users at level **${targetLevel}**. Syncing roles...`);

        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        // Process each user
        for (const user of usersAtLevel) {
            // Find all roles that should be assigned (level <= user's level)
            let rolesToAssign = [];

            for (let [level, roleId] of Object.entries(levelRoleMap)) {
                const levelNum = parseInt(level, 10);
                if (levelNum <= targetLevel) {
                    try {
                        let role = await msg.guild.roles.fetch(roleId);
                        if (role && !user.roles.cache.has(roleId)) {
                            rolesToAssign.push(role);
                        }
                    } catch(e) {
                        console.error(`Failed to fetch role ${roleId} for level ${level}:`, e);
                    }
                }
            }

            if (rolesToAssign.length === 0) {
                skippedCount++;
                continue;
            }

            // Assign all the roles
            try {
                await user.roles.add(rolesToAssign);
                successCount++;
            } catch(e) {
                failCount++;
                console.error(`Failed to assign roles to ${user.user.tag}:`, e);
            }
        }

        await processingMsg.edit({embeds: [new EmbedBuilder()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Level roles synced!")
            .setDescription(`Synced roles for all users at level **${targetLevel}**`)
            .addFields(
                {name: "Users processed", value: usersAtLevel.length.toString(), inline: true},
                {name: "Roles assigned", value: successCount.toString(), inline: true},
                {name: "Already had roles", value: skippedCount.toString(), inline: true},
                {name: "Failed", value: failCount.toString(), inline: true}
            )
        ]});

    } catch(e) {
        await processingMsg.edit(`:negative_squared_cross_mark: An error occurred: ${e.message}`);
        console.error("Sync level roles error:", e);
    }
}

module.exports.about = {
    "command": "sync-levelroles",
    "description": "Assigns all level roles to ALL users at a specific level.",
    "usage": "sync-levelroles <level>",
    "examples": ["sync-levelroles 5", "sync-levelroles 10"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["syncroles", "fixroles"],
    "onlyMasterUsers": true
}

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

// Helper function to calculate XP for a given level
// This matches Yuno's XP formula from experience.js
function calculateXPForLevel(level) {
    // Start with 0 XP at level 0
    if (level === 0) return 0;
    
    // Calculate total XP needed to reach this level
    // Formula: sum of (5 * lvl^2 + 50 * lvl + 100) for each level from 0 to level-1
    let totalXP = 0;
    for (let i = 0; i < level; i++) {
        totalXP += 5 * Math.pow(i, 2) + 50 * i + 100;
    }
    return totalXP;
}

module.exports.run = async function(yuno, author, args, msg) {
    // Get the level role map
    let levelRoleMap = await yuno.dbCommands.getLevelRoleMap(yuno.database, msg.guild.id);

    if (levelRoleMap === null || Object.keys(levelRoleMap).length === 0) {
        return msg.channel.send(":negative_squared_cross_mark: No level role map configured for this guild. Use `set-levelrolemap` to configure it first.");
    }

    const processingMsg = await msg.channel.send(`:hourglass: Processing... Fetching all guild members and syncing XP from their level roles...`);

    try {
        // Fetch all guild members
        await msg.guild.members.fetch();

        let successCount = 0;
        let skippedCount = 0;
        let failCount = 0;
        let noRoleCount = 0;

        // Process each member
        for (const [memberId, member] of msg.guild.members.cache) {
            if (member.user.bot) continue;

            // Find the highest level role the user has
            let highestLevel = 0;
            let hasLevelRole = false;

            for (let [level, roleId] of Object.entries(levelRoleMap)) {
                if (member.roles.cache.has(roleId)) {
                    hasLevelRole = true;
                    let levelNum = parseInt(level);
                    if (levelNum > highestLevel) {
                        highestLevel = levelNum;
                    }
                }
            }

            // Skip if user has no level roles
            if (!hasLevelRole) {
                noRoleCount++;
                continue;
            }

            // Get current XP data
            let currentXPData = await yuno.dbCommands.getXPData(yuno.database, msg.guild.id, memberId);

            // If user already has XP data at or above this level, skip
            if (currentXPData && currentXPData.level >= highestLevel) {
                skippedCount++;
                continue;
            }

            // Calculate XP for the level
            let xpForLevel = calculateXPForLevel(highestLevel);

            try {
                // Set the user's XP to match their highest level role
                // setXPData parameters: (database, guildid, userid, xp, level)
                await yuno.dbCommands.setXPData(yuno.database, msg.guild.id, memberId, xpForLevel, highestLevel);
                successCount++;
            } catch(e) {
                failCount++;
                console.error(`Failed to set XP for ${member.user.tag}:`, e);
            }
        }

        await processingMsg.edit({embeds: [new EmbedBuilder()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: XP synced from roles!")
            .setDescription(`Assigned XP to users based on their level roles`)
            .addFields(
                {name: "Successfully synced", value: successCount.toString(), inline: true},
                {name: "Already had higher XP", value: skippedCount.toString(), inline: true},
                {name: "No level roles", value: noRoleCount.toString(), inline: true},
                {name: "Failed", value: failCount.toString(), inline: true}
            )
            .setFooter({text: "Note: Users receive XP based on their highest level role"})
        ]});

    } catch(e) {
        await processingMsg.edit(`:negative_squared_cross_mark: An error occurred: ${e.message}`);
        console.error("Sync XP from roles error:", e);
    }
}

module.exports.about = {
    "command": "sync-xp-from-roles",
    "description": "Assigns XP to users based on their current level roles. Useful for database recovery.",
    "usage": "sync-xp-from-roles",
    "examples": ["sync-xp-from-roles"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["syncxp", "recover-xp", "fix-xp"],
    "onlyMasterUsers": true
}

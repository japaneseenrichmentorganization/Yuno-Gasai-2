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

    // Build a human-readable list of level roles for the initial message
    let rolesList = [];
    for (let [level, roleId] of Object.entries(levelRoleMap)) {
        let role = msg.guild.roles.cache.get(roleId);
        if (role) {
            rolesList.push(`Level ${level}: ${role.name}`);
        }
    }

    const processingMsg = await msg.channel.send(`:hourglass: **Step 1/3:** Fetching all guild members...\n\n**Configured level roles:**\n${rolesList.slice(0, 10).join('\n')}${rolesList.length > 10 ? `\n... and ${rolesList.length - 10} more` : ''}`);

    try {
        // Fetch all guild members
        await msg.guild.members.fetch();
        
        const totalMembers = msg.guild.members.cache.filter(m => !m.user.bot).size;
        await processingMsg.edit(`:hourglass: **Step 2/3:** Fetched **${totalMembers}** members. Now analyzing their level roles...`);

        let successCount = 0;
        let skippedCount = 0;
        let failCount = 0;
        let noRoleCount = 0;
        let processedCount = 0;
        let lastUpdateTime = Date.now();
        let levelDistribution = {}; // Track how many users at each level

        // Process each member
        for (const [memberId, member] of msg.guild.members.cache) {
            if (member.user.bot) continue;

            processedCount++;

            // Update progress message every 5 seconds or every 50 users
            if (Date.now() - lastUpdateTime > 5000 || processedCount % 50 === 0) {
                await processingMsg.edit(`:hourglass: **Step 3/3:** Processing members... **${processedCount}/${totalMembers}** (${Math.round((processedCount/totalMembers)*100)}%)\n` +
                    `✅ Synced: ${successCount} | ⏭️ Skipped: ${skippedCount} | ❌ Failed: ${failCount} | 🚫 No roles: ${noRoleCount}`);
                lastUpdateTime = Date.now();
            }

            // Find the highest level role the user has
            let highestLevel = 0;
            let hasLevelRole = false;
            let highestRoleName = "";

            for (let [level, roleId] of Object.entries(levelRoleMap)) {
                if (member.roles.cache.has(roleId)) {
                    hasLevelRole = true;
                    let levelNum = parseInt(level);
                    if (levelNum > highestLevel) {
                        highestLevel = levelNum;
                        let role = msg.guild.roles.cache.get(roleId);
                        highestRoleName = role ? role.name : "Unknown Role";
                    }
                }
            }

            // Skip if user has no level roles
            if (!hasLevelRole) {
                noRoleCount++;
                continue;
            }

            // Track level distribution
            if (!levelDistribution[highestLevel]) {
                levelDistribution[highestLevel] = 0;
            }

            // Get current XP data
            let currentXPData = await yuno.dbCommands.getXPData(yuno.database, msg.guild.id, memberId);

            // If user already has XP data at or above this level, skip
            if (currentXPData && currentXPData.level >= highestLevel) {
                skippedCount++;
                levelDistribution[highestLevel]++;
                continue;
            }

            // Calculate XP for the level
            let xpForLevel = calculateXPForLevel(highestLevel);

            try {
                // Set the user's XP to match their highest level role
                // setXPData parameters: (database, guildid, userid, xp, level)
                await yuno.dbCommands.setXPData(yuno.database, msg.guild.id, memberId, xpForLevel, highestLevel);
                successCount++;
                levelDistribution[highestLevel]++;
            } catch(e) {
                failCount++;
                console.error(`Failed to set XP for ${member.user.tag}:`, e);
            }
        }
        
        // Final update with complete counts
        await processingMsg.edit(`:hourglass: **Step 3/3:** Completed! Processed **${processedCount}/${totalMembers}** members.\n` +
            `✅ Synced: ${successCount} | ⏭️ Skipped: ${skippedCount} | ❌ Failed: ${failCount} | 🚫 No roles: ${noRoleCount}`);
        
        // Build level distribution text
        let distributionText = "";
        let sortedLevels = Object.keys(levelDistribution).sort((a, b) => parseInt(a) - parseInt(b));
        for (let level of sortedLevels) {
            let role = msg.guild.roles.cache.get(levelRoleMap[level]);
            let roleName = role ? role.name : `Level ${level}`;
            distributionText += `**${roleName}**: ${levelDistribution[level]} users\n`;
        }
        if (distributionText.length > 1024) {
            distributionText = distributionText.substring(0, 1000) + "...\n(truncated)";
        }
        
        // Small delay before showing final embed
        await new Promise(resolve => setTimeout(resolve, 1000));

        let embedFields = [
            {name: "✅ Successfully synced", value: successCount.toString(), inline: true},
            {name: "⏭️ Already had higher XP", value: skippedCount.toString(), inline: true},
            {name: "🚫 No level roles", value: noRoleCount.toString(), inline: true},
            {name: "❌ Failed", value: failCount.toString(), inline: true},
            {name: "📊 Total processed", value: processedCount.toString(), inline: true},
            {name: "🤖 Bots skipped", value: (msg.guild.members.cache.size - totalMembers).toString(), inline: true}
        ];

        // Add level distribution if we have it
        if (distributionText && sortedLevels.length > 0) {
            embedFields.push({name: "📈 Level Distribution", value: distributionText || "No data", inline: false});
        }

        await processingMsg.edit({embeds: [new EmbedBuilder()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: XP synced from roles!")
            .setDescription(`Successfully processed **${processedCount}** members and assigned XP based on their level roles`)
            .addFields(embedFields)
            .setFooter({text: "Note: Users receive XP based on their highest level role"})
            .setTimestamp()
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

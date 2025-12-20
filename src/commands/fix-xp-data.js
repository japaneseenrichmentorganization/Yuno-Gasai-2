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

// Helper function to calculate XP needed for next level
function getNeededXPForLevel(level) {
    return 5 * Math.pow(level, 2) + 50 * level + 100;
}

module.exports.run = async function(yuno, author, args, msg) {
    const processingMsg = await msg.channel.send(`:hourglass: **Scanning for corrupted XP data...**\n\nThis will find users whose XP exceeds what's needed for their next level (causing negative "XP needed" display).`);

    try {
        // Query all XP records for this guild
        // Cast userID to TEXT to avoid BigInt issues with Node.js 24 native SQLite
        const allXPData = await yuno.database.allPromise(
            "SELECT CAST(userID AS TEXT) as userID, exp, level FROM experiences WHERE guildID = ?",
            [msg.guild.id]
        );

        if (!allXPData || allXPData.length === 0) {
            return processingMsg.edit(`:information_source: No XP data found for this guild.`);
        }

        let corruptedCount = 0;
        let fixedCount = 0;
        let failedCount = 0;
        let corruptedUsers = [];

        for (const record of allXPData) {
            const neededXP = getNeededXPForLevel(record.level);

            // Check if XP exceeds what's needed for next level
            if (record.exp > neededXP) {
                corruptedCount++;

                // Try to get the member info for display
                let memberTag = record.userID;
                try {
                    const member = await msg.guild.members.fetch(record.userID);
                    memberTag = member.user.tag;
                } catch(e) {
                    // User might have left the server
                }

                corruptedUsers.push({
                    userId: record.userID,
                    tag: memberTag,
                    level: record.level,
                    currentXP: record.exp,
                    neededXP: neededXP,
                    overflow: record.exp - neededXP
                });
            }
        }

        if (corruptedCount === 0) {
            return processingMsg.edit(`:white_check_mark: **No corrupted XP data found!**\n\nAll ${allXPData.length} users have valid XP values.`);
        }

        // Show what we found
        let previewText = corruptedUsers.slice(0, 5).map(u =>
            `• **${u.tag}** - Level ${u.level}, XP: ${u.currentXP} (should be < ${u.neededXP})`
        ).join('\n');

        if (corruptedUsers.length > 5) {
            previewText += `\n... and ${corruptedUsers.length - 5} more`;
        }

        await processingMsg.edit(`:warning: **Found ${corruptedCount} users with corrupted XP data:**\n\n${previewText}\n\n:hourglass: **Fixing now...** (setting XP to 0 at their current level)`);

        // Fix the corrupted data
        for (const user of corruptedUsers) {
            try {
                await yuno.dbCommands.setXPData(yuno.database, msg.guild.id, user.userId, 0, user.level);
                fixedCount++;
            } catch(e) {
                failedCount++;
                console.error(`Failed to fix XP for user ${user.userId}:`, e);
            }
        }

        // Final result
        const embed = new EmbedBuilder()
            .setColor(failedCount === 0 ? "#43cc24" : "#ffcc00")
            .setTitle(":wrench: XP Data Fix Complete")
            .setDescription(`Fixed corrupted XP records for ${fixedCount} users.`)
            .addFields([
                {name: "Total Records Scanned", value: allXPData.length.toString(), inline: true},
                {name: "Corrupted Found", value: corruptedCount.toString(), inline: true},
                {name: "Successfully Fixed", value: fixedCount.toString(), inline: true},
                {name: "Failed to Fix", value: failedCount.toString(), inline: true}
            ])
            .setFooter({text: "Users now have 0 XP at their current level"})
            .setTimestamp();

        await processingMsg.edit({content: null, embeds: [embed]});

    } catch(e) {
        await processingMsg.edit(`:negative_squared_cross_mark: An error occurred: ${e.message}`);
        console.error("Fix XP data error:", e);
    }
}

module.exports.about = {
    "command": "fix-xp-data",
    "description": "Fixes corrupted XP data where users have more XP than needed for their level (causing negative display).",
    "usage": "fix-xp-data",
    "examples": ["fix-xp-data"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["fixxp", "repair-xp"],
    "onlyMasterUsers": true
}

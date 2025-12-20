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

// Yield to event loop to keep bot responsive
const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));

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

        // First pass: identify corrupted records (fast, no API calls)
        const corruptedRecords = [];
        for (const record of allXPData) {
            const neededXP = getNeededXPForLevel(record.level);
            if (record.exp > neededXP) {
                corruptedRecords.push({
                    userId: record.userID,
                    level: record.level,
                    currentXP: record.exp,
                    neededXP: neededXP
                });
            }
        }

        if (corruptedRecords.length === 0) {
            return processingMsg.edit(`:white_check_mark: **No corrupted XP data found!**\n\nAll ${allXPData.length} users have valid XP values.`);
        }

        const totalCorrupted = corruptedRecords.length;
        await processingMsg.edit(`:warning: **Found ${totalCorrupted} corrupted XP records.**\n\n:hourglass: **Fixing now...** This may take a while for large datasets.\n\nProgress: 0/${totalCorrupted} (0%)`);

        // Second pass: fix records in batches with progress updates
        const BATCH_SIZE = 100;
        let fixedCount = 0;
        let failedCount = 0;
        let lastUpdateTime = Date.now();

        for (let i = 0; i < corruptedRecords.length; i++) {
            const record = corruptedRecords[i];

            try {
                await yuno.dbCommands.setXPData(yuno.database, msg.guild.id, record.userId, 0, record.level);
                fixedCount++;
            } catch(e) {
                failedCount++;
                // Only log first few errors to avoid spam
                if (failedCount <= 5) {
                    console.error(`Failed to fix XP for user ${record.userId}:`, e);
                }
            }

            // Yield every batch to keep bot responsive
            if ((i + 1) % BATCH_SIZE === 0) {
                await yieldToEventLoop();

                // Update progress every 5 seconds or every 1000 records
                const now = Date.now();
                if (now - lastUpdateTime > 5000 || (i + 1) % 1000 === 0) {
                    const percent = Math.round(((i + 1) / totalCorrupted) * 100);
                    await processingMsg.edit(`:hourglass: **Fixing corrupted XP records...**\n\nProgress: ${i + 1}/${totalCorrupted} (${percent}%)\nFixed: ${fixedCount} | Failed: ${failedCount}`);
                    lastUpdateTime = now;
                }
            }
        }

        // Final result
        const embed = new EmbedBuilder()
            .setColor(failedCount === 0 ? "#43cc24" : "#ffcc00")
            .setTitle(":wrench: XP Data Fix Complete")
            .setDescription(`Fixed corrupted XP records for ${fixedCount.toLocaleString()} users.`)
            .addFields([
                {name: "Total Records Scanned", value: allXPData.length.toLocaleString(), inline: true},
                {name: "Corrupted Found", value: totalCorrupted.toLocaleString(), inline: true},
                {name: "Successfully Fixed", value: fixedCount.toLocaleString(), inline: true},
                {name: "Failed to Fix", value: failedCount.toLocaleString(), inline: true}
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

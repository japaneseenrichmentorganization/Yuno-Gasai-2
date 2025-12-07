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

let fs = require("fs");

module.exports.run = async function(yuno, author, args, msg) {
    if (!args[0])
        return msg.channel.send("Give the guild-id please.");

    let guid = args[0];

    // Security: Validate guild ID to prevent path traversal attacks
    // Guild IDs should only contain digits (Discord snowflake IDs)
    if (!/^[0-9]+$/.test(guid)) {
        return msg.channel.send(":negative_squared_cross_mark: Invalid guild ID. Guild IDs should only contain numbers.");
    }

    fs.readFile("./BANS-" + guid + ".txt", async (err, data) => {
        if (err)
            return msg.channel.send("Error while retrieving bans: " + err.code);

        console.log("[BanMSystem] Applying bans...");
        try {
            const bans = JSON.parse(data);

            if (!Array.isArray(bans) || bans.length === 0) {
                return msg.channel.send("No bans found in the file or invalid format.");
            }

            const statusMsg = await msg.channel.send(`:hourglass: Starting ban import for ${bans.length} users... This may take a while.`);

            // Discord.js v14 doesn't have bulkCreate, we need to ban individually
            // Process in batches to avoid rate limits
            const batchSize = 5; // Small batch to be safe with rate limits
            const delayBetweenBans = 1000; // 1 second delay between each ban
            const delayBetweenBatches = 5000; // 5 second delay between batches
            
            let totalBanned = 0;
            let totalFailed = 0;
            let totalAlreadyBanned = 0;
            let processedCount = 0;
            const totalBatches = Math.ceil(bans.length / batchSize);

            // Process bans in small batches
            for (let i = 0; i < bans.length; i += batchSize) {
                const batch = bans.slice(i, i + batchSize);
                const batchNum = Math.floor(i / batchSize) + 1;

                // Update status at start of each batch
                await statusMsg.edit(
                    `:hourglass: Processing ban import... Batch ${batchNum}/${totalBatches}\n` +
                    `Progress: ${processedCount}/${bans.length} (${Math.round((processedCount/bans.length)*100)}%)\n` +
                    `Banned: ${totalBanned} | Already banned: ${totalAlreadyBanned} | Failed: ${totalFailed}`
                );

                // Process each ban in the batch with individual delays
                for (const userId of batch) {
                    try {
                        await msg.guild.members.ban(userId, {
                            deleteMessageSeconds: 0,
                            reason: "Ban import from saved banlist"
                        });
                        totalBanned++;
                        console.log(`[BanMSystem] Banned user ${userId}`);
                    } catch(error) {
                        // Check if already banned
                        if (error.code === 10026) { // Unknown Ban (user not banned)
                            totalAlreadyBanned++;
                        } else if (error.message.includes("already banned")) {
                            totalAlreadyBanned++;
                        } else {
                            totalFailed++;
                            console.error(`[BanMSystem] Failed to ban ${userId}:`, error.message);
                        }
                    }
                    
                    processedCount++;

                    // Delay between individual bans
                    if (processedCount < bans.length) {
                        await new Promise(resolve => setTimeout(resolve, delayBetweenBans));
                    }
                }

                // Longer delay between batches
                if (i + batchSize < bans.length) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
                }
            }

            console.log(`[BanMSystem] Import complete. Banned: ${totalBanned}, Already banned: ${totalAlreadyBanned}, Failed: ${totalFailed}`);

            // Send final result
            await statusMsg.edit(
                `✅ Ban import complete!\n` +
                `:white_check_mark: Successfully banned: **${totalBanned}**\n` +
                `:information_source: Already banned: **${totalAlreadyBanned}**\n` +
                `:negative_squared_cross_mark: Failed: **${totalFailed}**\n` +
                `Processed **${bans.length}** users in ${totalBatches} batches\n\n` +
                `⚠️ Note: This process took longer due to Discord rate limits. All bans have been applied.`
            );

        } catch(e) {
            console.log("[BanMSystem] Bans weren't saved as JSON or bulk ban failed. Error: " + e.message);
            msg.channel.send("Error during ban import: " + e.message);
        }
    })
};

module.exports.about = {
    "command": "importbans",
    "description": "Import bans from a saved banlist. Note: This may take several minutes for large ban lists due to Discord rate limits.",
    "examples": ["importbans <guild-id>"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "ibans",
    "onlyMasterUsers": true
}

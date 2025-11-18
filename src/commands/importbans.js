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

            // Discord bulk ban API limit is 200 users per request
            const batchSize = 200;
            let totalBanned = 0;
            let totalFailed = 0;
            let processedBatches = 0;
            const totalBatches = Math.ceil(bans.length / batchSize);

            // Process bans in batches
            for (let i = 0; i < bans.length; i += batchSize) {
                const batch = bans.slice(i, i + batchSize);
                processedBatches++;

                try {
                    // Use bulk ban API with rate limiting support
                    const result = await msg.guild.bans.bulkCreate(batch, {
                        deleteMessageSeconds: 0, // Don't delete any messages
                        reason: "Ban import from saved banlist"
                    });

                    totalBanned += result.bannedUsers.length;
                    totalFailed += result.failedUsers.length;

                    // Update status every 10 batches or on last batch
                    if (processedBatches % 10 === 0 || processedBatches === totalBatches) {
                        await statusMsg.edit(
                            `:hourglass: Processing ban import... Batch ${processedBatches}/${totalBatches}\n` +
                            `Banned: ${totalBanned} | Failed: ${totalFailed}`
                        );
                    }

                    console.log(`[BanMSystem] Batch ${processedBatches}/${totalBatches}: Banned ${result.bannedUsers.length}, Failed ${result.failedUsers.length}`);

                } catch(batchError) {
                    console.error(`[BanMSystem] Error in batch ${processedBatches}:`, batchError.message);
                    totalFailed += batch.length; // Count entire batch as failed
                }

                // Small delay between batches to be extra safe with rate limits
                if (i + batchSize < bans.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`[BanMSystem] Import complete. Total banned: ${totalBanned}, Total failed: ${totalFailed}`);

            // Send final result
            await statusMsg.edit(
                `Ban import complete!\n` +
                `:white_check_mark: Successfully banned: **${totalBanned}**\n` +
                `:negative_squared_cross_mark: Failed/Already banned: **${totalFailed}**\n` +
                `Processed ${bans.length} users in ${totalBatches} batches`
            );

        } catch(e) {
            console.log("[BanMSystem] Bans weren't saved as JSON or bulk ban failed. Error: " + e.message);
            msg.channel.send("Error during ban import: " + e.message);
        }
    })
};

module.exports.about = {
    "command": "importbans",
    "description": "Import bans",
    "examples": ["importbans"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "ibans",
    "onlyMasterUsers": true
}
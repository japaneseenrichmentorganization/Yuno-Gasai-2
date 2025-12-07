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
const fs = require("fs");
const {PermissionsBitField} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return msg.channel.send('No permission to');

    let guid = msg.guild.id;

    try {
        const statusMsg = await msg.channel.send(':hourglass: Fetching bans... This may take a while for large ban lists.');

        // Fetch all bans with pagination
        const allBannedUserIds = [];
        let lastBanId = null;
        let totalFetched = 0;
        const batchSize = 1000; // Discord API limit

        while (true) {
            // Fetch a batch of bans
            const fetchOptions = { limit: batchSize };
            if (lastBanId) {
                fetchOptions.after = lastBanId;
            }

            const bans = await msg.guild.bans.fetch(fetchOptions);

            if (bans.size === 0) {
                break; // No more bans to fetch
            }

            // Extract user IDs from this batch
            const batchUserIds = Array.from(bans.values()).map(ban => ban.user.id);
            allBannedUserIds.push(...batchUserIds);
            totalFetched += bans.size;

            // Update status message every 10k bans
            if (totalFetched % 10000 === 0 || totalFetched === bans.size) {
                await statusMsg.edit(`:hourglass: Fetching bans... ${totalFetched} fetched so far...`);
            }

            // Get the last ban ID for pagination
            lastBanId = batchUserIds[batchUserIds.length - 1];

            // If we got fewer than the batch size, we've reached the end
            if (bans.size < batchSize) {
                break;
            }
        }

        console.log(`[ExportBans] Fetched ${allBannedUserIds.length} total bans for guild ${guid}`);

        // Convert to JSON string
        const banstr = JSON.stringify(allBannedUserIds);

        // Write to file
        fs.writeFile("./BANS-" + guid + ".txt", banstr, async (err) => {
            if (err) {
                await statusMsg.edit("Error while saving bans :( :" + err.code);
            } else {
                await statusMsg.edit(`Bans exported successfully! **${allBannedUserIds.length}** bans saved with Guild ID: ${guid}`);
            }
        });
    } catch(e) {
        msg.channel.send("Error while fetching bans: " + e.message);
        console.error("Export bans error:", e);
    }
}

module.exports.about = {
    "command": "exportbans",
    "description": "Export the banlist to a .txt",
    "examples": ["exportbans"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "ebans",
    "onlyMasterUsers": true
}

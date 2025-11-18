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

            // Use bulk ban API with rate limiting support
            const result = await msg.guild.bans.bulkCreate(bans, {
                deleteMessageSeconds: 0, // Don't delete any messages
                reason: "Ban import from saved banlist"
            });

            console.log(`[BanMSystem] Bulk ban complete. Banned: ${result.bannedUsers.length}, Failed: ${result.failedUsers.length}`);

            // Send detailed result to the channel
            msg.channel.send(
                `Ban import complete!\n` +
                `:white_check_mark: Successfully banned: **${result.bannedUsers.length}**\n` +
                `:negative_squared_cross_mark: Failed/Already banned: **${result.failedUsers.length}**`
            );

            // Log failed users if any
            if (result.failedUsers.length > 0) {
                console.log("[BanMSystem] Failed user IDs:", result.failedUsers.join(", "));
            }

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
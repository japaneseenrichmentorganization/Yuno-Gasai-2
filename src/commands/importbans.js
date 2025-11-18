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
            msg.channel.send("Error while retrieving bans : ", err.code);
        else {
            console.log("[BanMSystem] Applying bans...");
            try {
                let bans = JSON.parse(data);
                let successCount = 0;
                let failCount = 0;

                for (const userId of bans) {
                    try {
                        await msg.guild.members.ban(userId, {
                            reason: "Ban import from saved banlist"
                        });
                        successCount++;
                    } catch(e) {
                        failCount++;
                        console.log("Skipped: " + userId + " error: " + e.message);
                    }
                }
                msg.channel.send(`Ban import complete. Successfully banned: ${successCount}, Failed: ${failCount}`);
            } catch(e) {
                console.log("[BanMSystem] Bans weren't saved as JSON. Error: " + e.message);
                msg.channel.send("Bans aren't in JSON. Error.");
            }
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
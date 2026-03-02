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

const fs = require("fs").promises;
const path = require("path");
const { isValidSnowflake, fetchAllBannedUserIds } = require("../lib/discordHelpers");
const { resolveGuildForTerminal } = require("../lib/terminalHelpers");

module.exports.runTerminal = async function(yuno, args) {
    if (args.length < 1) {
        console.log("Usage: texportbans <server-id> [output-file]");
        console.log("");
        console.log("Export all bans from a server to a JSON file.");
        console.log("Default output: ./BANS-<server-id>.txt");
        console.log("");
        console.log("Examples:");
        console.log("  texportbans 123456789012345678");
        console.log("  texportbans 123456789012345678 ./my-bans.json");
        return;
    }

    const serverId = args[0];
    if (!isValidSnowflake(serverId)) {
        console.log("Error: Invalid server ID format.");
        return;
    }

    const guild = resolveGuildForTerminal(yuno, serverId);
    if (!guild) return;

    // Determine output file
    let outputFile = args[1] || `./BANS-${serverId}.txt`;

    // Validate output path (prevent path traversal to sensitive areas)
    const resolvedPath = path.resolve(outputFile);
    if (resolvedPath.includes("..")) {
        console.log("Error: Invalid file path.");
        return;
    }

    console.log(`Exporting bans from ${guild.name}...`);

    try {
        const allIds = await fetchAllBannedUserIds(guild, (count) => {
            if (count % 5000 === 0) {
                console.log(`  Fetched ${count} bans...`);
            }
        });

        console.log(`Fetched ${allIds.length} total bans.`);

        // Write to file
        const banstr = JSON.stringify(allIds);
        await fs.writeFile(outputFile, banstr);

        console.log(`Successfully exported ${allIds.length} bans to ${outputFile}`);
    } catch (e) {
        console.log(`Error exporting bans: ${e.message}`);
    }
}

module.exports.about = {
    "command": "texportbans",
    "description": "Export bans from a server to a file via terminal.",
    "usage": "texportbans <server-id> [output-file]",
    "examples": [
        "texportbans 123456789012345678",
        "texportbans 123456789012345678 ./my-bans.json"
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["tebans", "termexportbans"]
}

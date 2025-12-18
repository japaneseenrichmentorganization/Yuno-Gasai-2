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
const { setupRateLimitListener, waitForRateLimit } = require("../lib/rateLimitHelper");

module.exports.runTerminal = async function(yuno, args) {
    if (args.length < 2) {
        console.log("Usage: timportbans <server-id> <file-path>");
        console.log("");
        console.log("Import bans from a JSON file to a server.");
        console.log("File should contain an array of user IDs: [\"id1\", \"id2\", ...]");
        console.log("");
        console.log("Examples:");
        console.log("  timportbans 123456789012345678 ./BANS-123456789012345678.txt");
        console.log("  timportbans 123456789012345678 ./my-bans.json");
        return;
    }

    const serverId = args[0];
    const filePath = args[1];

    if (!/^\d{17,19}$/.test(serverId)) {
        console.log("Error: Invalid server ID format.");
        return;
    }

    const guild = yuno.dC.guilds.cache.get(serverId);
    if (!guild) {
        console.log(`Error: Server not found: ${serverId}`);
        console.log("Use 'servers' command to see available servers.");
        return;
    }

    // Check bot permissions
    const botMember = guild.members.cache.get(yuno.dC.user.id);
    if (!botMember?.permissions.has("BanMembers")) {
        console.log("Error: Bot does not have ban permission in this server.");
        return;
    }

    // Validate file path
    const resolvedPath = path.resolve(filePath);

    // Read ban list
    let data;
    try {
        data = await fs.readFile(resolvedPath, "utf8");
    } catch (err) {
        console.log(`Error reading file: ${err.code || err.message}`);
        return;
    }

    let bans;
    try {
        bans = JSON.parse(data);

        if (!Array.isArray(bans) || bans.length === 0) {
            console.log("Error: File must contain a JSON array of user IDs.");
            return;
        }
    } catch (e) {
        console.log("Error: Invalid JSON format.");
        return;
    }

    console.log(`Importing ${bans.length} bans to ${guild.name}...`);
    console.log("This may take a while due to rate limits.");
    console.log("");

    // Setup rate limit listener for dynamic delays
    const cleanupRateLimitListener = setupRateLimitListener(yuno.dC);

    // Process in batches
    const batchSize = 5;

    let totalBanned = 0;
    let totalFailed = 0;
    let totalAlreadyBanned = 0;
    let processedCount = 0;
    const totalBatches = Math.ceil(bans.length / batchSize);

    try {
        for (let i = 0; i < bans.length; i += batchSize) {
            const batch = bans.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;

            // Update status
            process.stdout.write(`\rProcessing batch ${batchNum}/${totalBatches} - ${processedCount}/${bans.length} (${Math.round((processedCount/bans.length)*100)}%)`);

            for (const userId of batch) {
                try {
                    await guild.members.ban(userId, {
                        deleteMessageSeconds: 0,
                        reason: "Terminal ban import"
                    });
                    totalBanned++;
                } catch (error) {
                    if (error.code === 10026 || error.message.includes("already banned")) {
                        totalAlreadyBanned++;
                    } else {
                        totalFailed++;
                    }
                }

                processedCount++;

                // Dynamic delay based on rate limit status
                if (processedCount < bans.length) {
                    await waitForRateLimit(yuno.dC);
                }
            }

            // Dynamic delay between batches
            if (i + batchSize < bans.length) {
                await waitForRateLimit(yuno.dC);
            }
        }
    } finally {
        cleanupRateLimitListener();
    }

    console.log("\n\n=== Import Complete ===");
    console.log(`Successfully banned: ${totalBanned}`);
    console.log(`Already banned: ${totalAlreadyBanned}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Total processed: ${bans.length}`);
}

module.exports.about = {
    "command": "timportbans",
    "description": "Import bans from a file to a server via terminal.",
    "usage": "timportbans <server-id> <file-path>",
    "examples": [
        "timportbans 123456789012345678 ./BANS-123456789012345678.txt",
        "timportbans 123456789012345678 ./my-bans.json"
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["tibans", "termimportbans"]
}

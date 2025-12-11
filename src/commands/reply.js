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

module.exports.runTerminal = async function(yuno, args, rawInput, rl) {
    if (args.length < 1) {
        console.log("Usage: reply <inbox-id|user-id> [message]");
        console.log("");
        console.log("Reply to a DM by inbox ID (small number) or user ID (17-19 digits).");
        console.log("If message is not provided, you can type a multi-line message.");
        console.log("");
        console.log("Examples:");
        console.log("  reply 1 Hello, thanks for your message!");
        console.log("  reply 123456789012345678 Hi there!");
        console.log("  reply 1");
        return;
    }

    const target = args[0];
    let userId;
    let inboxId = null;

    // Determine if target is inbox ID or user ID
    if (/^\d{1,10}$/.test(target) && target.length < 15) {
        // Small number = inbox ID
        inboxId = parseInt(target);
        const inboxMsg = await yuno.dbCommands.getInboxMessage(yuno.database, inboxId);

        if (!inboxMsg) {
            console.log(`Error: Inbox message #${inboxId} not found.`);
            return;
        }

        userId = inboxMsg.usrId;
    } else if (/^\d{17,19}$/.test(target)) {
        // Long number = user ID
        userId = target;
    } else {
        console.log("Error: Invalid ID format.");
        console.log("Use a small number for inbox ID or a 17-19 digit Discord user ID.");
        return;
    }

    // Get message content
    let message = args.slice(1).join(" ");

    // If no message provided, read multi-line input
    if (!message && rl) {
        console.log("Enter message (end with empty line or Ctrl+D):");
        const lines = [];

        const readLine = () => {
            return new Promise((resolve) => {
                rl.question("", (line) => {
                    resolve(line);
                });
            });
        };

        while (true) {
            try {
                const line = await readLine();
                if (line === "") {
                    break;
                }
                lines.push(line);
            } catch (e) {
                break;
            }
        }

        message = lines.join("\n");
    }

    if (!message) {
        console.log("Error: No message provided.");
        return;
    }

    // Try to send the DM
    try {
        const user = await yuno.dC.users.fetch(userId);

        if (!user) {
            console.log(`Error: User not found: ${userId}`);
            return;
        }

        await user.send(message);

        console.log(`Successfully sent DM to ${user.tag}`);

        // Mark inbox message as replied if we have an inbox ID
        if (inboxId) {
            await yuno.dbCommands.markDmReplied(yuno.database, inboxId);
            console.log(`Inbox message #${inboxId} marked as replied.`);
        }

    } catch (e) {
        if (e.code === 50007) {
            console.log("Error: Cannot send DM to this user (DMs disabled or bot blocked).");
        } else {
            console.log(`Error sending DM: ${e.message}`);
        }
    }
}

module.exports.about = {
    "command": "reply",
    "description": "Reply to a DM in the inbox.",
    "usage": "reply <inbox-id|user-id> [message]",
    "examples": [
        "reply 1 Hello!",
        "reply 123456789012345678 Hi there!",
        "reply 1"
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["dm", "respond"]
}

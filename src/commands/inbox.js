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

/**
 * Format relative time
 */
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
}

/**
 * Truncate content
 */
function truncate(str, maxLen = 100) {
    if (!str) return "";
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + "...";
}

module.exports.runTerminal = async function(yuno, args) {
    const subcommand = args[0]?.toLowerCase();

    // Handle user-specific inbox
    if (subcommand === "user" && args[1]) {
        const userId = args[1];
        if (!/^\d{17,19}$/.test(userId)) {
            console.log("Error: Invalid user ID format.");
            return;
        }

        const messages = await yuno.dbCommands.getInboxByUser(yuno.database, userId, 20);

        if (messages.length === 0) {
            console.log(`No DMs found from user ${userId}.`);
            return;
        }

        // Try to get user info
        let userTag = messages[0].userTag;
        try {
            const user = await yuno.dC.users.fetch(userId);
            userTag = user.tag;
        } catch (e) {
            // Use stored tag
        }

        console.log(`\n=== DMs from ${userTag} ===\n`);

        for (const msg of messages) {
            const status = msg.replied ? "REPLIED" : "UNREPLIED";
            const time = formatRelativeTime(msg.timestamp);

            console.log(`[${msg.id}] (${time}) - ${status}`);
            console.log(`    "${truncate(msg.content, 150)}"`);
            if (msg.attachments.length > 0) {
                console.log(`    [${msg.attachments.length} attachment(s)]`);
            }
            console.log("");
        }
        return;
    }

    // Handle count subcommand
    if (subcommand === "unread") {
        const count = await yuno.dbCommands.getUnreadDmCount(yuno.database);
        console.log(`You have ${count} unread DM(s).`);
        return;
    }

    // Default: show inbox
    const count = Math.min(Math.max(parseInt(args[0], 10) || 10, 1), 50);
    const messages = await yuno.dbCommands.getInbox(yuno.database, count);

    if (messages.length === 0) {
        console.log("Your DM inbox is empty.");
        return;
    }

    const unreadCount = await yuno.dbCommands.getUnreadDmCount(yuno.database);

    console.log(`\n=== DM Inbox (${unreadCount} unread) ===\n`);

    for (const msg of messages) {
        const status = msg.replied ? "REPLIED" : "UNREPLIED";
        const time = formatRelativeTime(msg.timestamp);
        const marker = msg.replied ? " " : "*";

        console.log(`${marker}[${msg.id}] ${msg.userTag} (${time}) - ${status}`);
        console.log(`     "${truncate(msg.content, 120)}"`);
        if (msg.attachments.length > 0) {
            console.log(`     [${msg.attachments.length} attachment(s)]`);
        }
        console.log("");
    }

    console.log("---");
    console.log("Use 'reply <id|user-id> <message>' to respond.");
    console.log("Use 'inbox user <user-id>' to see DMs from a specific user.");
    console.log("Use 'inbox <count>' to see more/fewer messages.");
}

module.exports.about = {
    "command": "inbox",
    "description": "View DM messages sent to the bot.",
    "usage": "inbox [count] | inbox user <user-id> | inbox unread",
    "examples": [
        "inbox",
        "inbox 20",
        "inbox user 123456789012345678",
        "inbox unread"
    ],
    "discord": false,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "aliases": ["dms", "dm-inbox"]
}

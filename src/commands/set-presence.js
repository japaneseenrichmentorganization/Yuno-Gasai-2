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

const { ActivityType } = require("discord.js");

// Map string types to ActivityType enum
const ACTIVITY_TYPES = {
    "playing": ActivityType.Playing,
    "streaming": ActivityType.Streaming,
    "listening": ActivityType.Listening,
    "watching": ActivityType.Watching,
    "competing": ActivityType.Competing,
    "custom": ActivityType.Custom
};

const STATUS_OPTIONS = ["online", "idle", "dnd", "invisible"];

module.exports.run = async function(yuno, author, args, msg) {
    // Cache discord client user reference
    const { user: botUser } = yuno.dC;

    if (args.length < 1) {
        return msg.channel.send(`:information_source: **Set Presence Command**

*"Let me show you how I'm feeling~"* 💕

**Usage:**
\`set-presence <type> <text>\` - Set activity with text
\`set-presence status <status>\` - Set online status
\`set-presence clear\` - Clear current activity

**Activity Types:**
• \`playing\` - Playing <text>
• \`watching\` - Watching <text>
• \`listening\` - Listening to <text>
• \`streaming\` - Streaming <text> (requires URL)
• \`competing\` - Competing in <text>

**Status Options:**
• \`online\` - Green dot
• \`idle\` - Yellow dot
• \`dnd\` - Red dot (Do Not Disturb)
• \`invisible\` - Appear offline

**Examples:**
\`set-presence playing with Yukki's heart\`
\`set-presence watching over my senpai\`
\`set-presence listening to Future Diary OST\`
\`set-presence streaming Yuno Gasai https://twitch.tv/example\`
\`set-presence status dnd\`
\`set-presence clear\``);
    }

    const subcommand = args[0].toLowerCase();

    // Handle clear
    if (subcommand === "clear" || subcommand === "reset" || subcommand === "none") {
        try {
            await botUser.setPresence({
                activities: [],
                status: "online"
            });
            // Clear from database
            await yuno.dbCommands.clearPresence(yuno.database);
            return msg.channel.send(":white_check_mark: Presence cleared~");
        } catch (e) {
            return msg.channel.send(`:negative_squared_cross_mark: Failed to clear presence: ${e.message}`);
        }
    }

    // Handle status change
    if (subcommand === "status") {
        const status = args[1]?.toLowerCase();

        if (!status || !STATUS_OPTIONS.includes(status)) {
            return msg.channel.send(`:negative_squared_cross_mark: Invalid status. Options: \`${STATUS_OPTIONS.join("`, `")}\``);
        }

        try {
            await botUser.setPresence({ status });
            // Get current presence and update status in database
            const currentPresence = await yuno.dbCommands.getPresence(yuno.database) || {};
            await yuno.dbCommands.setPresence(yuno.database, {
                ...currentPresence,
                status
            });
            const statusEmoji = {
                "online": ":green_circle:",
                "idle": ":yellow_circle:",
                "dnd": ":red_circle:",
                "invisible": ":white_circle:"
            };
            return msg.channel.send(`${statusEmoji[status]} Status set to **${status}**~`);
        } catch (e) {
            return msg.channel.send(`:negative_squared_cross_mark: Failed to set status: ${e.message}`);
        }
    }

    // Handle activity type
    const activityType = ACTIVITY_TYPES[subcommand];

    if (activityType === undefined) {
        return msg.channel.send(`:negative_squared_cross_mark: Unknown type: \`${subcommand}\`
Valid types: \`${Object.keys(ACTIVITY_TYPES).join("`, `")}\``);
    }

    // Get the activity text
    let activityText = args.slice(1).join(" ");
    let streamUrl = null;

    // For streaming, check for URL
    if (activityType === ActivityType.Streaming) {
        const urlMatch = activityText.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            streamUrl = urlMatch[1];
            activityText = activityText.replace(streamUrl, "").trim();
        }

        if (!streamUrl) {
            return msg.channel.send(`:negative_squared_cross_mark: Streaming requires a URL!
Example: \`set-presence streaming My Stream https://twitch.tv/example\``);
        }
    }

    if (!activityText) {
        return msg.channel.send(":negative_squared_cross_mark: Please provide activity text!");
    }

    try {
        const activity = {
            name: activityText,
            type: activityType
        };

        if (streamUrl) {
            activity.url = streamUrl;
        }

        await botUser.setPresence({
            activities: [activity]
        });

        // Save to database
        const currentPresence = await yuno.dbCommands.getPresence(yuno.database) || {};
        await yuno.dbCommands.setPresence(yuno.database, {
            type: subcommand,
            text: activityText,
            status: currentPresence.status || 'online',
            streamUrl: streamUrl
        });

        const typeDisplay = subcommand.charAt(0).toUpperCase() + subcommand.slice(1);
        return msg.channel.send(`:white_check_mark: Now **${typeDisplay}** ${activityText}${streamUrl ? ` (${streamUrl})` : ""}~`);
    } catch (e) {
        return msg.channel.send(`:negative_squared_cross_mark: Failed to set presence: ${e.message}`);
    }
}

module.exports.runTerminal = async function(yuno, args) {
    // Cache discord client user reference
    const { user: botUser } = yuno.dC;

    if (args.length < 1) {
        console.log("Set Presence Command");
        console.log("");
        console.log("Usage:");
        console.log("  set-presence <type> <text>     - Set activity");
        console.log("  set-presence status <status>   - Set online status");
        console.log("  set-presence clear             - Clear activity");
        console.log("");
        console.log("Activity Types:");
        console.log("  playing, watching, listening, streaming, competing");
        console.log("");
        console.log("Status Options:");
        console.log("  online, idle, dnd, invisible");
        console.log("");
        console.log("Examples:");
        console.log("  set-presence playing with Yukki");
        console.log("  set-presence watching over senpai");
        console.log("  set-presence status dnd");
        console.log("  set-presence clear");
        return;
    }

    const subcommand = args[0].toLowerCase();

    // Handle clear
    if (subcommand === "clear" || subcommand === "reset" || subcommand === "none") {
        try {
            await botUser.setPresence({
                activities: [],
                status: "online"
            });
            // Clear from database
            await yuno.dbCommands.clearPresence(yuno.database);
            console.log("Presence cleared.");
        } catch (e) {
            console.log(`Failed to clear presence: ${e.message}`);
        }
        return;
    }

    // Handle status change
    if (subcommand === "status") {
        const status = args[1]?.toLowerCase();

        if (!status || !STATUS_OPTIONS.includes(status)) {
            console.log(`Invalid status. Options: ${STATUS_OPTIONS.join(", ")}`);
            return;
        }

        try {
            await botUser.setPresence({ status });
            // Get current presence and update status in database
            const currentPresence = await yuno.dbCommands.getPresence(yuno.database) || {};
            await yuno.dbCommands.setPresence(yuno.database, {
                ...currentPresence,
                status
            });
            console.log(`Status set to: ${status}`);
        } catch (e) {
            console.log(`Failed to set status: ${e.message}`);
        }
        return;
    }

    // Handle activity type
    const activityType = ACTIVITY_TYPES[subcommand];

    if (activityType === undefined) {
        console.log(`Unknown type: ${subcommand}`);
        console.log(`Valid types: ${Object.keys(ACTIVITY_TYPES).join(", ")}`);
        return;
    }

    let activityText = args.slice(1).join(" ");
    let streamUrl = null;

    if (activityType === ActivityType.Streaming) {
        const urlMatch = activityText.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            streamUrl = urlMatch[1];
            activityText = activityText.replace(streamUrl, "").trim();
        }

        if (!streamUrl) {
            console.log("Streaming requires a URL!");
            return;
        }
    }

    if (!activityText) {
        console.log("Please provide activity text!");
        return;
    }

    try {
        const activity = {
            name: activityText,
            type: activityType
        };

        if (streamUrl) {
            activity.url = streamUrl;
        }

        await botUser.setPresence({
            activities: [activity]
        });

        // Save to database
        const currentPresence = await yuno.dbCommands.getPresence(yuno.database) || {};
        await yuno.dbCommands.setPresence(yuno.database, {
            type: subcommand,
            text: activityText,
            status: currentPresence.status || 'online',
            streamUrl: streamUrl
        });

        console.log(`Now ${subcommand} ${activityText}${streamUrl ? ` (${streamUrl})` : ""}`);
    } catch (e) {
        console.log(`Failed to set presence: ${e.message}`);
    }
}

module.exports.about = {
    "command": "set-presence",
    "description": "Set the bot's activity status and online presence.",
    "usage": "set-presence <type> <text> | set-presence status <status> | set-presence clear",
    "examples": [
        "set-presence playing with Yukki",
        "set-presence watching over senpai",
        "set-presence listening to Future Diary OST",
        "set-presence streaming My Stream https://twitch.tv/example",
        "set-presence status dnd",
        "set-presence clear"
    ],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": true,
    "onlyMasterUsers": true,
    "aliases": ["presence", "activity", "setstatus"]
}

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

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length < 1) {
        const settings = await yuno.dbCommands.getLogSettings(yuno.database, msg.guild.id);
        return msg.channel.send(`**Current Log Settings:**
• **Flush Interval:** ${settings.flushInterval} seconds
• **Max Buffer Size:** ${settings.maxBufferSize} entries

**Usage:**
\`set-logsettings interval <10-300>\` - Seconds between log batches
\`set-logsettings buffer <10-100>\` - Max entries before force flush

Lower interval = more frequent updates (more API calls)
Higher interval = more grouped logs (more efficient)`);
    }

    const subcommand = args[0].toLowerCase();
    const settings = await yuno.dbCommands.getLogSettings(yuno.database, msg.guild.id);

    switch (subcommand) {
        case "interval":
        case "flush":
            if (args.length < 2) {
                return msg.channel.send(":negative_squared_cross_mark: Please specify the flush interval in seconds (10-300).");
            }
            const interval = parseInt(args[1]);
            if (isNaN(interval)) {
                return msg.channel.send(":negative_squared_cross_mark: Please provide a valid number.");
            }
            if (interval < 10 || interval > 300) {
                return msg.channel.send(":negative_squared_cross_mark: Interval must be between **10** and **300** seconds.\n• 10s minimum to respect Discord API rate limits\n• 300s (5 min) maximum for timely logs");
            }
            settings.flushInterval = interval;
            await yuno.dbCommands.setLogSettings(yuno.database, msg.guild.id, settings);
            return msg.channel.send(`:white_check_mark: Log flush interval set to **${interval} seconds**.`);

        case "buffer":
        case "max":
        case "size":
            if (args.length < 2) {
                return msg.channel.send(":negative_squared_cross_mark: Please specify the max buffer size (10-100).");
            }
            const size = parseInt(args[1]);
            if (isNaN(size)) {
                return msg.channel.send(":negative_squared_cross_mark: Please provide a valid number.");
            }
            if (size < 10 || size > 100) {
                return msg.channel.send(":negative_squared_cross_mark: Buffer size must be between **10** and **100** entries.");
            }
            settings.maxBufferSize = size;
            await yuno.dbCommands.setLogSettings(yuno.database, msg.guild.id, settings);
            return msg.channel.send(`:white_check_mark: Max buffer size set to **${size} entries**.\nLogs will be sent when this many events accumulate (even before the interval).`);

        default:
            return msg.channel.send(`:negative_squared_cross_mark: Unknown setting: \`${subcommand}\`
Valid settings: \`interval\`, \`buffer\``);
    }
}

module.exports.about = {
    "command": "set-logsettings",
    "description": "Configure log batching settings (flush interval and buffer size).",
    "usage": "set-logsettings [setting] [value]",
    "examples": [
        "set-logsettings",
        "set-logsettings interval 60",
        "set-logsettings buffer 25"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["logsettings", "logconfig"],
    "onlyMasterUsers": true
}

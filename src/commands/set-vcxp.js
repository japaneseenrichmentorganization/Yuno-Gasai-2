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
        return msg.channel.send(`:negative_squared_cross_mark: Not enough arguments.
Usage:
\`set-vcxp enable\` - Enable VC XP
\`set-vcxp disable\` - Disable VC XP
\`set-vcxp rate <xp>\` - Set XP per interval (default: 10)
\`set-vcxp interval <seconds>\` - Set time interval in seconds (default: 300)
\`set-vcxp ignore-afk <true|false>\` - Ignore AFK channel (default: true)`);
    }

    const subcommand = args[0].toLowerCase();
    const config = await yuno.dbCommands.getVcXpConfig(yuno.database, msg.guild.id);

    switch (subcommand) {
        case "enable":
            config.enabled = true;
            await yuno.dbCommands.setVcXpConfig(yuno.database, msg.guild.id, config);
            return msg.channel.send(`:white_check_mark: Voice channel XP is now **enabled**.
Users will earn **${config.xpPerInterval} XP** every **${config.intervalSeconds} seconds** in voice channels.`);

        case "disable":
            config.enabled = false;
            await yuno.dbCommands.setVcXpConfig(yuno.database, msg.guild.id, config);
            return msg.channel.send(":white_check_mark: Voice channel XP is now **disabled**.");

        case "rate":
            if (args.length < 2) {
                return msg.channel.send(":negative_squared_cross_mark: Please specify the XP amount. Usage: `set-vcxp rate <xp>`");
            }
            const xp = parseInt(args[1]);
            if (isNaN(xp) || xp < 1 || xp > 1000) {
                return msg.channel.send(":negative_squared_cross_mark: XP must be a number between 1 and 1000.");
            }
            config.xpPerInterval = xp;
            await yuno.dbCommands.setVcXpConfig(yuno.database, msg.guild.id, config);
            return msg.channel.send(`:white_check_mark: VC XP rate set to **${xp} XP** per interval.`);

        case "interval":
            if (args.length < 2) {
                return msg.channel.send(":negative_squared_cross_mark: Please specify the interval in seconds. Usage: `set-vcxp interval <seconds>`");
            }
            const interval = parseInt(args[1]);
            if (isNaN(interval) || interval < 60 || interval > 3600) {
                return msg.channel.send(":negative_squared_cross_mark: Interval must be between 60 and 3600 seconds (1 minute to 1 hour).");
            }
            config.intervalSeconds = interval;
            await yuno.dbCommands.setVcXpConfig(yuno.database, msg.guild.id, config);
            return msg.channel.send(`:white_check_mark: VC XP interval set to **${interval} seconds** (${Math.floor(interval / 60)} minutes).`);

        case "ignore-afk":
        case "ignoreafk":
            if (args.length < 2) {
                return msg.channel.send(":negative_squared_cross_mark: Please specify true or false. Usage: `set-vcxp ignore-afk <true|false>`");
            }
            const ignoreAfk = args[1].toLowerCase() === "true" || args[1] === "1" || args[1].toLowerCase() === "yes";
            config.ignoreAfkChannel = ignoreAfk;
            await yuno.dbCommands.setVcXpConfig(yuno.database, msg.guild.id, config);
            if (ignoreAfk) {
                return msg.channel.send(":white_check_mark: AFK channel will be **ignored** for VC XP.");
            } else {
                return msg.channel.send(":white_check_mark: AFK channel will **grant** VC XP.");
            }

        default:
            return msg.channel.send(`:negative_squared_cross_mark: Unknown subcommand: \`${subcommand}\`
Valid subcommands: \`enable\`, \`disable\`, \`rate\`, \`interval\`, \`ignore-afk\``);
    }
}

module.exports.about = {
    "command": "set-vcxp",
    "description": "Configure voice channel XP settings. VC XP is added to the main XP system.",
    "usage": "set-vcxp <subcommand> [value]",
    "examples": [
        "set-vcxp enable",
        "set-vcxp disable",
        "set-vcxp rate 15",
        "set-vcxp interval 300",
        "set-vcxp ignore-afk true"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["vcxp", "voicexp"],
    "onlyMasterUsers": true
}

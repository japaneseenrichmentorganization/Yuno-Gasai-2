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

// Lookup table for enable/disable patterns
const TOGGLE_PATTERNS = [
    { prefix: "enab", value: true },
    { prefix: "tru", value: true },
    { prefix: "disab", value: false },
    { prefix: "fa", value: false }
];

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length === 0) {
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");
    }

    const thing = args[0].toLowerCase();
    const match = TOGGLE_PATTERNS.find(({ prefix }) => thing.startsWith(prefix));
    const to = match?.value ?? null;

    if (to === null) {
        const examples = TOGGLE_PATTERNS.map(p => p.prefix).concat(["enable", "disable", "true", "false"]);
        return msg.channel.send(`Couldn't determine whether you wanted to enable or disable the spamfilter. Some examples: \`\`\`${examples.join("\n")}\`\`\``);
    }

    await yuno.dbCommands.setSpamFilterEnabled(yuno.database, msg.guild.id, thing);
    yuno._refreshMod("message-processors");
    return msg.channel.send(`Spamfilter is now ${to ? "enabled" : "disabled"} on this guild.\nEffects will appear in a few seconds.`);
}

module.exports.about = {
    "command": "set-spamfilter",
    "description": "__Enables__ or __Disables__ the spamfilter for the current guild.",
    "examples": ["set-spamfilter true", "set-spamfilter false", "set-spamfilter enable"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "ssf",
    "onlyMasterUsers": true
}
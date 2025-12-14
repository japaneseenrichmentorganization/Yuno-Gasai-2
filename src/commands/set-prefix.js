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
    let prefix = "!";

    if (args.length === 0)
        prefix = yuno.config.get("commands.default-prefix");
    else
        prefix = args[0];

    const oldPrefixes = await yuno.dbCommands.getPrefixes(yuno.database);

    let oldPrefix;
    if (Object.keys(oldPrefixes).includes(msg.guild.id))
        oldPrefix = oldPrefixes[msg.guild.id];
    else
        oldPrefix = yuno.config.get("commands.default-prefix");

    if (oldPrefix === prefix)
        return msg.channel.send(":negative_squared_cross_mark: The prefix you gave is the actual prefix. No changes has been made.");

    await yuno.dbCommands.setPrefix(yuno.database, msg.guild.id, prefix);

    yuno._refreshMod("command-executor");
    return await msg.channel.send(":white_check_mark: Prefix changed to : `"+ prefix +" `\n:arrow_right: Hot reloading the command-executor module... Bot may be unresponsive for a few secs.");
}

module.exports.about = {
    "command": "set-prefix",
    "description": "Sets the prefix for the guild.",
    "examples": ["set-prefix !", "\nset-prefix *// sets default*", "\nset-prefix yuno-"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "spref",
    "onlyMasterUsers": true
}
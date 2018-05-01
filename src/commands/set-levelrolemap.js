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
    if (args.length === 0)
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

    let thing = args.join(" ");

    try {
        thing = JSON.parse(thing);
    } catch(e) {
        return msg.channel.send(":negative_squared_cross_mark: Not a valid json object.\nRemember, they should have as key the level and as value the role id!");
    }

    await yuno.dbCommands.setLevelRoleMap(yuno.database, msg.guild.id, thing);
    yuno._refreshMod("message-processors");
    msg.channel.send("Updated!");
}

module.exports.about = {
    "command": "set-levelrolemap",
    "description": "Defines the level role map for this guild.",
    "examples": ["set-levelrolemap [some nice json object right here]"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["slrmap"],
    "onlyMasterUsers": true
}
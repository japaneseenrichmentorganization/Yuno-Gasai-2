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

module.exports.runTerminal = async function(yuno, args) {
    if (args.length === 0 || isNaN(parseInt(args[0], 10)))
        return yuno.prompt.error("Please give the id of the guild in argument.")

    await yuno.dbCommands.initGuild(yuno.database, args[0]);
    return yuno.prompt.info("Guild successfully inited.");
}

module.exports.run = async function(yuno, author, args, msg) {
    await yuno.dbCommands.initGuild(yuno.database, msg.guild.id);
    msg.channel.send("Guild inited in the database.");
}

module.exports.about = {
    "command": "init-guild",
    "description": "Debug command.",
    "discord": true,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "onlyMasterUsers": true
}
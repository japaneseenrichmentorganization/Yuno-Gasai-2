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
    if (args.length === 0)
        return yuno.prompt.error("May you give some arguments?");

    if (isNaN(parseInt(args[0], 10)))
        return yuno.prompt.error("You have to give the ID of the new master user as first and only argument.");

    const mu = yuno.config.get("commands.master-users");
    mu.push(args[0]);
    yuno.config.set("commands.master-users", mu);

    yuno.config.save();
    yuno.commandMan.configLoaded(yuno, yuno.config);

    yuno.prompt.info(`User with id ${args[0]} added to master users!`);
}

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length === 0)
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

    const user = msg.mentions.members.first()?.id ?? args[0];

    const mu = yuno.config.get("commands.master-users");
    mu.push(user);
    yuno.config.set("commands.master-users", mu);

    yuno.config.save();
    yuno.commandMan.configLoaded(yuno, yuno.config);

    msg.channel.send("User added to master users!");
}

module.exports.about = {
    "command": "add-masteruser",
    "description": "Adds a new master user.",
    "examples": ["add-masteruser @mention", "add-masteruser id"],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": true,
    "aliases": "add-mu",
    "onlyMasterUsers": true
}
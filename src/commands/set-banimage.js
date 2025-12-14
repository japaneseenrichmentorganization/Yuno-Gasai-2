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
        return await msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

    if (!yuno.UTIL.checkIfUrl(args[0]))
        return await msg.channel.send(":negative_squared_cross_mark: The first argument provided isn't a URL as required.");

    let user = msg.member;

    if (msg.mentions.users.size) {
        const target = msg.mentions.users.first();
        const targetMember = msg.guild.members.cache.get(target.id);
        if (targetMember && (yuno.commandMan._isUserMaster(msg.author.id) || msg.member.roles.highest.comparePositionTo(targetMember.roles.highest) > 0))
            user = target;
    }

    const r = await yuno.dbCommands.setBanImage(yuno.database, msg.guild.id, user.id, args[0]);

    if (r[0] === "creating")
        return await msg.channel.send(":white_check_mark: Ban image set!");
    else
        return await msg.channel.send(":white_check_mark: Ban image updated!");
}

module.exports.about = {
    "command": "set-banimage",
    "description": "Defines the ban image for you or someone else.",
    "usage": "set-banimage <url> [user-mention]",
    "examples": ["set-banimage http://imgur.com/i/nicegif.gif", "set-banimage <theurl> @someone"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["sbanimg"],
    "requiredPermissions": ["BAN_MEMBERS"]
}
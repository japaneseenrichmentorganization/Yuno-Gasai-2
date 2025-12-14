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
    let user = msg.member;

    if (msg.mentions.users.size) {
        const target = msg.mentions.users.first();
        const targetMember = msg.guild.members.cache.get(target.id);
        if (targetMember && (yuno.commandMan._isUserMaster(msg.author.id) || msg.member.roles.highest.comparePositionTo(targetMember.roles.highest) > 0))
            user = target;
    }

    await yuno.dbCommands.delBanImage(yuno.database, msg.guild.id, user.id);

    if (user.id === msg.author.id)
        return await msg.channel.send(":white_check_mark: Your ban image has been deleted!");
    else
        return await msg.channel.send(":white_check_mark: **" + (user.user?.username || user.username) + "**'s ban image has been deleted!");
}

module.exports.about = {
    "command": "del-banimage",
    "description": "Deletes the ban image for you or someone else.",
    "usage": "del-banimage [user-mention]",
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["BAN_MEMBERS"]
}
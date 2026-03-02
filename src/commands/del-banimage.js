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

const { resolveTargetMember } = require("../lib/discordHelpers");

module.exports.run = async function(yuno, author, args, msg) {
    const member = resolveTargetMember(msg, yuno);

    await yuno.dbCommands.delBanImage(yuno.database, msg.guild.id, member.id);

    if (member.id === msg.author.id)
        return await msg.channel.send(":white_check_mark: Your ban image has been deleted!");
    else
        return await msg.channel.send(":white_check_mark: **" + member.user.username + "**'s ban image has been deleted!");
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
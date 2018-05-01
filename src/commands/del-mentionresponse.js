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

const {MessageEmbed} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length === 0)
        return msg.channel.send(":negative_squared_cross_mark: Not enough argument.");

    let trigger = args[0];

    let r = await yuno.dbCommands.getMentionResponseFromTrigger(yuno.database, msg.guild.id, trigger);
        alreadyExists = r !== null;

    if (!alreadyExists)
        return msg.channel.send(":negative_squared_cross_mark: There's no mention response for this guild with this trigger.")

    await yuno.dbCommands.delMentionResponse(yuno.database, r.id);

    yuno._refreshMod("message-processors");
    msg.channel.send(":white_check_mark: Mention response deleted!");
}

module.exports.about = {
    "command": "del-mentionresponse",
    "description": "Deletes a mention response.",
    "usage": "del-mentionresponse <trigger>",
    "examples": "del-mentionresponse \"good job\"",
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "onlyMasterUsers": true
}
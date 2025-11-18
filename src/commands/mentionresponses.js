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

const {EmbedBuilder} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    let toSay = [];

    (await yuno.dbCommands.getMentionResponses(yuno.database)).forEach(el => {
        if (el.guildId === msg.guild.id)
            toSay.push("trigger: " + el.trigger + ", response: " + el.response + (el.image !== "null" ? ", image: " + el.image : ""));
    })

    if (toSay.length === 0)
        return "No mention responses found."
    else
        return msg.channel.send(toSay.join("\n"))
}

module.exports.about = {
    "command": "mentionresponses",
    "description": "List mention responses for the actual server.",
    "usage": "mentionresponse",
    "examples": "mentionresponse",
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "onlyMasterUsers": true
}
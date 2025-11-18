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

const FAIL_COLOR = "#ff0000";
const SUCCESS_COLOR = "#43cc24";

// hot-reload things
delete require.cache[require.resolve("../lib/EmbedCmdResponse")];

let EmbedCmdResponse = require("../lib/EmbedCmdResponse");

const {GuildMember} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    args = args.join(" ");

    let reason = "",
        toBanIds = [],
        mutli

    if (args.includes("|")) {
        reason = (args.split("|")[1] + " / Unbanned by " + msg.author.tag).trim();
        args = args.split("|")[0];
    } else {
        reason = "Unbanned by " + msg.author.tag
    }

    let toBanThings = args.split(" ")

    toBanThings.forEach(function(e) {
        // Skip empty strings and user mentions (starts with <@)
        if (e.trim() !== "" && !e.startsWith("<@")) {
            msg.guild.members.unban(e, reason).then(function() {
                msg.channel.send({embeds: [new EmbedCmdResponse()
                    .setColor(SUCCESS_COLOR)
                    .setTitle(":white_check_mark: Unban successful.")
                    .setDescription(":arrow_right: User with id", e, "has been successfully unbanned.")
                    .setCMDRequester(msg.member)]});
            }).catch(function(err) {
                msg.channel.send({embeds: [new EmbedCmdResponse()
                    .setColor(FAIL_COLOR)
                    .setTitle(":negative_squared_cross_mark: Unban failed.")
                    .setDescription(":arrow_right: Failed to unban", e, ":", err.message)
                    .setCMDRequester(msg.member)]});
            })
        }
    })
}

module.exports.about = {
    "command": "unban",
    "description": "Unbans an user",
    "usage": "unban <@user-mention | id>",
    "examples": ["unban @someone [anotherid] | reason"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["BAN_MEMBERS"]
}
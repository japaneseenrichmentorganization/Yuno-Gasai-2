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
        reason = (args.split("|")[1] + " / Banned by " + msg.author.tag).trim();
        args = args.split("|")[0];
    } else {
        reason = "Banned by " + msg.author.tag
    }

    let toBanThings = args.split(" "),
        userMentions = Array.from(msg.mentions.users.values());

    for(let i = 0; i < toBanThings.length; i++) {
        let e = toBanThings[i];
        if (!(e.indexOf("<") > -1) && e.trim() != "") {
            let wantedUser = await msg.guild.members.fetch(e);

            if (wantedUser)
                userMentions.push(wantedUser) && console.log("pushing");
            else
                msg.channel.send({embeds: [new EmbedCmdResponse()
                    .setColor(FAIL_COLOR)
                    .setTitle(":negative_squared_cross_mark: Ban failed.")
                    .setDescription(":arrow_right: Failed to ban user with id", e, ": User with this ID wasn't found in the server.")
                    .setCMDRequester(msg.member)]});
        }
    }

    if (userMentions.length !== 0)
        userMentions.forEach(async u => {
            let target = await msg.guild.members.fetch(u.id);

            //I too like to live dangerously
            /* 
            if (msg.guild.member(target).id === msg.author.id)
                return msg.channel.send(new EmbedCmdResponse()
                    .setColor(FAIL_COLOR)
                    .setTitle(":negative_squared_cross_mark: Ban failed.")
                    .setDescription(":arrow_right: You can also leave the server instead of banning yourself ;)")
                    .setCMDRequester(msg.member));
            */
            
             if (yuno.commandMan._isUserMaster(target))
                 return msg.channel.send({embeds: [new EmbedCmdResponse()
                     .setColor(FAIL_COLOR)
                     .setTitle(":negative_squared_cross_mark: Ban failed.")
                     .setDescription(":arrow_right: Failed to ban user " + target.user.tag + ". The user is on the master list.")
                     .setCMDRequester(msg.member)]});

            let successfulEmbed = (new EmbedCmdResponse()
                    .setColor(SUCCESS_COLOR)
                    .setTitle(":white_check_mark: Ban successful.")
                    .setDescription(":arrow_right: User", target.user.tag, "has been successfully banned.")
                    .setCMDRequester(msg.member)),
                banImage = await yuno.dbCommands.getBanImage(yuno.database, msg.guild.id, msg.author.id);

            if (banImage === null)
                banImage = yuno.config.get("ban.default-image")

            if (banImage !== null && yuno.UTIL.checkIfUrl(banImage))
                successfulEmbed.setImage(banImage);

            msg.guild.members.ban(u.id, {
                "deleteMessageSeconds": 86400,
                "reason": reason
            }).then(function() {
                msg.channel.send({embeds: [successfulEmbed]});
            }).catch(function(err) {
                msg.channel.send({embeds: [new EmbedCmdResponse()
                    .setColor(FAIL_COLOR)
                    .setTitle(":negative_squared_cross_mark: Ban failed.")
                    .setDescription(":arrow_right: Failed to ban", target.user.tag, ":", err.message)
                    .setCMDRequester(msg.member)]});
            })
        })
    else
        msg.channel.send(":negative_squared_cross_mark: No users mentioned.")
}

module.exports.about = {
    "command": "ban",
    "description": "Bans an user",
    "examples": ["ban <id> [anotherid] | reason", "ban @someone [id] [againananotherid] | reason",
        "ban @someone"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["BAN_MEMBERS"],
    "aliases": ["bean", "banne"],
    "dangerous": true
}

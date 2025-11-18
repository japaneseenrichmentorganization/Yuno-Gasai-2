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
const fs = require("fs");
const {PermissionsBitField} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    if (!msg.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return msg.channel.send('No permission to');

    let guid = msg.guild.id;

    msg.guild.bans.fetch().then(bans => {
        let arr = Array.from(bans.values()),
        json = [];

    arr.forEach((el, ind, arr) => {
        json.push(el.user.id);
    });

    let banstr = JSON.stringify(json);

    fs.writeFile("./BANS-" + guid + ".txt", banstr, (err) => {
        if (err)
            msg.channel.send("Error while saving bans :( :" + err.code);
        else
            msg.channel.send("Bans saved with the Guild ID (use it to re-apply bans) : " + guid);
        })
    })
}

module.exports.about = {
    "command": "exportbans",
    "description": "Export the banlist to a .txt",
    "examples": ["exportbans"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "ebans",
    "onlyMasterUsers": true
}
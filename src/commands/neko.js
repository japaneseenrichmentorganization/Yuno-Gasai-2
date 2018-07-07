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
const {MessageEmbed} = require('discord.js');
const snekfetch = require('snekfetch');

module.exports.run = async function(yuno, author, args, msg) {
    let url = 'https://nekos.life/api';

    if (args[0] === 'lewd') {
        if (!msg.channel.nsfw) {
            return msg.channel.send('I don\'t think I\'m allowed to post those here... Maybe try a NSFW marked channel?');
        }
        url += '/lewd/neko';
    } else {
        url += '/neko';
    }

    const res = await snekfetch.get(url);
    msg.channel.send(new MessageEmbed()
        .setImage(res.body.neko)
        .setFooter(`Requested by ${msg.author.tag}`))
}

module.exports.about = {
    "command": "neko",
    "description": "Get a picture of a neko.",
    "examples": ["Neko | Neko Lewd in a NSFW marked channel to get lewd images"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "nya",
    "onlyMasterUsers": false
}
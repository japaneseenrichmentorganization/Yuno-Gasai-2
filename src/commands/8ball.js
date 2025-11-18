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
const ballResponse = require('../data/ballResponses.json')

module.exports.run = async function(yuno, author, args, msg) {
    if (!args[0]) {
        return msg.channel.send("What do you want to ask the Magic 8 ball?");
    }

    if (msg.content.endsWith("?")) {
        const result = `${ballResponse[Math.floor(Math.random() * ballResponse.length)]}`
        msg.channel.send({embeds: [new EmbedBuilder()
                .setTitle('🎱 Magic 8 Ball 🎱')
                .setDescription(result)
                .setColor(0x000000)
            ]})
    } else {
        msg.channel.send('Was that a question? Try asking again with a question mark at the end.')
    }
};

module.exports.about = {
    "command": "8ball",
    "description": "Use the magic 8 ball",
    "examples": ["8ball how is the weather today?"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "eightBall",
    "onlyMasterUsers": false
};
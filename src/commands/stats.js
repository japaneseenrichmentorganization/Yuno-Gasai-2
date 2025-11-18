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

const moment = require("moment");
    require("moment-duration-format");
const totalMem = require("os").totalmem();
const { version, EmbedBuilder } = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    msg.channel.send({embeds: [new EmbedBuilder()
        .setColor(0xe983b9)
        .setTitle(`Yuno ${yuno.version}`)
        .addFields(
            { name: 'Uptime', value: moment.duration(process.uptime(), 'seconds').format('dd:hh:mm:ss'), inline: true },
            { name: 'RAM Usage', value: `${(process.memoryUsage().rss / 1048576).toFixed()}MB/${(totalMem > 1073741824 ? `${(totalMem / 1073741824).toFixed(1)} GB` : `${(totalMem / 1048576).toFixed()} MB`)}\n(${(process.memoryUsage().rss / totalMem * 100).toFixed(2)}%)`, inline: true },
            { name: 'System Info', value: `${process.platform} (${process.arch})\n${(totalMem > 1073741824 ? `${(totalMem / 1073741824).toFixed(1)} GB` : `${(totalMem / 1048576).toFixed(2)} MB`)}`, inline: true },
            { name: 'Libraries', value: `[Yuno Gasai](https://github.com/japaneseenrichmentorganization/Yuno-Gasai-2) v${yuno.version}\n[Node.js](https://nodejs.org) ${process.version}\n[Discord.js](https://discord.js.org) v${version}`, inline: true }
        )
    ]});
};

module.exports.about = {
    "command": "stats",
    "description": "Get the information about Yuno",
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "inf",
    "onlyMasterUsers": false
};
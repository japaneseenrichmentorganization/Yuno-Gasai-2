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

const totalMem = require("os").totalmem();
const { version, EmbedBuilder } = require("discord.js");

/**
 * Format uptime duration in dd:hh:mm:ss format
 * Native replacement for moment-duration-format
 * @param {number} totalSeconds - Total seconds of uptime
 * @returns {string} Formatted duration string
 */
function formatUptime(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];
    if (days > 0) parts.push(String(days).padStart(2, '0'));
    parts.push(String(hours).padStart(2, '0'));
    parts.push(String(minutes).padStart(2, '0'));
    parts.push(String(seconds).padStart(2, '0'));

    return parts.join(':');
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes
 * @returns {string}
 */
function formatMemory(bytes) {
    if (bytes >= 1073741824) {
        return `${(bytes / 1073741824).toFixed(1)} GB`;
    }
    return `${(bytes / 1048576).toFixed()} MB`;
}

module.exports.run = async function(yuno, author, args, msg) {
    const memUsage = process.memoryUsage();
    const uptime = formatUptime(process.uptime());
    const ramUsed = formatMemory(memUsage.rss);
    const ramTotal = formatMemory(totalMem);
    const ramPercent = (memUsage.rss / totalMem * 100).toFixed(2);

    msg.channel.send({embeds: [new EmbedBuilder()
        .setColor(0xe983b9)
        .setTitle(`Yuno ${yuno.version}`)
        .addFields(
            { name: 'Uptime', value: uptime, inline: true },
            { name: 'RAM Usage', value: `${ramUsed}/${ramTotal}\n(${ramPercent}%)`, inline: true },
            { name: 'System Info', value: `${process.platform} (${process.arch})\n${ramTotal}`, inline: true },
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

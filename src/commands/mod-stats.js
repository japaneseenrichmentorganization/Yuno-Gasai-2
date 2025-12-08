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

const {GuildMember, EmbedBuilder} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    let g = msg.guild,
        bans = await msg.guild.bans.fetch();

    // TODO
}

module.exports.about = {
    "command": "mod-stats",
    "description": "Give some stats about moderators.",
    "examples": ["mod-stats"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["ManageRoles"],
    "aliases": "ms"
}
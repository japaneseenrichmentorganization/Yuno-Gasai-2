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

module.exports.run = async function(yuno, author, args, msg) {
    if (!msg.mentions.channels.size)
        return msg.channel.send("Please mention a channel.");

    const channel = msg.mentions.channels.first();

    yuno.config.set("errors.dropon", {
        "guild": msg.guild.id,
        "channel": channel.name
    });

    await yuno._refreshMod("bot-errors");
    await msg.channel.send(`:white_check_mark: Errors will now be sent to ${channel}.`);
}

module.exports.about = {
    "command": "drop-errors-on",
    "description": "Defines the channel where errors will be dropped..",
    "examples": ["drop-errors-on #channel-mention"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["drop-err-on"],
    "onlyMasterUsers": true
}
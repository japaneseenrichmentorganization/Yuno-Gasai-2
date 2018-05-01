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

const {MessageEmbed} = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length === 0)
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

    let title, desc,
        guildid = msg.guild.id;

    if (args.length === 1) {
        desc = args[0].replace(new RegExp("_", "gi"), " ");
        msg.channel.send(":warning: No title given. The given title will be the description's embed.");
    } else {
        title = args[0].replace(new RegExp("_", "gi"), " ");
        desc = args.slice(1).join(" ");
    }

    if (typeof desc === "string")
        await yuno.dbCommands.setJoinDMMessage(yuno.database, guildid, desc);
    else
        desc = await yuno.dbCommands.getJoinDMMessages(yuno.database)[guildid];

    if (typeof title === "string")
        await yuno.dbCommands.setJoinDMMessageTitle(yuno.database, guildid, title);
    else
        title = await yuno.dbCommands.getJoinDMMessagesTitles(yuno.database)[guildid];

    yuno._refreshMod("join-dm-msg");

    msg.channel.send(new MessageEmbed()
        .setTitle(":white_check_mark:")
        .addField("DM Message's title", typeof title === "string" ? title : "none", true)
        .addField("DM Message's description", desc, true)
        .setFooter("Changes may take some time to appear.")
        .setColor("#43cc24"))
}

module.exports.about = {
    "command": "set-joinmessage",
    "description": "Sets the join message's title & description.\nWrite null as desc or title to don't write the desc. or the title.",
    "examples": ["set-join-message TITLE_WITH_NICE_SPACES DESC AND More spaaaces and even #channels", "\nset-join DESC", "\nsjm null null *no message*", "\nsjm \"well you can use quotes\" \"this is some nice quotes right here\""],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "sjm",
    "onlyMasterUsers": true
}
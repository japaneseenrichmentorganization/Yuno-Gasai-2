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
    if (args.length <= 1)
        return msg.channel.send(":negative_squared_cross_mark: Not enough argument.");

    let trigger = args[0],
        response = args[1]
        image = args[args.length - 1];

    if (!yuno.UTIL.checkIfUrl(image))
        image = null;
        
    let alreadyExists = (await yuno.dbCommands.getMentionResponseFromTrigger(yuno.database, msg.guild.id, trigger)) !== null;

    if (alreadyExists)
        return msg.channel.send(":negative_squared_cross_mark: This guild already has a trigger for this.")

    let r = await yuno.dbCommands.addMentionResponses(yuno.database, msg.guild.id, trigger, response, image);
    yuno._refreshMod("message-processors");
    msg.channel.send(new MessageEmbed()
        .setTitle(":white_check_mark: Mention response added.")
        .addField("Trigger", trigger, true)
        .addField("Response", response, true)
        .addField("Image", typeof image === "string" ? image : "None.", true)
        .setColor("#43cc24"));
}

module.exports.about = {
    "command": "add-mentionresponse",
    "description": "Adds a mention response.",
    "usage": "add-mentionresponse \"<trigger>\" \"<response>\" [image]",
    "examples": "add-mentionresponse \"good job\" \"${author} woah nice thing\"",
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "onlyMasterUsers": true
}
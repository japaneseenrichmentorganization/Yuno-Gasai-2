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

const { EmbedBuilder } = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length <= 1)
        return msg.channel.send(":negative_squared_cross_mark: You must provide a trigger and response, url is not required.");

    const { database } = yuno;
    const { id: guildId } = msg.guild;
    const trigger = args[0];
    const response = args[1];
    const image = yuno.UTIL.checkIfUrl(args[args.length - 1]) ? args[args.length - 1] : null;

    const existing = await yuno.dbCommands.getMentionResponseFromTrigger(database, guildId, trigger);
    if (existing) return msg.channel.send(":negative_squared_cross_mark: This guild already has a trigger for this.");

    await yuno.dbCommands.addMentionResponses(database, guildId, trigger, response, image);
    yuno._refreshMod("message-processors");

    msg.channel.send({
        embeds: [new EmbedBuilder()
            .setTitle(":white_check_mark: Mention response added.")
            .addFields([
                { name: "Trigger", value: trigger, inline: true },
                { name: "Response", value: response, inline: true },
                { name: "Image", value: image ?? "None.", inline: true }
            ])
            .setColor("#43cc24")
        ]
    });
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
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

module.exports.run = async function(yuno, author, args, msg) {
    if (!msg.mentions.channels.size)
        return msg.channel.send("Please mention a channel.");

    let ch = msg.mentions.channels.first();

    if (args[0] === "--force") {
        let confirmmsg = await msg.channel.send({embeds: [new EmbedBuilder().setColor("#42d7f4").setTitle("Confirm channel clear.").setDescription("This will **instantly** clean this channel, __without any warning__.\n\nConfirm by sending `yes`. You have 10s to answer.\nSending any other message will cancel the clean")]}),
            coll = msg.channel.createMessageCollector(m => msg.author.id === m.author.id, { time: 10000 })

        coll.on("collect", async(m) => {
            if (m.content.toLowerCase() === "yes") {
                try {
                    (await yuno.UTIL.clean(ch)).send({embeds: [new EmbedBuilder()
                    .setImage("https://vignette3.wikia.nocookie.net/futurediary/images/9/94/Mirai_Nikki_-_06_-_Large_05.jpg")
                    .setAuthor({name: "Yuno is done cleaning.", iconURL: yuno.UTIL.getAvatarURL(yuno.dC.user)})
                    .setColor("#ff51ff")]});
                } catch(e) {
                    msg.author.send("Cleaning failed: ```" + e.message + "```" + "```" + e.stack + "```");
                }
            }
            coll.stop();
        })
    } else {
        let clean = await yuno.dbCommands.getClean(yuno.database, msg.guild.id, ch.name);

        if (clean === null)
            return msg.channel.send(":negative_squared_cross_mark: There's no auto-clean for this channel.");
        else {
            yuno.dbCommands.setClean(yuno.database, msg.guild.id, ch.name, clean.timeFEachClean, clean.timeBeforeClean, clean.timeBeforeClean)
            return msg.channel.send("Clean commencing in " + clean.timeBeforeClean + " minutes.")
        }
    }
}

module.exports.about = {
    "command": "clean",
    "description": "Cleans a channel.",
    "usage": "clean [--force]",
    "examples": ["clean #channel-mention"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "auto-clean clean",
    "requiredPermissions": ["MANAGE_MESSAGES"],
    "onlyMasterUsers": false
}

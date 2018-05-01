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

const {TextChannel, MessageMentions, MessageEmbed} = require("discord.js")

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length === 0)
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

    let ch = msg.mentions.channels.first();

    switch(args[0]) {
        case "remove":
            if (ch instanceof TextChannel) {
                let clean = await yuno.dbCommands.getClean(yuno.database, ch.guild.id, ch.name);
                if (clean === null)
                    return msg.channel.send(":negative_squared_cross_mark: This channel doesn't have any auto-clean set up.")

                await yuno.dbCommands.delClean(yuno.database, ch.guild.id, ch.name);
                yuno.intervalMan.clear("autocleaner-clean-" + ch.guild.id + "-" + ch.name);
                return msg.channel.send(":white_check_mark: The auto-clean has been removed.");
            } else
                return msg.channel.send(":negative_squared_cross_mark: Please mention a channel.")
            break;

        case "clean":
            // a way to do aliases
            return yuno.commandMan.execute(yuno, msg.member, "clean <#dummy-id>", msg)
            break;

        case "reset":
            if (ch instanceof TextChannel) {
                let clean = await yuno.dbCommands.getClean(yuno.database, ch.guild.id, ch.name);

                if (clean === null)
                    return msg.channel.send(":negative_squared_cross_mark: This channel doesn't have any auto-clean set up.")
                else {
                    await yuno.dbCommands.setClean(yuno.database, ch.guild.id, ch.name, clean.timeFEachClean, clean.timeBeforeClean, clean.timeFEachClean * 60)
                    return msg.channel.send(":white_check_mark: Reset!")
                }
            } else
                return msg.channel.send(":negative_squared_cross_mark: Please mention a channel.");
            break;

        case "list":
            if (ch instanceof TextChannel) {
                let clean = await yuno.dbCommands.getClean(yuno.database, ch.guild.id, ch.name);
                if (clean === null)
                    return msg.channel.send(":negative_squared_cross_mark: The auto-clean doesn't exists.");
                return msg.channel.send(new MessageEmbed()
                    .setColor("#ff51ff")
                    .setTitle("#" + ch.name + " auto-clean configuration.")
                    .addField("Time between each clean", ("00" + clean.timeFEachClean).slice(-2) + "h", true)
                    .addField("Warning thrown at", yuno.UTIL.formatDuration(clean.timeBeforeClean * 60) + "remaining", true)
                    .addField("Remaining time before clean", yuno.UTIL.formatDuration(clean.remainingTime * 60) + "", true))
            } else {
                let channels = [];
                
                (await yuno.dbCommands.getCleans(yuno.database)).forEach(el => {
                    if (el.guildId !== msg.guild.id)
                        return;

                    channels.push("#" + el.channelName)
                })

                let message;

                if (channels.length === 0)
                    message = "None.";
                else
                    message = "``` " + channels.join(", ") + " ```"

                return msg.channel.send(new MessageEmbed()
                    .setColor("#ff51ff")
                    .setTitle("Channels having an auto-clean:")
                    .setDescription(message))
            }
            break;

        case "delay":
            if (ch instanceof TextChannel) {
                let clean = await yuno.dbCommands.getClean(yuno.database, ch.guild.id, ch.name);

                if (clean === null)
                    return msg.channel.send(":negative_squared_cross_mark: This channel doesn't have any auto-clean set up.")
                else {
                    await yuno.dbCommands.setClean(yuno.database, ch.guild.id, ch.name, clean.timeFEachClean, clean.timeBeforeClean, clean.remainingTime + parseInt(args[1]))
                    return msg.channel.send(":white_check_mark: Delayed the clean from " + args[1] + " minutes!")
                }
            } else
                return msg.channel.send(":negative_squared_cross_mark: Please mention a channel.");
            break;

        case "add":
        case "edit":
        default:
            if (!(ch instanceof TextChannel))
                return msg.channel.send("Please mention a channel.");

            let betweenCleans = parseInt(args[1]),
                beforeWarning = parseInt(args[2])

            if (args[0] === "add") {
                let c = await yuno.dbCommands.getClean(yuno.database, ch.guild.id, ch.name);

                if (c !== null)
                    return msg.channel.send(":negative_squared_cross_mark: The channel you asked to add an auto-clean already has an auto-clean.\nPlease use `auto-clean edit`.")
            }

            if (args[0] === "add" || args[0] === "edit") {
                betweenCleans = parseInt(args[2]);
                beforeWarning = parseInt(args[3]);
            }

            if (!(typeof betweenCleans === "number" && typeof beforeWarning === "number"))
                return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

            let MAX_INTERVAL_MS = 2147483647;

            if (isNaN(parseInt(betweenCleans)) || isNaN(parseInt(beforeWarning)))
                return msg.channel.send("Between cleans or before warning argument isn't a number.")

            if (betweenCleans <= 0 || beforeWarning <= 0)
                return msg.channel.send("Between cleans and before warning cannot be negative or equal to 0.")

            if (betweenCleans * 60 * 60 * 1000 > MAX_INTERVAL_MS)
                return msg.channel.send("Between cleans must be **less than " + parseInt(MAX_INTERVAL_MS / (60*60*1000)) + "**.")

            if (beforeWarning / 60 >= betweenCleans)
                return msg.channel.send("Before warning cannot be equal or higher than between cleans.")

            let db = await yuno.dbCommands.setClean(yuno.database, msg.guild.id, ch.name, betweenCleans, beforeWarning, null),
                r = db[0]
                nicesentence = "<#" + ch.id + "> will be cleaned every " + betweenCleans + " hours and a warning will be thrown " + beforeWarning + " minutes before."

            yuno._refreshMod("auto-cleaner");

            if (r === "creating")
                return msg.channel.send("Clean created!\n" + nicesentence);
            else
                return msg.channel.send("Clean updated!\n" + nicesentence);
            break;
    }
}

module.exports.about = {
    "command": "auto-clean",
    "description": "Adds an auto-clean for a channel.\nadd is to add a new auto-clean\nremove to delete an auto-clean\nedit to change the delays of an auto-clean\nreset to reset the counter of an a.-c.\nlist to lists all the actives auto-cleans",
    "usage": "auto-clean <add | remove | edit | reset | delay | list> [#channel] [time between cleans in hours | time in minutes to add (delay)] [time for the warning before the clean in minutes, number]",
    "examples": ["auto-clean #channel-mention 1 15 **adds by default**", "auto-clean add #channel-mention 2 15", "auto-clean list #channel"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "autoclean",
    "onlyMasterUsers": true
}
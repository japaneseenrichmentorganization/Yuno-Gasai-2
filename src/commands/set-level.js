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

let whereExpIsEnabled = [];

module.exports.run = async function(yuno, author, args, msg) {
    await fetchWhereExpIsEnabled(yuno);

    if (!whereExpIsEnabled.includes(msg.guild.id))
        return msg.channel.send("Experience counting is __disabled__ on the server.");
    // to edit the database after that experience.js has made any changes.
    setTimeout(async function() {
        if (args.length === 0)
            return msg.channel.send(":negative_squared_cross_mark: Not enough arguments.");

        let givenLvl;

        try {
            givenLvl = parseInt(args[0]);
        } catch(e) {
            return msg.channel.send("The first argument you gave (level) is not an int as expected.");
        }

        let user = msg.member,
            g = msg.guild.id;

        if (msg.mentions.members.size)
            user = msg.mentions.members.first();
        
        if (user.user.bot)
            return msg.channel.send(":robot: Bots doesn't have xp!")

        await yuno.dbCommands.setXPData(yuno.database, g, user.id, 0, givenLvl);


        let xpdata = await yuno.dbCommands.getXPData(yuno.database, msg.guild.id, user.id),
            neededExp = 5 * Math.pow(xpdata.level, 2) + 50 * xpdata.level + 100;

        return msg.channel.send({embeds: [new EmbedBuilder()
            .setAuthor({name: user.displayName + "'s experience card", iconURL: yuno.UTIL.getAvatarURL(user.user)})
            .setTitle("Level has been changed.")
            .setColor("#ff51ff")
            .addFields([
                {name: "Current level", value: xpdata.level.toString(), inline: true},
                {name: "Current exp", value: xpdata.xp.toString(), inline: true},
                {name: "Exp needed until next level (" + (xpdata.level + 1) + ")", value: (neededExp - xpdata.xp).toString()}
            ])]});

    }, 350);
}

let fetchWhereExpIsEnabled = async function(yuno) {
    if (whereExpIsEnabled.length > 0)
        return;

    whereExpIsEnabled = await yuno.dbCommands.getGuildsWhereExpIsEnabled(yuno.database)
}


module.exports.about = {
    "command": "set-level",
    "description": "Sets the given level for a given user.",
    "examples": ["set-level 5", "set-level 8 @[user]"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": "slvl",
    "onlyMasterUsers": true
}
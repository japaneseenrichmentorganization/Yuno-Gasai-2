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

let whereExpIsEnabled = [];

let getAvatarURL = function(user) {
    return user.avatarURL ? user.avatarURL : user.defaultAvatarURL
}

module.exports.run = async function(yuno, author, args, msg) {
    await fetchWhereExpIsEnabled(yuno);

    if (!whereExpIsEnabled.includes(msg.guild.id))
        return msg.channel.send("Experience counting is __disabled__ on the server.");

    let user = msg.member,
        fromid = false;

    if (msg.mentions.users.size)
        user = msg.mentions.members.first();

    if (args.length > 0) {
        let el = args[0];

        (function(el) {
            if (el.indexOf("<") === 0 && el.indexOf(">") === el.length -1)
                if (el.length >= 17 + 3 && el.length <= 19 + 3)
                    if (!isNaN(parseInt(el[5])))
                        return;

            let temp = msg.guild.members.get(el);

            fromid = true;

            if (temp) {
                user = temp;
            }
        })(el);
    }

    try {
        if (user.user.bot) {
            return msg.channel.send(":robot: Bots don't have xp!");
        }
    } catch(err) {
        Yuno.prompt.error(err);
        msg.guild.members.fetch(user.id);
    };

    if (user.id === msg.author.id && args.length > 0 && fromid)
        return msg.channel.send(":negative_squared_cross_mark: Cannot find the asked user. He's maybe not on the server :thinking: ?");

    let xpdata = await yuno.dbCommands.getXPData(yuno.database, msg.guild.id, user.id),
        neededExp = 5 * Math.pow(xpdata.level, 2) + 50 * xpdata.level + 100;

    msg.channel.send(new MessageEmbed()
        .setAuthor(user.displayName + "'s experience card" , yuno.UTIL.getAvatarURL(user.user))
        .setColor("#ff51ff")
        .addField("Current level", xpdata.level, true)
        .addField("Current exp", xpdata.xp, true)
        .addField("Exp needed until next level (" + (xpdata.level + 1) + ")", neededExp - xpdata.xp));
}


let fetchWhereExpIsEnabled = async function(yuno) {
    if (whereExpIsEnabled.length > 0)
        return;

    whereExpIsEnabled = await yuno.dbCommands.getGuildsWhereExpIsEnabled(yuno.database)
}



module.exports.about = {
    "command": "xp",
    "aliases": ["rank", "level", "exp"],
    "list": true,
    "listTerminal": false,
    "discord": true,
    "terminal": false,
    "examples": ["xp @mention", "xp [id]", "xp [name]"]
}
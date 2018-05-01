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

module.exports.messageProcName = "experience"

let guildsWhereExpIsEnabled = [],
    exppermsg = 5,
    yuno;

module.exports.discordConnected = async function(Yuno) {
    guildsWhereExpIsEnabled = await Yuno.dbCommands.getGuildsWhereExpIsEnabled(Yuno.database);
}

module.exports.configLoaded = function(Yuno, config) {
    yuno = Yuno;
    let exppermsg_ = config.get("chat.exppermsg");

    if (typeof exppermsg_ === "number")
        exppermsg = exppermsg_;
    else
        Yuno.prompt.warning("The value chat.exppermsg was expected to be a number, but it's a " + typeof exppermsg_ + ". Using default max-warnings value: " + exppermsg);
}

module.exports.message = async function(content, msg) {
    if (msg.author.bot)
        return;

    let dbCommands = yuno.dbCommands,
        db = yuno.database;
    
    if (!guildsWhereExpIsEnabled.includes(msg.guild.id))
        return;

    let xp = await dbCommands.getXPData(db, msg.guild.id, msg.author.id),
        neededXP = 5 * Math.pow(xp.level, 2) + 50 * xp.level + 100

    xp.xp += exppermsg;

    if (xp.xp >= neededXP) {
        xp.level += 1;
        xp.xp -= neededXP;
    }

    await dbCommands.setXPData(db, msg.guild.id, msg.author.id, xp.xp, xp.level);

    let rolemap = await dbCommands.getLevelRoleMap(db, msg.guild.id);

    if (rolemap === null)
        return;

    if (rolemap && rolemap[xp.level])
        msg.member.roles.add(msg.guild.roles.get(rolemap[xp.level]));
}
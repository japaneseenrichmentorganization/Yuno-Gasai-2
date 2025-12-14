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

// Use Set for O(1) lookup instead of Array O(n)
let guildsWhereExpIsEnabled = new Set(),
    exppermsg = 5,
    yuno;

module.exports.discordConnected = async function(Yuno) {
    const guildsArray = await Yuno.dbCommands.getGuildsWhereExpIsEnabled(Yuno.database);
    guildsWhereExpIsEnabled = new Set(guildsArray);
}

module.exports.configLoaded = function(Yuno, config) {
    yuno = Yuno;
    const exppermsg_ = config.get("chat.exppermsg");

    if (typeof exppermsg_ === "number")
        exppermsg = exppermsg_;
    else
        Yuno.prompt.warning("The value chat.exppermsg was expected to be a number, but it's a " + typeof exppermsg_ + ". Using default max-warnings value: " + exppermsg);
}

module.exports.message = async function(content, msg) {
    // Early returns for invalid messages
    if (msg.author.bot) return;
    if (!guildsWhereExpIsEnabled.has(msg.guild.id)) return;

    const { dbCommands, database: db } = yuno;

    const xp = await dbCommands.getXPData(db, msg.guild.id, msg.author.id);
    const neededXP = 5 * Math.pow(xp.level, 2) + 50 * xp.level + 100;

    let leveledUp = false;
    xp.xp += exppermsg;

    if (xp.xp >= neededXP) {
        xp.level += 1;
        xp.xp -= neededXP;
        leveledUp = true;
    }

    await dbCommands.setXPData(db, msg.guild.id, msg.author.id, xp.xp, xp.level);

    // Only check role map if user leveled up (optimization)
    if (!leveledUp) return;

    const rolemap = await dbCommands.getLevelRoleMap(db, msg.guild.id);
    if (!rolemap || !rolemap[xp.level]) return;

    // Add role with error handling
    const role = msg.guild.roles.cache.get(rolemap[xp.level]);
    if (role) {
        try {
            await msg.member.roles.add(role);
        } catch (e) {
            // Silently fail - role may be higher than bot's role or missing permissions
        }
    }
}

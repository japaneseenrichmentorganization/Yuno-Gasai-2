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

module.exports.modulename = "auto-role-restore";

let DISCORD_EVENTED = false,
    discClient = null,
    memberAddHandler = null;

let discordConnected = async function(Yuno) {
    discClient = Yuno.dC;

    if (!DISCORD_EVENTED) {
        memberAddHandler = async function(member) {
            try {
                // Check if user has XP data in the database
                let xpData = await Yuno.dbCommands.getXPData(Yuno.database, member.guild.id, member.id);

                // If user has XP data and is at level 1 or higher, restore their roles
                if (xpData && xpData.level > 0) {
                    // Get the level role map for this guild
                    let levelRoleMap = await Yuno.dbCommands.getLevelRoleMap(Yuno.database, member.guild.id);

                    if (levelRoleMap && Object.keys(levelRoleMap).length > 0) {
                        let rolesToAssign = [];

                        // Find all roles for user's level and below
                        for (let [level, roleId] of Object.entries(levelRoleMap)) {
                            let levelNum = parseInt(level);
                            if (levelNum <= xpData.level) {
                                try {
                                    let role = await member.guild.roles.fetch(roleId);
                                    if (role && !member.roles.cache.has(roleId)) {
                                        rolesToAssign.push(role);
                                    }
                                } catch(e) {
                                    console.error(`Failed to fetch role ${roleId} for level ${level}:`, e);
                                }
                            }
                        }

                        // Assign all the roles at once
                        if (rolesToAssign.length > 0) {
                            await member.roles.add(rolesToAssign);
                            console.log(`Auto-restored ${rolesToAssign.length} level roles to ${member.user.tag} (Level ${xpData.level}) in ${member.guild.name}`);
                        }
                    }
                }
            } catch(e) {
                // Log error but don't throw - we don't want to crash on rejoins
                console.error("Failed to auto-restore roles on member join:", e.message);
            }
        };

        discClient.on("guildMemberAdd", memberAddHandler);
    }

    DISCORD_EVENTED = true;
};

module.exports.init = function(Yuno, hotReloaded) {
    if (hotReloaded)
        discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected)
}

module.exports.configLoaded = function() {}

module.exports.beforeShutdown = function(Yuno) {
    if (discClient && memberAddHandler) {
        discClient.removeListener("guildMemberAdd", memberAddHandler);
    }
    DISCORD_EVENTED = false;
    memberAddHandler = null;
}

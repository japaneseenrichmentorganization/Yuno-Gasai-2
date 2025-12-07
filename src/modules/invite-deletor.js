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

module.exports.modulename = "invite-deletor";

let DISCORD_EVENTED = false;

let discordConnected = async function(Yuno) {
    if (!DISCORD_EVENTED)
        Yuno.dC.on("guildMemberRemove", async function(member) {
            try {
                const invites = await member.guild.invites.fetch();
                const userInvites = invites.filter(invite => {
                    if (!invite.inviter)
                        return false;
                    return invite.inviter.id === member.id;
                });

                for (const invite of userInvites.values()) {
                    await invite.delete();
                }
            } catch(e) {
                // Bot might not have permission to manage invites
                console.error("Failed to delete invites:", e.message);
            }
        })

    DISCORD_EVENTED = true;
};

module.exports.init = function(Yuno, hotReloaded) {
    if (hotReloaded)
        discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected)
}

module.exports.configLoaded = async function(Yuno, config) {
    let presenceData_ = await config.get("discord.presence");

    if (typeof presenceData_ === "object")
        presenceData = presenceData_; 
}

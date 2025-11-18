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
    // Get the level role map
    let levelRoleMap = await yuno.dbCommands.getLevelRoleMap(yuno.database, msg.guild.id);

    if (levelRoleMap === null || Object.keys(levelRoleMap).length === 0) {
        return msg.channel.send(":negative_squared_cross_mark: No level role map configured for this guild. Use `set-levelrolemap` to configure it first.");
    }

    // Determine the target user
    let user = msg.mentions.members.first();

    if (!user && args.length > 0) {
        // Try to fetch by ID
        try {
            user = await msg.guild.members.fetch(args[0]);
        } catch(e) {
            return msg.channel.send(":negative_squared_cross_mark: Invalid user. Please mention a user or provide a valid user ID.");
        }
    }

    // If no user specified, use the command executor
    if (!user) {
        user = msg.member;
    }

    // Get user's XP data
    let xpData = await yuno.dbCommands.getXPData(yuno.database, msg.guild.id, user.id);

    if (!xpData || xpData.level === 0) {
        return msg.channel.send(`:negative_squared_cross_mark: **${user.displayName}** has no XP data or is at level 0.`);
    }

    // Find all roles that should be assigned (level <= user's level)
    let rolesToAssign = [];
    let roleNames = [];

    for (let [level, roleId] of Object.entries(levelRoleMap)) {
        let levelNum = parseInt(level);
        if (levelNum <= xpData.level) {
            try {
                let role = await msg.guild.roles.fetch(roleId);
                if (role && !user.roles.cache.has(roleId)) {
                    rolesToAssign.push(role);
                    roleNames.push(`${role.name} (Level ${levelNum})`);
                }
            } catch(e) {
                console.error(`Failed to fetch role ${roleId} for level ${level}:`, e);
            }
        }
    }

    if (rolesToAssign.length === 0) {
        return msg.channel.send(`:white_check_mark: **${user.displayName}** already has all roles for their level (${xpData.level}).`);
    }

    // Assign all the roles
    try {
        await user.roles.add(rolesToAssign);

        msg.channel.send({embeds: [new EmbedBuilder()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Level roles synced!")
            .setDescription(`**${user.displayName}** is level **${xpData.level}** and received the following roles:`)
            .addFields({
                name: "Roles Added",
                value: roleNames.join('\n') || 'None'
            })
        ]});
    } catch(e) {
        msg.channel.send(`:negative_squared_cross_mark: Failed to assign roles: ${e.message}`);
        console.error("Failed to assign level roles:", e);
    }
}

module.exports.about = {
    "command": "sync-levelroles",
    "description": "Assigns all level roles at or below a user's current level. If no user specified, applies to yourself.",
    "usage": "sync-levelroles [@user|userID]",
    "examples": ["sync-levelroles", "sync-levelroles @User", "sync-levelroles 123456789"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["syncroles", "fixroles"],
    "onlyMasterUsers": true
}

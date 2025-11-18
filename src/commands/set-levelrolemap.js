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

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length < 2)
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments. Usage: `set-levelrolemap <level> <@role>`");

    // Parse the level number
    let level = parseInt(args[0]);
    if (isNaN(level) || level < 0) {
        return msg.channel.send(":negative_squared_cross_mark: Level must be a positive number.");
    }

    // Get the role from mentions or by ID
    let role = msg.mentions.roles.first();
    if (!role) {
        // Try to parse as role ID
        try {
            role = await msg.guild.roles.fetch(args[1]);
        } catch(e) {
            return msg.channel.send(":negative_squared_cross_mark: Invalid role. Please mention a role or provide a valid role ID.");
        }
    }

    if (!role) {
        return msg.channel.send(":negative_squared_cross_mark: Role not found. Please mention a role or provide a valid role ID.");
    }

    // Get current level role map
    let levelRoleMap = await yuno.dbCommands.getLevelRoleMap(yuno.database, msg.guild.id);

    // If null, initialize empty object
    if (levelRoleMap === null) {
        levelRoleMap = {};
    }

    // Add/update the mapping
    levelRoleMap[level] = role.id;

    // Save back to database
    await yuno.dbCommands.setLevelRoleMap(yuno.database, msg.guild.id, levelRoleMap);
    yuno._refreshMod("message-processors");

    msg.channel.send(`:white_check_mark: Level role map updated! Users who reach level **${level}** will receive the **${role.name}** role.`);
}

module.exports.about = {
    "command": "set-levelrolemap",
    "description": "Maps a level to a role. When users reach that level, they automatically get the role.",
    "usage": "set-levelrolemap <level> <@role>",
    "examples": ["set-levelrolemap 5 @Member", "set-levelrolemap 10 @Active", "set-levelrolemap 25 @Veteran"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["slrmap"],
    "onlyMasterUsers": true
}
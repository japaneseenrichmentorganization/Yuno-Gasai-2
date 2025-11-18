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
        return msg.channel.send(":negative_squared_cross_mark: Not enough arguments. Usage: `mass-setxp <level> <@role>`");

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

    // Send initial message
    const processingMsg = await msg.channel.send(`:hourglass: Processing... Fetching all members with role **${role.name}**...`);

    try {
        // Fetch all guild members (needed to ensure we have all members in cache)
        await msg.guild.members.fetch();

        // Filter members who have the role
        const membersWithRole = msg.guild.members.cache.filter(member => member.roles.cache.has(role.id));

        if (membersWithRole.size === 0) {
            return processingMsg.edit(`:negative_squared_cross_mark: No members found with the role **${role.name}**.`);
        }

        await processingMsg.edit(`:hourglass: Found **${membersWithRole.size}** members with role **${role.name}**. Setting them to level **${level}**...`);

        let successCount = 0;
        let failCount = 0;

        // Set XP to 0 for the target level (fresh at that level)
        // Users will be at the specified level with 0 XP toward the next level
        const xp = 0;

        // Update XP for each member
        for (const [memberId, member] of membersWithRole) {
            // Skip bots
            if (member.user.bot) {
                continue;
            }

            try {
                await yuno.dbCommands.setXPData(yuno.database, msg.guild.id, memberId, xp, level);
                successCount++;
            } catch(e) {
                failCount++;
                console.error(`Failed to set XP for user ${member.user.tag}:`, e);
            }
        }

        // Refresh the experience message processor to pick up changes
        yuno._refreshMod("message-processors");

        await processingMsg.edit(`:white_check_mark: Mass XP update complete!\n\n**Role:** ${role.name}\n**Level set:** ${level}\n**XP set:** ${xp} (fresh at level)\n**Successfully updated:** ${successCount} members\n**Failed:** ${failCount} members\n**Skipped bots:** ${membersWithRole.size - successCount - failCount}`);

    } catch(e) {
        await processingMsg.edit(`:negative_squared_cross_mark: An error occurred while processing: ${e.message}`);
        console.error("Mass XP update error:", e);
    }
}

module.exports.about = {
    "command": "mass-setxp",
    "description": "Sets all members with a specific role to a target level (with 0 XP at that level).",
    "usage": "mass-setxp <level> <@role>",
    "examples": ["mass-setxp 5 @Member", "mass-setxp 10 @Active"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["massxp", "bulkxp"],
    "onlyMasterUsers": true
}

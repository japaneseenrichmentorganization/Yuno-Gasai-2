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

const { EmbedBuilder, PermissionsBitField } = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    const statusMsg = await msg.channel.send(":hourglass: Gathering moderator statistics...");

    try {
        const guild = msg.guild;

        // Get basic guild stats
        const bans = await guild.bans.fetch();
        const totalBans = bans.size;

        // Get members with mod permissions
        const members = await guild.members.fetch();
        const moderators = members.filter(m =>
            m.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
            m.permissions.has(PermissionsBitField.Flags.KickMembers) ||
            m.permissions.has(PermissionsBitField.Flags.BanMembers)
        );

        // Get database stats
        const dbStats = await yuno.dbCommands.getModStats(yuno.database, guild.id);
        const totalTrackedActions = await yuno.dbCommands.getModActionsCount(yuno.database, guild.id);

        // Build action counts object
        const actionTotals = {};
        for (const row of dbStats.actionCounts) {
            actionTotals[row.action] = row.count;
        }

        // Build per-moderator stats
        const modStats = {};
        for (const row of dbStats.modCounts) {
            if (!modStats[row.moderatorId]) {
                modStats[row.moderatorId] = { total: 0 };
            }
            modStats[row.moderatorId][row.action] = row.count;
            modStats[row.moderatorId].total += row.count;
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle(`Moderator Statistics for ${guild.name}`)
            .setColor("#ff69b4")
            .setThumbnail(guild.iconURL())
            .setTimestamp();

        // Guild overview
        embed.addFields({
            name: "Server Overview",
            value: [
                `**Total Members:** ${guild.memberCount}`,
                `**Total Bans:** ${totalBans}`,
                `**Moderators:** ${moderators.size}`,
                `**Tracked Actions:** ${totalTrackedActions}`
            ].join("\n"),
            inline: false
        });

        // Action breakdown
        if (totalTrackedActions > 0) {
            embed.addFields({
                name: "Action Breakdown",
                value: [
                    `**Bans:** ${actionTotals.ban || 0}`,
                    `**Unbans:** ${actionTotals.unban || 0}`,
                    `**Kicks:** ${actionTotals.kick || 0}`,
                    `**Timeouts:** ${actionTotals.timeout || 0}`
                ].join("\n"),
                inline: true
            });
        }

        // Top moderators
        if (dbStats.topMods.length > 0) {
            const topModsText = [];
            for (let i = 0; i < Math.min(5, dbStats.topMods.length); i++) {
                const mod = dbStats.topMods[i];
                let modName = mod.moderatorId;

                // Try to get the username
                try {
                    const member = await guild.members.fetch(mod.moderatorId).catch(() => null);
                    if (member) {
                        modName = member.user.tag;
                    } else {
                        const user = await yuno.dC.users.fetch(mod.moderatorId).catch(() => null);
                        if (user) modName = user.tag;
                    }
                } catch (e) {
                    // Keep the ID if we can't resolve
                }

                const modData = modStats[mod.moderatorId] || {};
                const breakdown = [];
                if (modData.ban) breakdown.push(`${modData.ban} bans`);
                if (modData.kick) breakdown.push(`${modData.kick} kicks`);
                if (modData.timeout) breakdown.push(`${modData.timeout} timeouts`);
                if (modData.unban) breakdown.push(`${modData.unban} unbans`);

                topModsText.push(`**${i + 1}. ${modName}** - ${mod.count} actions\n   ${breakdown.join(", ") || "No details"}`);
            }

            embed.addFields({
                name: "Top Moderators",
                value: topModsText.join("\n\n") || "No data available",
                inline: false
            });
        } else {
            embed.addFields({
                name: "No Tracked Actions",
                value: "Run `.scan-bans` to import moderation history from audit logs.",
                inline: false
            });
        }

        // Footer with help
        embed.setFooter({ text: "Use .scan-bans to import audit log history" });

        await statusMsg.edit({ content: null, embeds: [embed] });

    } catch (e) {
        console.error("mod-stats error:", e);
        await statusMsg.edit(`:x: Error gathering stats: ${e.message}`);
    }
}

module.exports.about = {
    "command": "mod-stats",
    "description": "Show moderator statistics including bans, kicks, and timeouts.",
    "examples": ["mod-stats"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["ManageRoles"],
    "aliases": "ms"
}

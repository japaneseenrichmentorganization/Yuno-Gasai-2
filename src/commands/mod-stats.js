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

        // Fetch everything in parallel instead of sequentially
        // This prevents blocking while waiting for each API call
        const [bans, dbStats, totalTrackedActions] = await Promise.all([
            guild.bans.fetch().catch(() => new Map()), // Don't fail if no ban permission
            yuno.dbCommands.getModStats(yuno.database, guild.id),
            yuno.dbCommands.getModActionsCount(yuno.database, guild.id)
        ]);

        const totalBans = bans.size;

        // Use cached members instead of fetching all (much faster, doesn't block)
        const moderators = guild.members.cache.filter(m =>
            m.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
            m.permissions.has(PermissionsBitField.Flags.KickMembers) ||
            m.permissions.has(PermissionsBitField.Flags.BanMembers)
        );

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
            const topMods = dbStats.topMods.slice(0, 5);

            // Fetch all moderator names in parallel instead of one by one
            const modNamePromises = topMods.map(async (mod) => {
                // Check cache first (instant)
                const cachedMember = guild.members.cache.get(mod.moderatorId);
                if (cachedMember) return cachedMember.user.tag;

                const cachedUser = yuno.dC.users.cache.get(mod.moderatorId);
                if (cachedUser) return cachedUser.tag;

                // Only fetch if not cached, with timeout
                try {
                    const user = await Promise.race([
                        yuno.dC.users.fetch(mod.moderatorId),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
                    ]);
                    return user.tag;
                } catch (e) {
                    return mod.moderatorId; // Fall back to ID
                }
            });

            const modNames = await Promise.all(modNamePromises);

            const topModsText = topMods.map((mod, i) => {
                const modData = modStats[mod.moderatorId] || {};
                const breakdown = [];
                if (modData.ban) breakdown.push(`${modData.ban} bans`);
                if (modData.kick) breakdown.push(`${modData.kick} kicks`);
                if (modData.timeout) breakdown.push(`${modData.timeout} timeouts`);
                if (modData.unban) breakdown.push(`${modData.unban} unbans`);

                return `**${i + 1}. ${modNames[i]}** - ${mod.count} actions\n   ${breakdown.join(", ") || "No details"}`;
            });

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

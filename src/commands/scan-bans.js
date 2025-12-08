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

const { EmbedBuilder, AuditLogEvent } = require("discord.js");

module.exports.run = async function(yuno, author, args, msg) {
    const mode = args[0]?.toLowerCase();

    if (mode === "audit" || mode === "auditlog") {
        return scanAuditLogs(yuno, msg);
    } else if (mode === "bans" || mode === "banlist" || !mode) {
        return scanBanList(yuno, msg);
    } else {
        return msg.channel.send("Usage: `.scan-bans [bans|audit]`\n- `bans` (default): Import all bans from the ban list\n- `audit`: Import from audit logs (includes who banned, but limited history)");
    }
}

async function scanBanList(yuno, msg) {
    const statusMsg = await msg.channel.send(":hourglass: Scanning ban list... This may take a while for large servers.");

    try {
        let totalImported = 0;
        let totalSkipped = 0;
        let totalProcessed = 0;
        let lastBanId = null;
        const batchSize = 1000;

        // First, try to build a map of bans from audit logs (for moderator info)
        await statusMsg.edit(":hourglass: Building audit log cache for moderator info...");
        const auditBanMap = new Map(); // targetId -> { moderatorId, reason, timestamp }

        try {
            let hasMoreAudit = true;
            let lastAuditId = null;

            while (hasMoreAudit) {
                const fetchOptions = { type: AuditLogEvent.MemberBanAdd, limit: 100 };
                if (lastAuditId) fetchOptions.before = lastAuditId;

                const auditLogs = await msg.guild.fetchAuditLogs(fetchOptions);
                const entries = auditLogs.entries;

                if (entries.size === 0) {
                    hasMoreAudit = false;
                    break;
                }

                for (const [id, entry] of entries) {
                    lastAuditId = id;
                    if (entry.target?.id) {
                        auditBanMap.set(entry.target.id, {
                            moderatorId: entry.executor?.id || "unknown",
                            reason: entry.reason,
                            timestamp: entry.createdTimestamp
                        });
                    }
                }

                if (entries.size < 100) hasMoreAudit = false;
            }
        } catch (e) {
            // Audit log access might fail, continue without it
            console.log("Could not fetch audit logs:", e.message);
        }

        await statusMsg.edit(`:hourglass: Found ${auditBanMap.size} bans in audit logs. Now scanning full ban list...`);

        // Now fetch all bans with pagination
        while (true) {
            const fetchOptions = { limit: batchSize };
            if (lastBanId) {
                fetchOptions.after = lastBanId;
            }

            const bans = await msg.guild.bans.fetch(fetchOptions);

            if (bans.size === 0) {
                break;
            }

            for (const [userId, ban] of bans) {
                lastBanId = userId;
                totalProcessed++;

                // Check if we already have this ban in the database
                // Use a simple check - if ANY ban exists for this target in this guild
                const existingBans = await yuno.database.allPromise(
                    "SELECT id FROM modActions WHERE gid = ? AND targetId = ? AND action = 'ban' LIMIT 1",
                    [msg.guild.id, userId]
                );

                if (existingBans.length > 0) {
                    totalSkipped++;
                    continue;
                }

                // Get moderator info from audit cache if available
                const auditInfo = auditBanMap.get(userId);
                const moderatorId = auditInfo?.moderatorId || "unknown";
                const reason = auditInfo?.reason || ban.reason || null;
                const timestamp = auditInfo?.timestamp || Date.now(); // Use current time if unknown

                await yuno.dbCommands.addModAction(
                    yuno.database,
                    msg.guild.id,
                    moderatorId,
                    userId,
                    "ban",
                    reason,
                    timestamp
                );
                totalImported++;

                // Update status every 1000 bans
                if (totalProcessed % 1000 === 0) {
                    await statusMsg.edit(`:hourglass: Processing bans... ${totalProcessed} checked | ${totalImported} imported | ${totalSkipped} skipped`);
                }
            }

            if (bans.size < batchSize) {
                break;
            }

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const unknownMods = totalImported - auditBanMap.size;

        const embed = new EmbedBuilder()
            .setTitle("Ban List Scan Complete")
            .setColor("#00ff00")
            .addFields(
                { name: "Total Processed", value: totalProcessed.toString(), inline: true },
                { name: "Imported", value: totalImported.toString(), inline: true },
                { name: "Skipped (existing)", value: totalSkipped.toString(), inline: true },
                { name: "With Moderator Info", value: Math.min(totalImported, auditBanMap.size).toString(), inline: true },
                { name: "Unknown Moderator", value: Math.max(0, unknownMods).toString(), inline: true }
            )
            .setFooter({ text: "Use .mod-stats to view moderator statistics" })
            .setTimestamp();

        await statusMsg.edit({ content: null, embeds: [embed] });

    } catch (e) {
        console.error("scan-bans error:", e);
        await statusMsg.edit(`:x: Error scanning ban list: ${e.message}`);
    }
}

async function scanAuditLogs(yuno, msg) {
    const statusMsg = await msg.channel.send(":hourglass: Scanning audit logs for moderation actions... This may take a while.");

    try {
        let totalImported = 0;
        let totalSkipped = 0;

        // Scan for bans
        await statusMsg.edit(":hourglass: Scanning ban entries from audit log...");
        let hasMore = true;
        let lastId = null;

        while (hasMore) {
            const fetchOptions = { type: AuditLogEvent.MemberBanAdd, limit: 100 };
            if (lastId) fetchOptions.before = lastId;

            const auditLogs = await msg.guild.fetchAuditLogs(fetchOptions);
            const entries = auditLogs.entries;

            if (entries.size === 0) {
                hasMore = false;
                break;
            }

            for (const [id, entry] of entries) {
                lastId = id;
                const timestamp = entry.createdTimestamp;
                const moderatorId = entry.executor?.id || "unknown";
                const targetId = entry.target?.id;
                const reason = entry.reason;

                if (!targetId) continue;

                const exists = await yuno.dbCommands.modActionExists(
                    yuno.database,
                    msg.guild.id,
                    targetId,
                    "ban",
                    timestamp
                );

                if (exists) {
                    totalSkipped++;
                } else {
                    await yuno.dbCommands.addModAction(
                        yuno.database,
                        msg.guild.id,
                        moderatorId,
                        targetId,
                        "ban",
                        reason,
                        timestamp
                    );
                    totalImported++;
                }
            }

            if (entries.size < 100) hasMore = false;
            await statusMsg.edit(`:hourglass: Scanning bans... Imported: ${totalImported} | Skipped: ${totalSkipped}`);
        }

        // Scan for kicks
        hasMore = true;
        lastId = null;
        await statusMsg.edit(`:hourglass: Scanning kick entries... Imported: ${totalImported}`);

        while (hasMore) {
            const fetchOptions = { type: AuditLogEvent.MemberKick, limit: 100 };
            if (lastId) fetchOptions.before = lastId;

            const auditLogs = await msg.guild.fetchAuditLogs(fetchOptions);
            const entries = auditLogs.entries;

            if (entries.size === 0) {
                hasMore = false;
                break;
            }

            for (const [id, entry] of entries) {
                lastId = id;
                const timestamp = entry.createdTimestamp;
                const moderatorId = entry.executor?.id || "unknown";
                const targetId = entry.target?.id;
                const reason = entry.reason;

                if (!targetId) continue;

                const exists = await yuno.dbCommands.modActionExists(
                    yuno.database,
                    msg.guild.id,
                    targetId,
                    "kick",
                    timestamp
                );

                if (exists) {
                    totalSkipped++;
                } else {
                    await yuno.dbCommands.addModAction(
                        yuno.database,
                        msg.guild.id,
                        moderatorId,
                        targetId,
                        "kick",
                        reason,
                        timestamp
                    );
                    totalImported++;
                }
            }

            if (entries.size < 100) hasMore = false;
        }

        // Scan for unbans
        hasMore = true;
        lastId = null;
        await statusMsg.edit(`:hourglass: Scanning unban entries... Imported: ${totalImported}`);

        while (hasMore) {
            const fetchOptions = { type: AuditLogEvent.MemberBanRemove, limit: 100 };
            if (lastId) fetchOptions.before = lastId;

            const auditLogs = await msg.guild.fetchAuditLogs(fetchOptions);
            const entries = auditLogs.entries;

            if (entries.size === 0) {
                hasMore = false;
                break;
            }

            for (const [id, entry] of entries) {
                lastId = id;
                const timestamp = entry.createdTimestamp;
                const moderatorId = entry.executor?.id || "unknown";
                const targetId = entry.target?.id;
                const reason = entry.reason;

                if (!targetId) continue;

                const exists = await yuno.dbCommands.modActionExists(
                    yuno.database,
                    msg.guild.id,
                    targetId,
                    "unban",
                    timestamp
                );

                if (exists) {
                    totalSkipped++;
                } else {
                    await yuno.dbCommands.addModAction(
                        yuno.database,
                        msg.guild.id,
                        moderatorId,
                        targetId,
                        "unban",
                        reason,
                        timestamp
                    );
                    totalImported++;
                }
            }

            if (entries.size < 100) hasMore = false;
        }

        // Scan for timeouts
        hasMore = true;
        lastId = null;
        await statusMsg.edit(`:hourglass: Scanning timeout entries... Imported: ${totalImported}`);

        while (hasMore) {
            const fetchOptions = { type: AuditLogEvent.MemberUpdate, limit: 100 };
            if (lastId) fetchOptions.before = lastId;

            const auditLogs = await msg.guild.fetchAuditLogs(fetchOptions);
            const entries = auditLogs.entries;

            if (entries.size === 0) {
                hasMore = false;
                break;
            }

            for (const [id, entry] of entries) {
                lastId = id;

                const timeoutChange = entry.changes?.find(c => c.key === "communication_disabled_until");
                if (!timeoutChange || !timeoutChange.new) continue;

                const timestamp = entry.createdTimestamp;
                const moderatorId = entry.executor?.id || "unknown";
                const targetId = entry.target?.id;
                const reason = entry.reason;

                if (!targetId) continue;

                const exists = await yuno.dbCommands.modActionExists(
                    yuno.database,
                    msg.guild.id,
                    targetId,
                    "timeout",
                    timestamp
                );

                if (exists) {
                    totalSkipped++;
                } else {
                    await yuno.dbCommands.addModAction(
                        yuno.database,
                        msg.guild.id,
                        moderatorId,
                        targetId,
                        "timeout",
                        reason,
                        timestamp
                    );
                    totalImported++;
                }
            }

            if (entries.size < 100) hasMore = false;
        }

        const embed = new EmbedBuilder()
            .setTitle("Audit Log Scan Complete")
            .setColor("#00ff00")
            .addFields(
                { name: "Imported", value: totalImported.toString(), inline: true },
                { name: "Skipped (duplicates)", value: totalSkipped.toString(), inline: true }
            )
            .setFooter({ text: "Note: Audit logs only go back ~45 days. Use .scan-bans bans for full ban list." })
            .setTimestamp();

        await statusMsg.edit({ content: null, embeds: [embed] });

    } catch (e) {
        console.error("scan-bans audit error:", e);
        await statusMsg.edit(`:x: Error scanning audit logs: ${e.message}`);
    }
}

module.exports.about = {
    "command": "scan-bans",
    "description": "Import moderation actions into the database.\n- `.scan-bans` or `.scan-bans bans` - Import all bans from ban list (200K+ supported)\n- `.scan-bans audit` - Import from audit logs (includes who banned, ~45 day history)",
    "examples": ["scan-bans", "scan-bans bans", "scan-bans audit"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["BanMembers", "ViewAuditLog"],
    "aliases": ["scanbans", "import-mod-actions"],
    "onlyMasterUsers": true
}

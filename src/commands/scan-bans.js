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
const { setupRateLimitListener, waitForRateLimit } = require("../lib/rateLimitHelper");

// Batch size for parallel processing
const BATCH_SIZE = 50;
const AUDIT_BATCH_SIZE = 100;

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

/**
 * Batch check which mod actions already exist in the database
 * @param {Object} database
 * @param {String} guildId
 * @param {Array} entries - Array of {targetId, action, timestamp?}
 * @returns {Set} Set of keys that already exist
 */
async function batchCheckExists(database, guildId, entries) {
    if (entries.length === 0) return new Set();

    // Build a query to check all entries at once
    const placeholders = entries.map(() => "(?, ?, ?)").join(", ");
    const values = entries.flatMap(e => [guildId, e.targetId, e.action]);

    const results = await database.allPromise(
        `SELECT targetId, action FROM modActions WHERE (gid, targetId, action) IN (VALUES ${placeholders})`,
        values
    );

    return new Set(results.map(r => `${r.targetId}:${r.action}`));
}

/**
 * Batch check with timestamp for audit log entries
 */
async function batchCheckExistsWithTimestamp(database, guildId, entries) {
    if (entries.length === 0) return new Set();

    const placeholders = entries.map(() => "(?, ?, ?, ?)").join(", ");
    const values = entries.flatMap(e => [guildId, e.targetId, e.action, e.timestamp]);

    const results = await database.allPromise(
        `SELECT targetId, action, timestamp FROM modActions WHERE (gid, targetId, action, timestamp) IN (VALUES ${placeholders})`,
        values
    );

    return new Set(results.map(r => `${r.targetId}:${r.action}:${r.timestamp}`));
}

/**
 * Batch insert mod actions
 */
async function batchInsertModActions(database, guildId, actions) {
    if (actions.length === 0) return;

    const placeholders = actions.map(() => "(null, ?, ?, ?, ?, ?, ?)").join(", ");
    const values = actions.flatMap(a => [guildId, a.moderatorId, a.targetId, a.action, a.reason || null, a.timestamp]);

    await database.runPromise(
        `INSERT INTO modActions(id, gid, moderatorId, targetId, action, reason, timestamp) VALUES ${placeholders}`,
        values
    );
}

async function scanBanList(yuno, msg) {
    const statusMsg = await msg.channel.send(":hourglass: Scanning ban list... This may take a while for large servers.");

    // Setup rate limit listener for dynamic delays
    const cleanupRateLimitListener = setupRateLimitListener(yuno.dC);

    try {
        let totalImported = 0;
        let totalSkipped = 0;
        let totalProcessed = 0;
        let totalAutoBans = 0;      // Fully automatic (spam filter, etc.)
        let totalBotCommandBans = 0; // Manual ban via bot command
        let totalManualBans = 0;     // Not through the bot at all
        let totalSelfBans = 0;       // Users who banned themselves (tried to use ban command without perms)
        let lastBanId = null;
        const batchSize = 1000;

        // Initialize guild first
        await yuno.dbCommands.initGuild(yuno.database, msg.guild.id);

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

            // Collect all bans from this batch for batch processing
            const banEntries = [];
            for (const [userId, ban] of bans) {
                lastBanId = userId;
                const auditInfo = auditBanMap.get(userId);
                const reason = auditInfo?.reason || ban.reason || null;

                // Check if this is a bot-executed ban
                // Patterns from the codebase:
                // - "Autobanned by spam filter: reason" (fully automatic)
                // - "reason / Banned by Username#1234" (manual via bot command)
                // - "Banned by Username#1234" (manual via bot command, no reason)
                const isAutoBan = reason && /autobanned?\s+by/i.test(reason);
                const isBotCommandBan = reason && /\/ Banned by |^Banned by /i.test(reason);
                const isBotBan = isAutoBan || isBotCommandBan;

                // Check for self-ban: user banned themselves by using the ban command without perms
                // This happens when the spam filter catches them and the ban reason shows they triggered it
                // Also check if the audit log shows the same user as executor and target
                const isSelfBan = (auditInfo?.moderatorId === userId) ||
                    (isAutoBan && reason && reason.toLowerCase().includes("usage of"));

                banEntries.push({
                    targetId: userId,
                    action: "ban",
                    moderatorId: auditInfo?.moderatorId || "unknown",
                    reason: reason,
                    timestamp: auditInfo?.timestamp || Date.now(),
                    isBotBan: isBotBan,
                    isAutoBan: isAutoBan,
                    isSelfBan: isSelfBan
                });
            }

            // Batch check which bans already exist
            const existingSet = await batchCheckExists(yuno.database, msg.guild.id, banEntries);

            // Filter out existing bans and prepare for batch insert
            const toInsert = [];
            for (const entry of banEntries) {
                totalProcessed++;
                const key = `${entry.targetId}:${entry.action}`;
                if (existingSet.has(key)) {
                    totalSkipped++;
                } else {
                    toInsert.push(entry);
                    // Count ban types (self-bans are counted separately)
                    if (entry.isSelfBan) {
                        totalSelfBans++;
                    } else if (entry.isAutoBan) {
                        totalAutoBans++;
                    } else if (entry.isBotBan) {
                        totalBotCommandBans++;
                    } else {
                        totalManualBans++;
                    }
                }
            }

            // Batch insert new bans
            if (toInsert.length > 0) {
                await batchInsertModActions(yuno.database, msg.guild.id, toInsert);
                totalImported += toInsert.length;
            }

            // Update status every batch
            await statusMsg.edit(`:hourglass: Processing bans... ${totalProcessed} checked | ${totalImported} imported | ${totalSkipped} skipped`);

            if (bans.size < batchSize) {
                break;
            }

            // Dynamic delay based on rate limit status
            await waitForRateLimit(yuno.dC);
        }

        const unknownMods = totalImported - auditBanMap.size;

        const embed = new EmbedBuilder()
            .setTitle("Ban List Scan Complete")
            .setColor("#00ff00")
            .addFields(
                { name: "Total Processed", value: totalProcessed.toString(), inline: true },
                { name: "Imported", value: totalImported.toString(), inline: true },
                { name: "Skipped (existing)", value: totalSkipped.toString(), inline: true },
                { name: "Auto Bans (spam filter)", value: totalAutoBans.toString(), inline: true },
                { name: "Bot Command Bans", value: totalBotCommandBans.toString(), inline: true },
                { name: "Self Bans (no perms)", value: totalSelfBans.toString(), inline: true },
                { name: "Manual/Other Bans", value: totalManualBans.toString(), inline: true },
                { name: "With Moderator Info", value: Math.min(totalImported, auditBanMap.size).toString(), inline: true },
                { name: "Unknown Moderator", value: Math.max(0, unknownMods).toString(), inline: true }
            )
            .setFooter({ text: "Use .mod-stats to view moderator statistics" })
            .setTimestamp();

        await statusMsg.edit({ content: null, embeds: [embed] });

    } catch (e) {
        console.error("scan-bans error:", e);
        await statusMsg.edit(`:x: Error scanning ban list: ${e.message}`);
    } finally {
        cleanupRateLimitListener();
    }
}

/**
 * Fetch all audit log entries of a specific type with batch processing
 * @param {Object} guild - Discord guild
 * @param {number} auditLogType - AuditLogEvent type
 * @param {String} action - Action type string (ban, kick, etc.)
 * @param {Function} filterFn - Optional filter function for entries
 * @returns {Array} Array of action entries
 */
async function fetchAuditLogEntries(guild, auditLogType, action, filterFn = null) {
    const entries = [];
    let hasMore = true;
    let lastId = null;

    while (hasMore) {
        const fetchOptions = { type: auditLogType, limit: AUDIT_BATCH_SIZE };
        if (lastId) fetchOptions.before = lastId;

        const auditLogs = await guild.fetchAuditLogs(fetchOptions);
        const logEntries = auditLogs.entries;

        if (logEntries.size === 0) {
            hasMore = false;
            break;
        }

        for (const [id, entry] of logEntries) {
            lastId = id;

            // Apply custom filter if provided
            if (filterFn && !filterFn(entry)) continue;

            const targetId = entry.target?.id;
            if (!targetId) continue;

            entries.push({
                targetId,
                action,
                moderatorId: entry.executor?.id || "unknown",
                reason: entry.reason,
                timestamp: entry.createdTimestamp
            });
        }

        if (logEntries.size < AUDIT_BATCH_SIZE) hasMore = false;
    }

    return entries;
}

async function scanAuditLogs(yuno, msg) {
    const statusMsg = await msg.channel.send(":hourglass: Scanning audit logs for moderation actions in parallel...");

    // Setup rate limit listener for dynamic delays
    const cleanupRateLimitListener = setupRateLimitListener(yuno.dC);

    try {
        // Initialize guild first
        await yuno.dbCommands.initGuild(yuno.database, msg.guild.id);

        // Fetch all audit log types in parallel
        await statusMsg.edit(":hourglass: Fetching all audit log types in parallel...");

        const [banEntries, kickEntries, unbanEntries, timeoutEntries] = await Promise.all([
            fetchAuditLogEntries(msg.guild, AuditLogEvent.MemberBanAdd, "ban"),
            fetchAuditLogEntries(msg.guild, AuditLogEvent.MemberKick, "kick"),
            fetchAuditLogEntries(msg.guild, AuditLogEvent.MemberBanRemove, "unban"),
            fetchAuditLogEntries(
                msg.guild,
                AuditLogEvent.MemberUpdate,
                "timeout",
                (entry) => {
                    const timeoutChange = entry.changes?.find(c => c.key === "communication_disabled_until");
                    return timeoutChange && timeoutChange.new;
                }
            )
        ]);

        const allEntries = [...banEntries, ...kickEntries, ...unbanEntries, ...timeoutEntries];

        await statusMsg.edit(`:hourglass: Found ${allEntries.length} entries (${banEntries.length} bans, ${kickEntries.length} kicks, ${unbanEntries.length} unbans, ${timeoutEntries.length} timeouts). Processing...`);

        let totalImported = 0;
        let totalSkipped = 0;

        // Process in batches for database operations
        for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
            const batch = allEntries.slice(i, i + BATCH_SIZE);

            // Batch check which entries already exist
            const existingSet = await batchCheckExistsWithTimestamp(yuno.database, msg.guild.id, batch);

            // Filter out existing entries
            const toInsert = [];
            for (const entry of batch) {
                const key = `${entry.targetId}:${entry.action}:${entry.timestamp}`;
                if (existingSet.has(key)) {
                    totalSkipped++;
                } else {
                    toInsert.push(entry);
                }
            }

            // Batch insert new entries
            if (toInsert.length > 0) {
                await batchInsertModActions(yuno.database, msg.guild.id, toInsert);
                totalImported += toInsert.length;
            }

            // Update status every batch
            if ((i + BATCH_SIZE) % (BATCH_SIZE * 5) === 0 || i + BATCH_SIZE >= allEntries.length) {
                await statusMsg.edit(`:hourglass: Processing entries... ${i + batch.length}/${allEntries.length} | Imported: ${totalImported} | Skipped: ${totalSkipped}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("Audit Log Scan Complete")
            .setColor("#00ff00")
            .addFields(
                { name: "Total Entries Found", value: allEntries.length.toString(), inline: true },
                { name: "Imported", value: totalImported.toString(), inline: true },
                { name: "Skipped (duplicates)", value: totalSkipped.toString(), inline: true },
                { name: "Bans", value: banEntries.length.toString(), inline: true },
                { name: "Kicks", value: kickEntries.length.toString(), inline: true },
                { name: "Unbans", value: unbanEntries.length.toString(), inline: true },
                { name: "Timeouts", value: timeoutEntries.length.toString(), inline: true }
            )
            .setFooter({ text: "Note: Audit logs only go back ~45 days. Use .scan-bans bans for full ban list." })
            .setTimestamp();

        await statusMsg.edit({ content: null, embeds: [embed] });

    } catch (e) {
        console.error("scan-bans audit error:", e);
        await statusMsg.edit(`:x: Error scanning audit logs: ${e.message}`);
    } finally {
        cleanupRateLimitListener();
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

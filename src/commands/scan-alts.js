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

"use strict";


const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { AltDetector } = require("discord-alt-detector");
const { setupRateLimitListener, waitForRateLimit } = require("../lib/rateLimitHelper");

const detector = new AltDetector();

// Actionable categories only (skip trusted/normal/highly-trusted)
const ACTIONABLE_CATEGORIES = new Set(["newbie", "suspicious", "highly-suspicious", "mega-suspicious"]);

// Ordered most-severe → least-severe. Used to compute "this category and above" slices.
const CATEGORY_ORDER = ["mega-suspicious", "highly-suspicious", "suspicious", "newbie"];

const CATEGORY_EMOJI = {
    "newbie": "🟠",
    "suspicious": "🔴",
    "highly-suspicious": "🚨",
    "mega-suspicious": "☠️"
};

// Labels and descriptions for per-threshold ban select menu options.
const BAN_THRESHOLD_META = {
    "mega-suspicious":  { label: "☠️ Ban mega-suspicious only",  desc: "Ban only the highest-severity members" },
    "highly-suspicious":{ label: "🚨 Ban highly-suspicious+",    desc: "Ban highly-suspicious and mega-suspicious" },
    "suspicious":       { label: "🔴 Ban suspicious+",           desc: "Ban suspicious, highly-suspicious, and mega-suspicious" },
    "newbie":           { label: "🟠 Ban all flagged (newbie+)", desc: "Ban all flagged members across every category" },
};

// Returns a flat array of GuildMember objects at or above the given category threshold.
function getMembersAtOrAbove(flaggedByCategory, threshold) {
    const idx = CATEGORY_ORDER.indexOf(threshold);
    return CATEGORY_ORDER.slice(0, idx + 1).flatMap(cat => flaggedByCategory[cat].map(f => f.member));
}

// Chunk size for member processing
const CHUNK_SIZE = 50;

module.exports.run = async function(yuno, author, args, msg) {
    if (msg.guild.ownerId !== msg.author.id && !yuno.commandMan._isUserMaster(msg.author.id)) {
        await msg.member.ban({
            deleteMessageSeconds: 86400,
            reason: "User attempted to execute an owner-only command without authorisation."
        }).catch(() => {});
        return;
    }

    const statusMsg = await msg.channel.send(":hourglass: Fetching all guild members... This may take a while for large servers.");

    const cleanupRateLimit = setupRateLimitListener(yuno.dC);

    try {
        // Fetch ALL guild members (Discord.js handles chunking internally when GuildMembers intent is present)
        await statusMsg.edit(":hourglass: Fetching members...");
        const allMembers = await msg.guild.members.fetch();

        const totalScanned = allMembers.size;
        await statusMsg.edit(`:hourglass: Scanning ${totalScanned} members for alt indicators...`);

        // Group flagged members by category
        const flaggedByCategory = {
            "mega-suspicious": [],
            "highly-suspicious": [],
            "suspicious": [],
            "newbie": []
        };

        let processed = 0;
        const memberArray = Array.from(allMembers.values());

        // Process in chunks with rate-limit delays
        for (let i = 0; i < memberArray.length; i += CHUNK_SIZE) {
            const chunk = memberArray.slice(i, i + CHUNK_SIZE);

            for (const member of chunk) {
                if (member.user.bot) continue; // Skip bots

                try {
                    const result = detector.check(member);
                    const category = detector.getCategory(result);

                    if (ACTIONABLE_CATEGORIES.has(category)) {
                        flaggedByCategory[category].push({
                            member,
                            score: result.total,
                            category
                        });
                    }
                } catch (e) {
                    // Skip members that fail scoring (e.g. partial data)
                }

                processed++;
            }

            // Rate-limit-aware delay between chunks
            await waitForRateLimit(yuno.dC);

            // Progress update every 500 members
            if (processed % 500 === 0 && processed > 0) {
                await statusMsg.edit(`:hourglass: Scanned ${processed}/${totalScanned} members...`);
            }
        }

        // Build results
        const allFlagged = [
            ...flaggedByCategory["mega-suspicious"],
            ...flaggedByCategory["highly-suspicious"],
            ...flaggedByCategory["suspicious"],
            ...flaggedByCategory["newbie"]
        ];

        const totalFlagged = allFlagged.length;

        // Build embed
        const embed = new EmbedBuilder()
            .setColor(totalFlagged === 0 ? "#43cc24" : "#ff6600")
            .setTitle(":mag: Alt Scan Complete")
            .addFields(
                { name: "Members Scanned", value: String(totalScanned), inline: true },
                { name: "Flagged", value: String(totalFlagged), inline: true }
            )
            .setTimestamp();

        if (totalFlagged === 0) {
            embed.setDescription(":white_check_mark: No suspicious members found.");
            await statusMsg.edit({ content: null, embeds: [embed] });
            return;
        }

        // Add breakdown per category
        for (const [cat, list] of Object.entries(flaggedByCategory)) {
            if (list.length === 0) continue;
            const emoji = CATEGORY_EMOJI[cat] || "⚠️";
            // Show up to 15 members per category to avoid embed limits
            const display = list.slice(0, 15).map(f => `${f.member.user.tag} (score: ${f.score})`).join("\n");
            const overflow = list.length > 15 ? `\n*...and ${list.length - 15} more*` : "";
            embed.addFields({ name: `${emoji} ${cat} (${list.length})`, value: display + overflow });
        }

        // Check if alt detector has a quarantine role configured
        const config = await yuno.dbCommands.getAltDetectorConfig(yuno.database, msg.guild.id);

        // Build per-threshold ban options — only include a threshold if that category itself
        // has at least one member (avoids redundant entries when adjacent tiers are empty).
        // Each option's count is cumulative: threshold + all more-severe categories above it.
        const banOptions = [];
        for (let i = 0; i < CATEGORY_ORDER.length; i++) {
            const threshold = CATEGORY_ORDER[i];
            if (flaggedByCategory[threshold].length === 0) continue;
            const cumulative = CATEGORY_ORDER.slice(0, i + 1)
                .reduce((n, cat) => n + flaggedByCategory[cat].length, 0);
            const meta = BAN_THRESHOLD_META[threshold];
            banOptions.push({
                label: `${meta.label} (${cumulative})`,
                value: `ban_from_${threshold}`,
                description: meta.desc,
            });
        }

        const options = [
            { label: "Do nothing", value: "none", description: "Keep the report, take no action" },
            { label: `Kick all flagged (${totalFlagged})`, value: "kick", description: "Kick all flagged members from the server" },
            ...banOptions,
        ];

        if (config?.quarantineRoleId) {
            options.push({
                label: `Assign quarantine role (${totalFlagged})`,
                value: "role",
                description: "Assign the configured quarantine role to all flagged members"
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`scan-alts-action-${msg.author.id}`)
            .setPlaceholder("Choose an action for flagged members...")
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await statusMsg.edit({ content: null, embeds: [embed], components: [row] });

        // Collect select menu interaction (60 second timeout, only from command author)
        const collector = msg.channel.createMessageComponentCollector({
            filter: (i) => i.customId === `scan-alts-action-${msg.author.id}` && i.user.id === msg.author.id,
            time: 60000,
            max: 1
        });

        collector.on("collect", async (interaction) => {
            const action = interaction.values[0];

            if (action === "none") {
                await interaction.update({ components: [] });
                return;
            }

            // Determine the target member list based on the selected action.
            let toBan = null;
            if (action.startsWith("ban_from_")) {
                const threshold = action.slice("ban_from_".length);
                toBan = getMembersAtOrAbove(flaggedByCategory, threshold);
            }

            const targetList = toBan ?? allFlagged.map(f => f.member);
            const actionLabel = toBan
                ? BAN_THRESHOLD_META[action.slice("ban_from_".length)]?.label ?? action
                : action;

            await interaction.update({
                content: `:hourglass: Applying **${actionLabel}** to ${targetList.length} member(s)…`,
                components: []
            });

            let succeeded = 0, skipped = 0, failed = 0;
            const reason = `Alt scan bulk action — ${actionLabel} by ${msg.author.tag}`;

            for (const member of targetList) {
                // Never act on master users or the server owner
                if (yuno.commandMan._isUserMaster(member.id) || member.id === msg.guild.ownerId) {
                    skipped++;
                    continue;
                }
                try {
                    if (action === "kick") {
                        await member.kick(reason);
                    } else if (action.startsWith("ban_from_")) {
                        await member.ban({ deleteMessageSeconds: 0, reason });
                    } else if (action === "role" && config?.quarantineRoleId) {
                        const role = await msg.guild.roles.fetch(config.quarantineRoleId);
                        if (role) await member.roles.add(role, reason);
                    }
                    succeeded++;
                } catch (e) {
                    failed++;
                }
                await waitForRateLimit(yuno.dC);
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(failed === 0 ? "#43cc24" : "#ffa500")
                .setTitle(`:white_check_mark: Bulk Action Complete`)
                .setDescription(`**${actionLabel}** applied to flagged members.`)
                .addFields(
                    { name: "Actioned", value: String(succeeded), inline: true },
                    { name: "Skipped",  value: String(skipped),   inline: true },
                    { name: "Failed",   value: String(failed),    inline: true }
                )
                .setTimestamp();

            await statusMsg.edit({ content: null, embeds: [embed, resultEmbed], components: [] });
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                // Timeout — remove the select menu
                statusMsg.edit({ components: [] }).catch(() => {});
            }
        });

    } catch (e) {
        console.error("[ScanAlts] Error during member scan:", e);
        await statusMsg.edit(`:negative_squared_cross_mark: Scan failed: ${e.message}`);
    } finally {
        cleanupRateLimit();
    }
};

module.exports.about = {
    "command": "scan-alts",
    "description": "Scan all existing server members for alt account indicators and optionally apply bulk actions.",
    "examples": [
        "scan-alts"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["ManageGuild", "BanMembers"],
    "aliases": ["scanalts", "altscan"],
    "dangerous": true
};

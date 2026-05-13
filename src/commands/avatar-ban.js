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


const crypto = require("crypto");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { setupRateLimitListener, waitForRateLimit } = require("../lib/rateLimitHelper");

const AVATAR_SIZE      = 256;
const FETCH_TIMEOUT_MS = 15_000;
const BATCH_SIZE       = 15;   // parallel avatar fetches per round
const COLLECTOR_TTL_MS = 120_000;

/**
 * Download url and return its SHA-256 hex digest.
 * Uses global fetch (Node 18+). Times out after FETCH_TIMEOUT_MS.
 */
async function fetchAvatarHash(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        return crypto.createHash("sha256").update(Buffer.from(buf)).digest("hex");
    } finally {
        clearTimeout(timer);
    }
}

module.exports.run = async function(yuno, author, args, msg) {
    // Server-owner-only gate (bot master users also bypass)
    if (msg.guild.ownerId !== msg.author.id && !yuno.commandMan._isUserMaster(msg.author.id)) {
        return msg.channel.send(":lock: This command is restricted to the server owner.");
    }

    const statusMsg = await msg.channel.send(":hourglass: Fetching all guild members…");
    const cleanupRL = setupRateLimitListener(yuno.dC);

    try {
        await msg.guild.members.fetch(); // populate cache
        const allMembers = Array.from(msg.guild.members.cache.values()).filter(m => !m.user.bot);
        const total = allMembers.length;

        await statusMsg.edit(`:hourglass: Scanning ${total} member avatars — this may take a while on large servers…`);

        // --- Categorise members ---
        // "default" = no custom avatar at all (neither global nor server-specific)
        const defaultMembers = [];
        // hash → GuildMember[] for members with custom avatars
        const hashMap = new Map();
        let fetchErrors = 0;
        let processed   = 0;

        for (let i = 0; i < allMembers.length; i += BATCH_SIZE) {
            const batch = allMembers.slice(i, i + BATCH_SIZE);

            // allSettled so one failing fetch doesn't abort the whole batch
            await Promise.allSettled(batch.map(async (member) => {
                if (!member.user.avatar && !member.avatar) {
                    // No custom avatar anywhere — completely default
                    defaultMembers.push(member);
                } else {
                    // displayAvatarURL picks server avatar if set, else global.
                    // forceStatic=true ensures GIFs are hashed as a fixed frame.
                    const url = member.displayAvatarURL({ extension: "png", size: AVATAR_SIZE, forceStatic: true });
                    try {
                        const hash = await fetchAvatarHash(url);
                        if (!hashMap.has(hash)) hashMap.set(hash, []);
                        hashMap.get(hash).push(member);
                    } catch {
                        fetchErrors++;
                    }
                }
                processed++;
            }));

            // Progress update every ~150 members
            if (i > 0 && i % 150 < BATCH_SIZE) {
                await statusMsg.edit(`:hourglass: Scanned ${processed}/${total} avatars…`).catch(() => {});
            }

            await waitForRateLimit(yuno.dC);
        }

        // Duplicate groups: 2+ members sharing the exact same image bytes (same SHA-256)
        const dupeGroups = Array.from(hashMap.values()).filter(g => g.length > 1);
        const dupeCount  = dupeGroups.reduce((n, g) => n + g.length, 0);

        // --- Build result embed ---
        const embed = new EmbedBuilder()
            .setColor(0xff6600)
            .setTitle(":camera: Avatar Scan Complete")
            .addFields(
                { name: "Members Scanned",   value: String(total),                 inline: true },
                { name: "Default Avatar",    value: String(defaultMembers.length),  inline: true },
                { name: "Duplicate Groups",  value: String(dupeGroups.length),     inline: true },
                { name: "In Dupe Groups",    value: String(dupeCount),             inline: true },
                { name: "Fetch Errors",      value: String(fetchErrors),           inline: true },
            )
            .setTimestamp();

        if (dupeGroups.length > 0) {
            const lines = dupeGroups.slice(0, 8)
                .map((g, i) => `**Group ${i + 1}** (${g.length} members): ${g.map(m => m.user.tag).join(", ")}`)
                .join("\n");
            const overflow = dupeGroups.length > 8 ? `\n*…and ${dupeGroups.length - 8} more group(s)*` : "";
            embed.addFields({ name: "Duplicate Groups (preview)", value: (lines + overflow).slice(0, 1024) });
        }

        if (dupeCount === 0 && defaultMembers.length === 0) {
            embed.setColor(0x43cc24).setDescription(":white_check_mark: No duplicate or default avatars found.");
            return await statusMsg.edit({ content: null, embeds: [embed] });
        }

        // --- Interactive confirmation buttons ---
        // Use msg.id (unique per invocation) so multiple runs don't collide.
        const mkId = (action) => `avban-${action}-${msg.id}`;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(mkId("dupes"))
                .setLabel(`Ban duplicate avatars (${dupeCount})`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(dupeCount === 0),
            new ButtonBuilder()
                .setCustomId(mkId("default"))
                .setLabel(`Ban default avatars (${defaultMembers.length})`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(defaultMembers.length === 0),
            new ButtonBuilder()
                .setCustomId(mkId("both"))
                .setLabel(`Ban both (${dupeCount + defaultMembers.length})`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(dupeCount === 0 || defaultMembers.length === 0),
            new ButtonBuilder()
                .setCustomId(mkId("cancel"))
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary),
        );

        await statusMsg.edit({ content: null, embeds: [embed], components: [row] });

        const collector = msg.channel.createMessageComponentCollector({
            filter: (i) => i.user.id === msg.author.id && i.customId.endsWith(`-${msg.id}`),
            time: COLLECTOR_TTL_MS,
            max: 1,
        });

        collector.on("collect", async (interaction) => {
            // customId format: "avban-<action>-<msgId>"
            const action = interaction.customId.split("-")[1]; // dupes | default | both | cancel

            if (action === "cancel") {
                await interaction.update({ components: [] });
                return;
            }

            await interaction.update({ content: ":hourglass: Applying bans…", embeds: [embed], components: [] });

            const toBan = [
                ...(action === "dupes"   || action === "both" ? dupeGroups.flat() : []),
                ...(action === "default" || action === "both" ? defaultMembers    : []),
            ];

            let succeeded = 0, skipped = 0, failed = 0;
            const reason = `Avatar-ban (${action}) — requested by ${msg.author.tag} (${msg.author.id})`;

            for (const member of toBan) {
                // Never ban master users or the server owner
                if (yuno.commandMan._isUserMaster(member.id) || member.id === msg.guild.ownerId) {
                    skipped++;
                    continue;
                }
                try {
                    await member.ban({ deleteMessageSeconds: 0, reason });
                    succeeded++;
                } catch {
                    failed++;
                }
                await waitForRateLimit(yuno.dC);
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(failed === 0 ? 0x43cc24 : 0xffa500)
                .setTitle(":white_check_mark: Ban Operation Complete")
                .addFields(
                    { name: "Banned",        value: String(succeeded), inline: true },
                    { name: "Skipped",       value: String(skipped),   inline: true },
                    { name: "Failed",        value: String(failed),    inline: true },
                )
                .setTimestamp();

            await statusMsg.edit({ content: null, embeds: [embed, resultEmbed], components: [] });
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                // Timed out — remove the buttons
                statusMsg.edit({ components: [] }).catch(() => {});
            }
        });

    } catch (e) {
        await statusMsg.edit(`:negative_squared_cross_mark: Scan failed: ${e.message}`).catch(() => {});
    } finally {
        cleanupRL();
    }
};

module.exports.about = {
    command: "avatar-ban",
    description: "Scan all member avatars via SHA-256 checksum. Detects duplicate avatars (possible shared/alt accounts) and members with no custom avatar. Presents an interactive confirmation before banning. Server owner only.",
    examples: ["avatar-ban"],
    discord: true,
    terminal: false,
    list: true,
    listTerminal: false,
    requiredPermissions: ["ManageGuild", "BanMembers"],
    aliases: ["avban", "pfpban"],
    dangerous: true,
};

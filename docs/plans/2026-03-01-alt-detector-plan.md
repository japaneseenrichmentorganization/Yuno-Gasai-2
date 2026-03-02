# Alt Detector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add alt account detection using `discord-alt-detector`, with automatic join detection and an on-demand member scan command, both configurable per-guild.

**Architecture:** A new module (`src/modules/alt-detector.js`) listens on `guildMemberAdd` and scores new members, applying per-severity configured actions. A config command (`src/commands/alt-detector.js`) manages per-guild settings stored in a new `altDetectorConfig` SQLite table. A scan command (`src/commands/scan-alts.js`) iterates all existing members with rate-limit-aware batching and offers a bulk action select menu.

**Tech Stack:** discord.js v14, discord-alt-detector, Node.js native SQLite (or fallback), rateLimitHelper, LRUCache, EmbedCmdResponse

---

## Reference: Key Patterns

### Module structure (copy from `src/modules/auto-role-restore.js`):
```js
module.exports.modulename = "name";
let DISCORD_EVENTED = false, discClient = null, handler = null;

let discordConnected = async function(Yuno) {
    discClient = Yuno.dC;
    if (!DISCORD_EVENTED) {
        handler = async function(arg) { /* ... */ };
        discClient.on("guildMemberAdd", handler);
    }
    DISCORD_EVENTED = true;
};

module.exports.init = async function(Yuno, hotReloaded) {
    if (hotReloaded) await discordConnected(Yuno);
    else Yuno.on("discord-connected", discordConnected);
};
module.exports.configLoaded = function() {};
module.exports.beforeShutdown = function(Yuno) {
    if (discClient && handler) discClient.removeListener("guildMemberAdd", handler);
    DISCORD_EVENTED = false; handler = null;
};
```

### Command structure (from `src/commands/ban.js`):
```js
module.exports.run = async function(yuno, author, args, msg) { /* ... */ };
module.exports.about = {
    command: "cmd-name", description: "...", examples: [],
    discord: true, terminal: false, list: true, listTerminal: false,
    requiredPermissions: ["ManageGuild"], aliases: [], dangerous: false
};
```

### DB table creation (inside `initDB()` `Promise.all([...])`):
```js
database.runPromise(`CREATE TABLE IF NOT EXISTS altDetectorConfig (
    gid TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    logChannelId TEXT,
    quarantineRoleId TEXT,
    actionNewbie TEXT DEFAULT 'none',
    actionSuspicious TEXT DEFAULT 'log',
    actionHighlySuspicious TEXT DEFAULT 'log',
    actionMegaSuspicious TEXT DEFAULT 'ban'
)`)
```

### DB CRUD pattern:
```js
const altDetectorConfigCache = new LRUCache(500, 5 * 60 * 1000); // at top of file

"getAltDetectorConfig": async function(database, guildId) {
    const cached = altDetectorConfigCache.get(guildId);
    if (cached !== undefined) return cached;
    const rows = await database.allPromise("SELECT * FROM altDetectorConfig WHERE gid = ?", [guildId]);
    const result = rows.length > 0 ? rows[0] : null;
    altDetectorConfigCache.set(guildId, result);
    return result;
},
"setAltDetectorConfig": async function(database, guildId, field, value) {
    altDetectorConfigCache.delete(guildId);
    const exists = await database.allPromise("SELECT gid FROM altDetectorConfig WHERE gid = ?", [guildId]);
    if (exists.length === 0) {
        await database.runPromise("INSERT INTO altDetectorConfig(gid) VALUES(?)", [guildId]);
    }
    await database.runPromise(`UPDATE altDetectorConfig SET ${field} = ? WHERE gid = ?`, [value, guildId]);
},
```

### discord-alt-detector API:
```js
const { AltDetector } = require('discord-alt-detector');
const detector = new AltDetector();
const result = detector.check(member);         // { total: number, ... }
const category = detector.getCategory(result); // 'highly-trusted'|'trusted'|'normal'|'newbie'|'suspicious'|'highly-suspicious'|'mega-suspicious'
```

### Rate limit scanning pattern (from `src/commands/scan-bans.js`):
```js
const { setupRateLimitListener, waitForRateLimit } = require('../lib/rateLimitHelper');
const cleanupRateLimit = setupRateLimitListener(yuno.dC);
try {
    // ... loop with await waitForRateLimit(yuno.dC) between batches
} finally {
    cleanupRateLimit();
}
```

### Slash command handler pattern (from `src/modules/slash-commands.js`):
```js
// In slashCommands array:
new SlashCommandBuilder().setName("cmd").setDescription("desc")...

// In COMMAND_HANDLERS object:
"cmd": (interaction) => { /* build text command string */ return "cmd subcmd args"; }
```

---

## Task 1: Install Package

**Files:** `package.json`, `package-lock.json`

**Step 1: Install discord-alt-detector**
```bash
cd /home/blubskye/Downloads/Yuno-bot-js14-claude-explore-codebase-0174s7h4LsnacrHnEv4cmuVK
npm install discord-alt-detector
```
Expected: Added 1 package, 0 vulnerabilities

**Step 2: Verify installation**
```bash
node -e "const { AltDetector } = require('discord-alt-detector'); console.log('OK', typeof AltDetector)"
```
Expected output: `OK function`

**Step 3: Commit**
```bash
git add package.json package-lock.json
git commit -m "feat: install discord-alt-detector package"
```

---

## Task 2: Add Database Table and CRUD Methods

**Files:**
- Modify: `src/DatabaseCommands.js`

**Step 1: Add the LRU cache at the top of DatabaseCommands.js**

Find the block of cache declarations at the top (lines 22-33). Add after the existing cache declarations:
```js
// Cache for alt detector config (5 minute TTL, max 500 guilds)
const altDetectorConfigCache = new LRUCache(500, 5 * 60 * 1000);
```

**Step 2: Add the table to initDB()**

Find the `Promise.all([` block in `initDB()` (around line 124). Add a new entry to the array before the closing `]);`:
```js
            database.runPromise(`CREATE TABLE IF NOT EXISTS altDetectorConfig (
                gid TEXT PRIMARY KEY,
                enabled INTEGER DEFAULT 0,
                logChannelId TEXT,
                quarantineRoleId TEXT,
                actionNewbie TEXT DEFAULT 'none',
                actionSuspicious TEXT DEFAULT 'log',
                actionHighlySuspicious TEXT DEFAULT 'log',
                actionMegaSuspicious TEXT DEFAULT 'ban'
            )`)
```

**Step 3: Add CRUD methods to the module.exports object**

Find the end of the `module.exports = self = { ... }` block in DatabaseCommands.js (after the last method, before the closing `}`). Add these methods:

```js
    /**
     * Get alt detector config for a guild
     * @param {Database} database
     * @param {string} guildId
     * @returns {Promise<Object|null>}
     */
    "getAltDetectorConfig": async function(database, guildId) {
        const cached = altDetectorConfigCache.get(guildId);
        if (cached !== undefined) return cached;
        const rows = await database.allPromise("SELECT * FROM altDetectorConfig WHERE gid = ?", [guildId]);
        const result = rows.length > 0 ? rows[0] : null;
        altDetectorConfigCache.set(guildId, result);
        return result;
    },

    /**
     * Set a single field in alt detector config for a guild
     * Creates the row if it doesn't exist
     * @param {Database} database
     * @param {string} guildId
     * @param {string} field - Column name to update (validated by caller)
     * @param {*} value
     */
    "setAltDetectorConfig": async function(database, guildId, field, value) {
        altDetectorConfigCache.delete(guildId);
        const exists = await database.allPromise("SELECT gid FROM altDetectorConfig WHERE gid = ?", [guildId]);
        if (exists.length === 0) {
            await database.runPromise("INSERT INTO altDetectorConfig(gid) VALUES(?)", [guildId]);
        }
        await database.runPromise(`UPDATE altDetectorConfig SET ${field} = ? WHERE gid = ?`, [value, guildId]);
    },
```

**Step 4: Commit**
```bash
git add src/DatabaseCommands.js
git commit -m "feat: add altDetectorConfig table and CRUD methods"
```

---

## Task 3: Create the Join Detection Module

**Files:**
- Create: `src/modules/alt-detector.js`

**Step 1: Create the file**

```js
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

const { EmbedBuilder } = require("discord.js");
const { AltDetector } = require("discord-alt-detector");

module.exports.modulename = "alt-detector";

const detector = new AltDetector();

// Suspicion category → config field name mapping
const CATEGORY_TO_FIELD = {
    "newbie": "actionNewbie",
    "suspicious": "actionSuspicious",
    "highly-suspicious": "actionHighlySuspicious",
    "mega-suspicious": "actionMegaSuspicious"
};

// Color per severity
const CATEGORY_COLORS = {
    "newbie": "#ffa500",
    "suspicious": "#ff6600",
    "highly-suspicious": "#ff3300",
    "mega-suspicious": "#cc0000"
};

let DISCORD_EVENTED = false,
    discClient = null,
    memberAddHandler = null,
    yunoBotRef = null;

async function applyAction(action, member, category, score, config) {
    const reason = `Alt account detected — category: ${category}, score: ${score}`;

    if (action === "kick") {
        try { await member.kick(reason); } catch (e) { console.error("[AltDetector] Failed to kick:", e.message); }
    } else if (action === "ban") {
        try { await member.ban({ deleteMessageSeconds: 0, reason }); } catch (e) { console.error("[AltDetector] Failed to ban:", e.message); }
    } else if (action === "role") {
        if (!config.quarantineRoleId) {
            console.warn("[AltDetector] Action is 'role' but no quarantineRoleId configured for guild", member.guild.id);
            return;
        }
        try {
            const role = await member.guild.roles.fetch(config.quarantineRoleId);
            if (role) await member.roles.add(role, reason);
        } catch (e) { console.error("[AltDetector] Failed to assign quarantine role:", e.message); }
    }
}

async function postToLogChannel(logChannelId, member, category, score, guild) {
    try {
        const channel = await guild.channels.fetch(logChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(CATEGORY_COLORS[category] || "#ff6600")
            .setTitle(`:warning: Possible Alt Account Detected`)
            .setDescription(`**${member.user.tag}** (ID: \`${member.user.id}\`) joined and was flagged.`)
            .addFields(
                { name: "Suspicion Category", value: category, inline: true },
                { name: "Score", value: String(score), inline: true },
                { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (e) {
        console.error("[AltDetector] Failed to post to log channel:", e.message);
    }
}

let discordConnected = async function(Yuno) {
    discClient = Yuno.dC;
    yunoBotRef = Yuno;

    if (!DISCORD_EVENTED) {
        memberAddHandler = async function(member) {
            try {
                const config = await Yuno.dbCommands.getAltDetectorConfig(Yuno.database, member.guild.id);
                if (!config || !config.enabled) return;

                const result = detector.check(member);
                const category = detector.getCategory(result);
                const score = result.total;

                const actionField = CATEGORY_TO_FIELD[category];
                if (!actionField) return; // trusted/normal/highly-trusted — no action

                const action = config[actionField] || "none";
                if (action === "none") return;

                // Always log if there's a log channel and any action is taken
                if (config.logChannelId) {
                    await postToLogChannel(config.logChannelId, member, category, score, member.guild);
                }

                // Apply the configured action (log-only doesn't need extra work, log channel was already sent)
                if (action !== "log") {
                    await applyAction(action, member, category, score, config);
                }
            } catch (e) {
                console.error("[AltDetector] Error in guildMemberAdd handler:", e.message);
            }
        };

        discClient.on("guildMemberAdd", memberAddHandler);
    }

    DISCORD_EVENTED = true;
};

module.exports.init = async function(Yuno, hotReloaded) {
    if (hotReloaded)
        await discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected);
};

module.exports.configLoaded = function() {};

module.exports.beforeShutdown = function(Yuno) {
    if (discClient && memberAddHandler) {
        discClient.removeListener("guildMemberAdd", memberAddHandler);
    }
    DISCORD_EVENTED = false;
    memberAddHandler = null;
};
```

**Step 2: Commit**
```bash
git add src/modules/alt-detector.js
git commit -m "feat: add alt-detector join detection module"
```

---

## Task 4: Create the Config Command

**Files:**
- Create: `src/commands/alt-detector.js`

**Step 1: Create the file**

```js
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

delete require.cache[require.resolve("../lib/EmbedCmdResponse")];
const EmbedCmdResponse = require("../lib/EmbedCmdResponse");

const VALID_LEVELS = ["newbie", "suspicious", "highly-suspicious", "mega-suspicious"];
const VALID_ACTIONS = ["none", "log", "kick", "ban", "role"];

const LEVEL_TO_FIELD = {
    "newbie": "actionNewbie",
    "suspicious": "actionSuspicious",
    "highly-suspicious": "actionHighlySuspicious",
    "mega-suspicious": "actionMegaSuspicious"
};

module.exports.run = async function(yuno, author, args, msg) {
    const sub = args[0]?.toLowerCase();

    if (!sub) {
        return msg.channel.send("Usage: `.alt-detector <enable|disable|setchannel|setrole|setaction|status>`");
    }

    const guildId = msg.guild.id;

    if (sub === "enable") {
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, "enabled", 1);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Alt Detector Enabled")
            .setDescription("Alt detection is now **enabled** for this server. New members will be scored on join.")
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "disable") {
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, "enabled", 0);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#ff6600")
            .setTitle(":white_check_mark: Alt Detector Disabled")
            .setDescription("Alt detection is now **disabled** for this server.")
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "setchannel") {
        const channel = msg.mentions.channels.first() || (args[1] ? msg.guild.channels.cache.get(args[1]) : null);
        if (!channel) {
            return msg.channel.send(":negative_squared_cross_mark: Please mention a channel: `.alt-detector setchannel #channel`");
        }
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, "logChannelId", channel.id);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Log Channel Set")
            .setDescription(`Alt detection alerts will be posted to <#${channel.id}>.`)
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "setrole") {
        const role = msg.mentions.roles.first() || (args[1] ? msg.guild.roles.cache.get(args[1]) : null);
        if (!role) {
            return msg.channel.send(":negative_squared_cross_mark: Please mention a role: `.alt-detector setrole @role`");
        }
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, "quarantineRoleId", role.id);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Quarantine Role Set")
            .setDescription(`Detected alts with 'role' action will receive <@&${role.id}>.`)
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "setaction") {
        const level = args[1]?.toLowerCase();
        const action = args[2]?.toLowerCase();

        if (!level || !VALID_LEVELS.includes(level)) {
            return msg.channel.send(`:negative_squared_cross_mark: Invalid level. Valid levels: \`${VALID_LEVELS.join(", ")}\``);
        }
        if (!action || !VALID_ACTIONS.includes(action)) {
            return msg.channel.send(`:negative_squared_cross_mark: Invalid action. Valid actions: \`${VALID_ACTIONS.join(", ")}\``);
        }

        const field = LEVEL_TO_FIELD[level];
        await yuno.dbCommands.setAltDetectorConfig(yuno.database, guildId, field, action);
        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#43cc24")
            .setTitle(":white_check_mark: Action Updated")
            .setDescription(`**${level}** → \`${action}\``)
            .setCMDRequester(msg.member)
        ]});
    }

    if (sub === "status") {
        const config = await yuno.dbCommands.getAltDetectorConfig(yuno.database, guildId);

        const logChannel = config?.logChannelId ? `<#${config.logChannelId}>` : "*not set*";
        const quarantineRole = config?.quarantineRoleId ? `<@&${config.quarantineRoleId}>` : "*not set*";
        const enabled = config?.enabled ? ":green_circle: **Enabled**" : ":red_circle: **Disabled**";

        const actionNewbie = config?.actionNewbie || "none";
        const actionSuspicious = config?.actionSuspicious || "log";
        const actionHighlySuspicious = config?.actionHighlySuspicious || "log";
        const actionMegaSuspicious = config?.actionMegaSuspicious || "ban";

        return msg.channel.send({ embeds: [new EmbedCmdResponse()
            .setColor("#5865F2")
            .setTitle(":mag: Alt Detector Status")
            .addFields(
                { name: "Status", value: enabled, inline: true },
                { name: "Log Channel", value: logChannel, inline: true },
                { name: "Quarantine Role", value: quarantineRole, inline: true },
                { name: "Actions by Severity", value:
                    `**newbie** → \`${actionNewbie}\`\n` +
                    `**suspicious** → \`${actionSuspicious}\`\n` +
                    `**highly-suspicious** → \`${actionHighlySuspicious}\`\n` +
                    `**mega-suspicious** → \`${actionMegaSuspicious}\``
                }
            )
            .setFooter({ text: "Valid actions: none | log | kick | ban | role" })
            .setCMDRequester(msg.member)
        ]});
    }

    return msg.channel.send(`:negative_squared_cross_mark: Unknown subcommand \`${sub}\`. Valid: enable, disable, setchannel, setrole, setaction, status`);
};

module.exports.about = {
    "command": "alt-detector",
    "description": "Configure the alt account detector. Actions: enable, disable, setchannel, setrole, setaction, status",
    "examples": [
        "alt-detector enable",
        "alt-detector disable",
        "alt-detector setchannel #mod-logs",
        "alt-detector setrole @Quarantine",
        "alt-detector setaction mega-suspicious ban",
        "alt-detector setaction suspicious log",
        "alt-detector status"
    ],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "requiredPermissions": ["ManageGuild"],
    "aliases": ["altdetector", "altconfig"],
    "dangerous": false
};
```

**Step 2: Commit**
```bash
git add src/commands/alt-detector.js
git commit -m "feat: add alt-detector config command"
```

---

## Task 5: Create the Scan Command

**Files:**
- Create: `src/commands/scan-alts.js`

**Step 1: Create the file**

```js
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

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { AltDetector } = require("discord-alt-detector");
const { setupRateLimitListener, waitForRateLimit } = require("../lib/rateLimitHelper");

const detector = new AltDetector();

// Actionable categories only (skip trusted/normal/highly-trusted)
const ACTIONABLE_CATEGORIES = new Set(["newbie", "suspicious", "highly-suspicious", "mega-suspicious"]);

const CATEGORY_EMOJI = {
    "newbie": "🟠",
    "suspicious": "🔴",
    "highly-suspicious": "🚨",
    "mega-suspicious": "☠️"
};

// Chunk size for member processing
const CHUNK_SIZE = 50;

module.exports.run = async function(yuno, author, args, msg) {
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
            if (processed % 500 === 0) {
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

        // Check if alt detector is enabled and has a quarantine role configured
        const config = await yuno.dbCommands.getAltDetectorConfig(yuno.database, msg.guild.id);

        // Build select menu options
        const options = [
            { label: "Do nothing", value: "none", description: "Keep the report, take no action" },
            { label: `Kick all flagged (${totalFlagged})`, value: "kick", description: "Kick all flagged members from the server" },
            { label: `Ban all flagged (${totalFlagged})`, value: "ban", description: "Ban all flagged members from the server" },
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
            .setPlaceholder("Choose an action for all flagged members...")
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

            await interaction.update({ content: `:hourglass: Applying action \`${action}\` to ${totalFlagged} members...`, components: [] });

            let succeeded = 0, failed = 0;
            const reason = `Alt scan bulk action — ${action} by ${msg.author.tag}`;

            for (const { member } of allFlagged) {
                try {
                    if (action === "kick") {
                        await member.kick(reason);
                    } else if (action === "ban") {
                        await member.ban({ deleteMessageSeconds: 0, reason });
                    } else if (action === "role") {
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
                .setDescription(`Action \`${action}\` applied to flagged members.`)
                .addFields(
                    { name: "Succeeded", value: String(succeeded), inline: true },
                    { name: "Failed", value: String(failed), inline: true }
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
    "requiredPermissions": ["ManageGuild"],
    "aliases": ["scanalts", "altscan"],
    "dangerous": true
};
```

**Step 2: Commit**
```bash
git add src/commands/scan-alts.js
git commit -m "feat: add scan-alts command with bulk action select menu"
```

---

## Task 6: Register Slash Commands

**Files:**
- Modify: `src/modules/slash-commands.js`

**Step 1: Add to the slashCommands array**

Find the end of the `slashCommands` array (before the `];` closing it, around line 174). Add:

```js
    new SlashCommandBuilder()
        .setName("alt-detector")
        .setDescription("Configure the alt account detector")
        .addSubcommand(sub => sub
            .setName("enable")
            .setDescription("Enable alt detection for this server"))
        .addSubcommand(sub => sub
            .setName("disable")
            .setDescription("Disable alt detection for this server"))
        .addSubcommand(sub => sub
            .setName("setchannel")
            .setDescription("Set the channel for alt detection alerts")
            .addChannelOption(opt => opt.setName("channel").setDescription("Alert channel").setRequired(true)))
        .addSubcommand(sub => sub
            .setName("setrole")
            .setDescription("Set the quarantine role for detected alts")
            .addRoleOption(opt => opt.setName("role").setDescription("Quarantine role").setRequired(true)))
        .addSubcommand(sub => sub
            .setName("setaction")
            .setDescription("Set the action for a suspicion level")
            .addStringOption(opt => opt.setName("level").setDescription("Suspicion level").setRequired(true)
                .addChoices(
                    { name: "newbie", value: "newbie" },
                    { name: "suspicious", value: "suspicious" },
                    { name: "highly-suspicious", value: "highly-suspicious" },
                    { name: "mega-suspicious", value: "mega-suspicious" }
                ))
            .addStringOption(opt => opt.setName("action").setDescription("Action to take").setRequired(true)
                .addChoices(
                    { name: "none", value: "none" },
                    { name: "log", value: "log" },
                    { name: "kick", value: "kick" },
                    { name: "ban", value: "ban" },
                    { name: "role (assign quarantine role)", value: "role" }
                )))
        .addSubcommand(sub => sub
            .setName("status")
            .setDescription("Show current alt detector configuration"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
        .setName("scan-alts")
        .setDescription("Scan all server members for alt account indicators")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
```

**Step 2: Add to the COMMAND_HANDLERS object**

Find the end of the `COMMAND_HANDLERS` object (before the closing `};`, around line 263). Add:

```js
    "alt-detector": (interaction) => {
        const sub = interaction.options.getSubcommand();
        if (sub === "setchannel") {
            const channel = interaction.options.getChannel("channel");
            return `alt-detector setchannel <#${channel.id}>`;
        }
        if (sub === "setrole") {
            const role = interaction.options.getRole("role");
            return `alt-detector setrole <@&${role.id}>`;
        }
        if (sub === "setaction") {
            const level = interaction.options.getString("level");
            const action = interaction.options.getString("action");
            return `alt-detector setaction ${level} ${action}`;
        }
        return `alt-detector ${sub}`;
    },

    "scan-alts": () => "scan-alts",
```

**Step 3: Commit**
```bash
git add src/modules/slash-commands.js
git commit -m "feat: register /alt-detector and /scan-alts slash commands"
```

---

## Task 7: Smoke Test

**Step 1: Start the bot**
```bash
npm start
```

Expected: No errors on startup. Should see `Module alt-detector successfully loaded.` in startup logs.

**Step 2: Verify slash commands registered**
Check Discord — `/alt-detector` and `/scan-alts` should appear in the slash command menu.

**Step 3: Test config command**
In a Discord server where the bot is present:
```
.alt-detector status
```
Expected: Embed showing "Disabled", no channel/role set, default actions

```
.alt-detector enable
.alt-detector setchannel #mod-logs
.alt-detector setaction mega-suspicious ban
.alt-detector status
```
Expected: Status shows enabled, log channel, mega-suspicious → ban

**Step 4: Test scan command**
```
.scan-alts
```
Expected: Fetches members, shows results embed, shows select menu. Select "Do nothing" to dismiss.

**Step 5: Final commit if any fixes needed**
```bash
git add -p  # stage only relevant changes
git commit -m "fix: <description of any fixes>"
```

---

## Notes

- **Intents:** `GuildMembers` and `GuildPresences` are already in `src/Yuno.js:93-102`. No changes needed.
- **Auto-discovery:** Both `src/modules/` and `src/commands/` are auto-discovered via `readdir`. No list to update.
- **`scan-alts` slash command:** Uses the `handleInteraction` → `COMMAND_HANDLERS` → text command pipeline. The slash command handler calls `Yuno.commandMan.execute()` which runs the text command handler, so the select menu interaction is handled by the command itself (not the slash command module).
- **Select menu caveat:** The select menu collector listens on `msg.channel`. For slash commands, `fakeMsg.channel` is the interaction's channel, so it works. The collector ID is scoped to `msg.author.id` to prevent other users from triggering it.
- **Large guilds:** `guild.members.fetch()` with `GuildMembers` intent returns all members. For very large guilds (100k+), this may take significant memory. The CHUNK_SIZE delay loop keeps API pressure low.

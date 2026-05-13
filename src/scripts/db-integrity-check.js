#!/usr/bin/env node
/*
    db-integrity-check.js — Post-startup / post-compromise database integrity scanner.

    Purpose:
      Scans all text columns in the Yuno database for values that would be rejected
      by the current input-validation layer (null bytes, non-NFC Unicode, invalid
      snowflakes, overlength strings). Also detects values injected before those
      guards were in place, or by a threat actor who bypassed them post-compromise.

    Usage:
      node src/scripts/db-integrity-check.js [options]

    Options:
      --db=<path>          Path to SQLite database file (default: read from config)
      --passphrase=<key>   Decryption passphrase for field-level encrypted columns.
                           Without this, encrypted blobs are checked structurally only.
      --fix                Apply automated sanitization (NFC normalization, null-byte
                           stripping). Rows that cannot be auto-fixed are flagged for
                           manual review. NEVER auto-deletes rows.
      --verbose            Print every checked row, not just findings.
      --help               Show this message.

    Exit codes:
      0  No issues found (or all issues were fixed).
      1  Issues found (check stderr / output).
      2  Fatal error (database could not be opened, etc.).
*/

"use strict";

const path   = require("path");
const fs     = require("fs");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
    process.argv.slice(2).flatMap(arg => {
        if (arg === "--fix")     return [["fix", true]];
        if (arg === "--verbose") return [["verbose", true]];
        if (arg === "--help")    return [["help", true]];
        const m = arg.match(/^--([a-z]+)=(.+)$/);
        return m ? [[m[1], m[2]]] : [];
    })
);

if (args.help) {
    console.log(fs.readFileSync(__filename, "utf8").match(/\/\*[\s\S]*?\*\//)[0].replace(/^\/\*\s*|\s*\*\/$/g, ""));
    process.exit(0);
}

// ---------------------------------------------------------------------------
// Database driver detection (mirrors src/database.js priority order)
// ---------------------------------------------------------------------------

let db;
const dbPath = args.db || (() => {
    try {
        const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../config.json"), "utf8"));
        return cfg.database || "yuno.db";
    } catch {
        return "yuno.db";
    }
})();

const resolvedPath = path.resolve(process.cwd(), dbPath);
if (!fs.existsSync(resolvedPath)) {
    console.error(`[FATAL] Database not found: ${resolvedPath}`);
    process.exit(2);
}

// Try drivers in priority order: native (Node 24+) → sqlcipher → sqlite3
let driverName;
try {
    const { DatabaseSync } = require("node:sqlite");
    db = new DatabaseSync(resolvedPath, { readOnly: !args.fix });
    driverName = "node:sqlite (native)";
} catch {
    try {
        const sqlcipher = require("@journeyapps/sqlcipher");
        db = new sqlcipher.Database(resolvedPath);
        driverName = "sqlcipher";
    } catch {
        try {
            const sqlite3 = require("sqlite3");
            db = new sqlite3.Database(resolvedPath, args.fix ? sqlite3.OPEN_READWRITE : sqlite3.OPEN_READONLY);
            driverName = "sqlite3";
        } catch {
            console.error("[FATAL] No SQLite driver available (node:sqlite, sqlcipher, or sqlite3 required).");
            process.exit(2);
        }
    }
}

// ---------------------------------------------------------------------------
// Synchronous query helper (handles both native and callback-based drivers)
// ---------------------------------------------------------------------------

function queryAll(sql, params = []) {
    // node:sqlite DatabaseSync
    if (db.prepare) {
        try {
            return db.prepare(sql).all(params);
        } catch (e) {
            // Some native versions use positional instead of named binding
            return db.prepare(sql).all(...params);
        }
    }
    // callback-based (sqlite3 / sqlcipher) — run synchronously via a tmp queue
    // We convert to sync using a spin-wait (script-only context, not bot process).
    let done = false, rows, err;
    db.all(sql, params, (e, r) => { err = e; rows = r; done = true; });
    const deadline = Date.now() + 10000;
    while (!done && Date.now() < deadline) { /* spin */ }
    if (err) throw err;
    return rows || [];
}

function runSql(sql, params = []) {
    if (db.prepare) {
        db.prepare(sql).run(params);
        return;
    }
    let done = false, err;
    db.run(sql, params, (e) => { err = e; done = true; });
    const deadline = Date.now() + 10000;
    while (!done && Date.now() < deadline) { /* spin */ }
    if (err) throw err;
}

// ---------------------------------------------------------------------------
// Field-level decryption (mirrors src/lib/cryptoUtils.js)
// ---------------------------------------------------------------------------

const ALGORITHM      = "aes-256-gcm";
const IV_LENGTH      = 16;
const AUTH_TAG_LEN   = 16;
const SALT_LENGTH    = 16;
const KEY_ITERATIONS = 100_000;

function _tryDecrypt(encryptedData, passphrase) {
    if (!passphrase || encryptedData === null || encryptedData === undefined) return encryptedData;
    try {
        const buf = Buffer.from(encryptedData, "base64");
        if (buf.length < 49) return encryptedData; // not encrypted (legacy)
        const salt    = buf.slice(0, SALT_LENGTH);
        const iv      = buf.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const authTag = buf.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LEN);
        const cipher  = buf.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LEN);
        const key     = crypto.pbkdf2Sync(passphrase, salt, KEY_ITERATIONS, 32, "sha256");
        const dec     = crypto.createDecipheriv(ALGORITHM, key, iv);
        dec.setAuthTag(authTag);
        return Buffer.concat([dec.update(cipher), dec.final()]).toString("utf8");
    } catch {
        return encryptedData; // leave as-is if decryption fails
    }
}

function _tryEncrypt(plaintext, passphrase) {
    if (!passphrase || plaintext === null || plaintext === undefined) return plaintext;
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key  = crypto.pbkdf2Sync(passphrase, salt, KEY_ITERATIONS, 32, "sha256");
    const iv   = crypto.randomBytes(IV_LENGTH);
    const enc  = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([enc.update(String(plaintext), "utf8"), enc.final()]);
    const authTag = enc.getAuthTag();
    return Buffer.concat([salt, iv, authTag, encrypted]).toString("base64");
}

// ---------------------------------------------------------------------------
// Validation helpers — base checks
// ---------------------------------------------------------------------------

const SNOWFLAKE_RE = /^\d{17,19}$/;

// ---------------------------------------------------------------------------
// Discord.js-specific / second-order injection checks
// ---------------------------------------------------------------------------

// Zero-width and invisible Unicode characters that render as nothing in Discord
// but survive in the stored string. Used to hide content in triggers or make
// them impossible to delete via normal UI commands.
const ZERO_WIDTH_CHARS = [
    "​", // ZERO WIDTH SPACE
    "‌", // ZERO WIDTH NON-JOINER
    "‍", // ZERO WIDTH JOINER
    "﻿", // ZERO WIDTH NO-BREAK SPACE (BOM)
    "⁠", // WORD JOINER
    "­", // SOFT HYPHEN
    " ", // LINE SEPARATOR
    " ", // PARAGRAPH SEPARATOR
    "‎", // LEFT-TO-RIGHT MARK
    "‏", // RIGHT-TO-LEFT MARK
];

// Unicode directional overrides that can reverse displayed text (spoofing).
const DIRECTIONAL_OVERRIDES = [
    "‪", "‫", "‬", "‭", "‮", // LRE,RLE,PDF,LRO,RLO
    "⁦", "⁧", "⁨", "⁩",            // LRI,RLI,FSI,PDI
];

// All invisible/dangerous code points combined.
const ALL_INVISIBLE = [...ZERO_WIDTH_CHARS, ...DIRECTIONAL_OVERRIDES];

// Discord mention patterns that cause real pings when sent via the API.
// @everyone / @here in text content ping server; <@id> pings users; <@&id> pings roles.
// These are dangerous in DB-sourced content because allowedMentions is historically
// absent on many bot sends. Even with allowedMentions fixed, flagging these in the DB
// is valuable for post-compromise audit.
function hasDiscordMention(v) {
    if (typeof v !== "string") return false;
    if (v.includes("@everyone") || v.includes("@here")) return true;
    // <@id>, <@!id>, <@&id> — user / legacy user / role mentions
    for (let i = 0; i < v.length - 2; i++) {
        if (v[i] === "<" && v[i+1] === "@") return true;
    }
    return false;
}

function hasInvisibleChars(v) {
    if (typeof v !== "string") return false;
    for (const ch of ALL_INVISIBLE) {
        if (v.includes(ch)) return true;
    }
    return false;
}

// Homograph detection: check whether a string mixes characters from two or more
// Unicode scripts (Latin + Cyrillic, Latin + Greek, etc.). Mixing scripts is a
// strong signal of a lookalike-glyph attack. We use a simple code-point range
// approach that catches the most common homograph scripts.
const SCRIPT_RANGES = {
    latin:    [[0x0041, 0x007A], [0x00C0, 0x024F], [0x1E00, 0x1EFF]],
    cyrillic: [[0x0400, 0x04FF], [0x0500, 0x052F]],
    greek:    [[0x0370, 0x03FF], [0x1F00, 0x1FFF]],
    armenian: [[0x0530, 0x058F]],
    georgian: [[0x10A0, 0x10FF]],
};

function _scriptOf(cp) {
    for (const [name, ranges] of Object.entries(SCRIPT_RANGES)) {
        for (const [lo, hi] of ranges) {
            if (cp >= lo && cp <= hi) return name;
        }
    }
    return null;
}

function hasMixedScripts(v) {
    if (typeof v !== "string") return false;
    const seen = new Set();
    for (const ch of v) {
        const cp = ch.codePointAt(0);
        if (cp < 0x80) continue; // plain ASCII — skip (don't count as a "script")
        const s = _scriptOf(cp);
        if (s) seen.add(s);
        if (seen.size >= 2) return true;
    }
    return false;
}

// URL must start with https:// or http:// to be considered safe-scheme.
function isSafeUrl(v) {
    if (typeof v !== "string") return true; // null/non-string → not our check
    if (v === "null" || v === "") return true;
    return v.startsWith("https://") || v.startsWith("http://");
}

// levelRoleMap: every key must be a valid snowflake, every value must be a snowflake.
function validateLevelRoleMap(jsonStr) {
    const issues = [];
    if (!jsonStr || jsonStr === "null") return issues;
    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    } catch (e) {
        issues.push("levelRoleMap is not valid JSON");
        return issues;
    }
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
        issues.push("levelRoleMap is not a JSON object");
        return issues;
    }
    // Prototype-poisoning keys
    const POISON = new Set(["__proto__", "constructor", "prototype"]);
    for (const [k, v] of Object.entries(parsed)) {
        if (POISON.has(k)) {
            issues.push(`levelRoleMap has poisoning key: "${k}"`);
            continue;
        }
        if (!SNOWFLAKE_RE.test(String(v))) {
            issues.push(`levelRoleMap value for level "${k}" is not a valid snowflake: "${String(v).substring(0, 30)}"`);
        }
    }
    return issues;
}

const CHECKS = {
    nullBytes:       (v) => typeof v === "string" && v.includes("\x00"),
    nonNFC:          (v) => typeof v === "string" && v !== v.normalize("NFC"),
    badSnowflake:    (v) => typeof v === "string" && v !== null && !SNOWFLAKE_RE.test(v),
    overlength:      (v, max) => typeof v === "string" && v.length > max,
    discordMention:  hasDiscordMention,
    invisibleChars:  hasInvisibleChars,
    mixedScripts:    hasMixedScripts,
    unsafeUrl:       (v) => typeof v === "string" && v !== "null" && !isSafeUrl(v),
    badEnum:         (v, allowed) => typeof v === "string" && !allowed.includes(v),
};

function checkValue(label, raw, decrypted, opts = {}) {
    const { maxLen, checkMentions, checkInvisible, checkHomograph, checkUrl, allowedValues } = opts;
    const issues = [];
    const val = decrypted !== undefined ? decrypted : raw;
    if (val === null || val === undefined) return issues;
    if (CHECKS.nullBytes(val))      issues.push(`null-byte in ${label}`);
    if (CHECKS.nonNFC(val))         issues.push(`non-NFC Unicode in ${label}`);
    if (maxLen && CHECKS.overlength(val, maxLen)) issues.push(`${label} exceeds max ${maxLen} (len=${val.length})`);
    if (checkMentions  && CHECKS.discordMention(val))  issues.push(`Discord mention injection in ${label} — pings users/roles when sent`);
    if (checkInvisible && CHECKS.invisibleChars(val))  issues.push(`invisible/zero-width Unicode in ${label} — unremovable via Discord UI`);
    if (checkHomograph && CHECKS.mixedScripts(val))    issues.push(`mixed-script homograph in ${label} — lookalike glyph attack`);
    if (checkUrl       && CHECKS.unsafeUrl(val))       issues.push(`unsafe URL scheme in ${label}: "${String(val).substring(0, 80)}"`);
    if (allowedValues  && CHECKS.badEnum(val, allowedValues))
        issues.push(`privilege-escalation: ${label} has invalid value "${String(val).substring(0, 40)}" (allowed: ${allowedValues.join(", ")})`);
    return issues;
}

function fixValue(val) {
    if (typeof val !== "string") return { fixed: val, changed: false };
    let fixed = val.replace(/\x00/g, "");    // strip null bytes
    for (const ch of ALL_INVISIBLE) {
        fixed = fixed.split(ch).join("");     // strip invisible/directional chars
    }
    fixed = fixed.normalize("NFC");          // NFC normalize
    return { fixed, changed: fixed !== val };
}

// ---------------------------------------------------------------------------
// Schema definition: which columns to check, whether they're encrypted,
// max lengths, and whether they're snowflakes.
// ---------------------------------------------------------------------------

// Each entry: { table, pk, columns: [{ name, encrypted?, maxLen?, snowflake?,
//   fixable?, checkMentions?, checkInvisible?, checkHomograph?, checkUrl?,
//   customCheck? }] }
// customCheck: fn(row) => string[] of issues (for cross-column or JSON checks)
const SCHEMA = [
    {
        table: "mentionResponses",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "gid",      snowflake: true },
            // trigger: invisible chars make it unremovable in Discord UI;
            //          mixed scripts enable lookalike-trigger attacks.
            { name: "trigger",  encrypted: true, maxLen: 200,  fixable: true,
              checkInvisible: true, checkHomograph: true },
            // response: mention injection pings users/roles when sent.
            { name: "response", encrypted: true, maxLen: 2000, fixable: true,
              checkMentions: true, checkInvisible: true },
            // image: must be a real HTTP(S) URL, not an arbitrary scheme.
            { name: "image",    encrypted: true, fixable: false, checkUrl: true },
        ],
    },
    {
        table: "guilds",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "id",               snowflake: true },
            { name: "prefix",           maxLen: 10, fixable: false },
            { name: "onJoinDMMsg",      encrypted: true, maxLen: 2000, fixable: true,
              checkMentions: true, checkInvisible: true },
            { name: "onJoinDMMsgTitle", encrypted: true, maxLen: 255, fixable: true,
              checkInvisible: true },
        ],
        // Extra: validate levelRoleMap JSON structure and snowflake keys.
        extraCheck: (row) => validateLevelRoleMap(row.levelRoleMap),
    },
    {
        table: "botBans",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "id",       snowflake: true },
            // type must be 'user' or 'guild' — any other value bypasses
            // the type-check logic in isBotBanned and could skip enforcement.
            { name: "type",     fixable: false, allowedValues: ["user", "guild"] },
            { name: "reason",   encrypted: true, maxLen: 500, fixable: true,
              checkInvisible: true },
            // bannedBy: should be a snowflake or "system" (automated bans).
            // A non-snowflake non-system value indicates a tampered audit trail.
            { name: "bannedBy", fixable: false },
        ],
        // Self-ban: id === bannedBy is suspicious (locks out a user who can re-ban themselves).
        // Also flags system-attributed bans with non-automated reasons (manual tampering).
        extraCheck: (row) => {
            const issues = [];
            if (row.id && row.bannedBy && row.id === row.bannedBy) {
                issues.push(`privilege-escalation: bot-ban self-reference — id and bannedBy are the same (${row.id})`);
            }
            if (row.bannedBy && row.bannedBy !== "system" && !SNOWFLAKE_RE.test(row.bannedBy)) {
                issues.push(`privilege-escalation: bannedBy is neither a snowflake nor "system": "${String(row.bannedBy).substring(0, 40)}"`);
            }
            return issues;
        },
    },
    {
        table: "modActions",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "gid",         snowflake: true },
            { name: "moderatorId", snowflake: true },
            { name: "targetId",    snowflake: true },
            // action: only these values are written by the bot. Unexpected values
            // indicate either a bug or a tampered audit log entry.
            { name: "action",  fixable: false,
              allowedValues: ["ban", "kick", "unban", "timeout", "warn", "mute"] },
            { name: "reason",  encrypted: true, maxLen: 500, fixable: true,
              checkInvisible: true },
        ],
        // Flag entries where moderator banned themselves (audit trail anomaly).
        extraCheck: (row) => {
            if (row.moderatorId && row.targetId && row.moderatorId === row.targetId) {
                return [`privilege-escalation: modAction self-target — moderator and target are the same ID (${row.moderatorId})`];
            }
            return [];
        },
    },
    {
        table: "dmInbox",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "usrId",       snowflake: true },
            { name: "userTag",     maxLen: 200, fixable: true, checkInvisible: true },
            { name: "content",     encrypted: true, maxLen: 4000, fixable: true,
              checkInvisible: true },
            { name: "attachments", encrypted: true, fixable: false },
        ],
    },
    {
        table: "banImages",
        pk: ["gid", "banner"],
        columns: [
            { name: "gid",    snowflake: true },
            { name: "banner", snowflake: true },
            // Image URLs loaded into Discord embeds — must be HTTP(S).
            { name: "image",  encrypted: true, fixable: false, checkUrl: true },
        ],
    },
    {
        table: "botPresence",
        pk: "id",
        columns: [
            { name: "text",      maxLen: 500, fixable: true, checkInvisible: true },
            { name: "streamUrl", maxLen: 500, fixable: false, checkUrl: true },
        ],
    },
    {
        table: "altDetectorConfig",
        pk: "gid",
        columns: [
            { name: "gid",              snowflake: true },
            { name: "logChannelId",     snowflake: false }, // may be null
            { name: "quarantineRoleId", snowflake: false }, // may be null
            // Action fields: all must be one of the valid alt-detector actions.
            // A tampered 'ban' on actionNewbie would auto-ban all new accounts.
            { name: "actionNewbie",          fixable: false,
              allowedValues: ["none", "log", "kick", "ban", "role"] },
            { name: "actionSuspicious",      fixable: false,
              allowedValues: ["none", "log", "kick", "ban", "role"] },
            { name: "actionHighlySuspicious",fixable: false,
              allowedValues: ["none", "log", "kick", "ban", "role"] },
            { name: "actionMegaSuspicious",  fixable: false,
              allowedValues: ["none", "log", "kick", "ban", "role"] },
        ],
    },
    {
        table: "guilds",
        pk: "id",
        columns: [
            // Prefix: empty-string prefix causes the bot to respond to every
            // message. A very long prefix is also suspicious (denial-of-service
            // via preventing any commands from matching).
            { name: "prefix", maxLen: 10, fixable: false },
        ],
        extraCheck: (row) => {
            const issues = [];
            if (typeof row.prefix === "string" && row.prefix.trim() === "") {
                issues.push("privilege-escalation: guild prefix is empty — bot would respond to every message");
            }
            return issues;
        },
    },
];

// ---------------------------------------------------------------------------
// Side-channel / cross-table statistical checks
//
// These look at patterns across rows rather than individual field values.
// A side-channel attack uses observable metadata (timing, counts, deltas)
// to infer information that should not be directly visible.
// ---------------------------------------------------------------------------

function runSideChannelChecks(issues) {
    // 1. Mass-ban burst: more than N bot-bans created within a short window
    //    suggests either an exploit that auto-banned a crowd, or an attacker
    //    with DB access performing a mass-ban to lock legitimate users out.
    try {
        const BURST_WINDOW_MS  = 60_000; // 1 minute
        const BURST_THRESHOLD  = 10;     // bans per window considered suspicious
        const bans = queryAll("SELECT bannedAt FROM botBans ORDER BY bannedAt ASC");
        for (let i = 0; i <= bans.length - BURST_THRESHOLD; i++) {
            const window = bans[i + BURST_THRESHOLD - 1].bannedAt - bans[i].bannedAt;
            if (window <= BURST_WINDOW_MS) {
                issues.push(`[side-channel] mass-ban burst: ${BURST_THRESHOLD}+ bot-bans within ${BURST_WINDOW_MS / 1000}s window — possible DM-exploit abuse or DB-level mass-ban`);
                break;
            }
        }
    } catch { /* table absent on fresh DB */ }

    // 2. spamChecksums insertion by non-organic source: checksums that were
    //    inserted more than 1 day before the bot last started (based on oldest
    //    vcSession or experience entry) may have been pre-seeded to cause
    //    false-positive spam bans on specific users.
    //    We check for checksums with unusually old or future timestamps.
    try {
        const now = Date.now();
        const FAR_FUTURE = now + 24 * 60 * 60 * 1000; // 1 day into future
        const checksums = queryAll("SELECT checksum, guildId, detectedAt FROM spamChecksums");
        for (const row of checksums) {
            if (row.detectedAt > FAR_FUTURE) {
                issues.push(`[side-channel] spamChecksums[${row.guildId}/${row.checksum.substring(0,16)}]: future timestamp (${row.detectedAt}) — may be pre-seeded to trigger spam-ban`);
            }
        }
    } catch { /* table absent */ }

    // 3. vcSessions with joinedAt in the far future: would keep a fake session
    //    "active" indefinitely, skewing XP grants and potentially triggering
    //    rate-limit or quota logic abnormally.
    try {
        const now = Date.now();
        const FAR_FUTURE = now + 24 * 60 * 60 * 1000;
        const sessions = queryAll("SELECT gid, usrId, joinedAt FROM vcSessions");
        for (const row of sessions) {
            if (row.joinedAt > FAR_FUTURE) {
                issues.push(`[side-channel] vcSessions[${row.gid}+${row.usrId}]: joinedAt is in the future (${row.joinedAt}) — may cause unbounded XP accumulation`);
            }
        }
    } catch { /* table absent */ }

    // 4. DM inbox timing correlation: if many DM inbox entries share the exact
    //    same timestamp, they were either bulk-inserted (programmatic) or the
    //    timestamp field has been zeroed to erase the audit trail.
    try {
        const CLONE_THRESHOLD = 5;
        const dmRows = queryAll("SELECT timestamp FROM dmInbox ORDER BY timestamp");
        const tsCounts = new Map();
        for (const row of dmRows) {
            tsCounts.set(row.timestamp, (tsCounts.get(row.timestamp) || 0) + 1);
        }
        for (const [ts, count] of tsCounts) {
            if (count >= CLONE_THRESHOLD) {
                issues.push(`[side-channel] dmInbox: ${count} entries share identical timestamp ${ts} — possible bulk-insert or timestamp zeroing (audit trail erasure)`);
            }
        }
    } catch { /* table absent */ }

    // 5. Experience table: single user with exp values far above all others
    //    in the same guild — indicates direct DB manipulation to elevate XP
    //    (which drives role assignments via levelRoleMap).
    try {
        const expRows = queryAll("SELECT guildID, userID, exp FROM experiences");
        // Group by guild
        const byGuild = new Map();
        for (const row of expRows) {
            if (!byGuild.has(row.guildID)) byGuild.set(row.guildID, []);
            byGuild.get(row.guildID).push(row.exp);
        }
        for (const [gid, exps] of byGuild) {
            if (exps.length < 2) continue;
            const sorted = [...exps].sort((a, b) => b - a);
            const max = sorted[0];
            const secondMax = sorted[1];
            // Flag if top user has >10× the second-highest (suggests tampering)
            if (secondMax > 0 && max > secondMax * 10) {
                issues.push(`[side-channel] experiences[guild:${gid}]: top XP (${max}) is >10× second-highest (${secondMax}) — possible XP tampering to force role escalation`);
            }
        }
    } catch { /* table absent */ }
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

const passphrase = args.passphrase || null;
const FIX_MODE   = !!args.fix;
const VERBOSE    = !!args.verbose;

let totalIssues = 0;
let totalFixed  = 0;
const flagged   = []; // rows needing manual review

console.log(`\n=== Yuno DB Integrity Check ===`);
console.log(`  DB:         ${resolvedPath}`);
console.log(`  Driver:     ${driverName}`);
console.log(`  Decryption: ${passphrase ? "enabled" : "disabled (encrypted fields skipped)"}`);
console.log(`  Fix mode:   ${FIX_MODE ? "YES — changes will be written" : "no (read-only scan)"}`);
console.log(`  Verbose:    ${VERBOSE}`);
console.log();

for (const { table, pk, columns, extraCheck } of SCHEMA) {
    let rows;
    try {
        rows = queryAll(`SELECT * FROM ${table}`);
    } catch (e) {
        // Table may not exist yet on older DB versions — skip
        if (VERBOSE) console.log(`  [skip] Table '${table}' not found: ${e.message}`);
        continue;
    }

    if (VERBOSE) console.log(`[${table}] Scanning ${rows.length} row(s)...`);

    for (const row of rows) {
        const pkVal = Array.isArray(pk) ? pk.map(k => row[k]).join("+") : row[pk];
        const rowLabel = `${table}[${pkVal}]`;
        const rowIssues = [];
        const rowFixes  = {};
        let canFixAll   = true;

        for (const col of columns) {
            const raw = row[col.name];
            if (raw === null || raw === undefined) continue;

            let decrypted = raw;
            if (col.encrypted && passphrase) {
                decrypted = _tryDecrypt(raw, passphrase);
            }

            // --- snowflake check (always on plaintext) ---
            if (col.snowflake && typeof raw === "string") {
                if (!SNOWFLAKE_RE.test(raw)) {
                    rowIssues.push(`  ⚠  ${rowLabel}.${col.name}: invalid snowflake — "${raw.substring(0,40)}"`);
                    canFixAll = false; // don't auto-fix IDs
                }
            }

            // --- content checks (on decrypted value) ---
            const val = col.encrypted && passphrase ? decrypted : raw;
            const issues = checkValue(col.name, raw, col.encrypted && passphrase ? decrypted : undefined, {
                maxLen:        col.maxLen,
                checkMentions: col.checkMentions,
                checkInvisible:col.checkInvisible,
                checkHomograph:col.checkHomograph,
                checkUrl:      col.checkUrl,
                allowedValues: col.allowedValues,
            });
            if (issues.length > 0) {
                for (const iss of issues) {
                    rowIssues.push(`  ⚠  ${rowLabel}: ${iss}`);
                }

                if (col.fixable && (passphrase !== null || !col.encrypted)) {
                    const { fixed, changed } = fixValue(typeof val === "string" ? val : decrypted);
                    if (changed) {
                        rowFixes[col.name] = col.encrypted && passphrase
                            ? _tryEncrypt(fixed, passphrase)
                            : fixed;
                    }
                } else if (!col.fixable) {
                    canFixAll = false;
                }
            }
        }

        // --- per-table extra checks (e.g. JSON structure) ---
        if (extraCheck) {
            const extras = extraCheck(row);
            for (const iss of extras) {
                rowIssues.push(`  ⚠  ${rowLabel}: ${iss}`);
                canFixAll = false; // JSON structural issues require manual fix
            }
        }

        if (rowIssues.length > 0) {
            totalIssues += rowIssues.length;
            console.log(`\n${rowLabel} — ${rowIssues.length} issue(s):`);
            rowIssues.forEach(l => console.log(l));

            if (FIX_MODE && Object.keys(rowFixes).length > 0) {
                for (const [colName, newVal] of Object.entries(rowFixes)) {
                    try {
                        const whereCols = Array.isArray(pk) ? pk : [pk];
                        const whereClause = whereCols.map(k => `${k} = ?`).join(" AND ");
                        const whereVals   = whereCols.map(k => row[k]);
                        runSql(`UPDATE ${table} SET ${colName} = ? WHERE ${whereClause}`, [newVal, ...whereVals]);
                        console.log(`  ✓  Fixed ${colName}`);
                        totalFixed++;
                    } catch (e) {
                        console.error(`  ✗  Failed to fix ${colName}: ${e.message}`);
                    }
                }
            } else if (FIX_MODE && !canFixAll) {
                console.log(`  ⚠  Some issues in this row require manual review — skipped.`);
            } else if (!FIX_MODE && Object.keys(rowFixes).length > 0) {
                console.log(`  ℹ  Run with --fix to apply automated sanitization.`);
            }

            if (!canFixAll || !FIX_MODE) {
                flagged.push({ table, pk: pkVal, issues: rowIssues });
            }
        } else if (VERBOSE) {
            console.log(`  OK ${rowLabel}`);
        }
    }
}

// ---------------------------------------------------------------------------
// Side-channel / statistical checks (cross-table)
// ---------------------------------------------------------------------------

const sideChannelIssues = [];
runSideChannelChecks(sideChannelIssues);
if (sideChannelIssues.length > 0) {
    console.log(`\n[Cross-table side-channel analysis] — ${sideChannelIssues.length} finding(s):`);
    for (const iss of sideChannelIssues) {
        console.log(`  ⚠  ${iss}`);
        totalIssues++;
    }
    flagged.push({ table: "(cross-table)", pk: "N/A", issues: sideChannelIssues });
} else if (VERBOSE) {
    console.log("\n[Cross-table side-channel analysis] — no findings.");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n=== Summary ===`);
console.log(`  Issues found : ${totalIssues}`);
if (FIX_MODE) console.log(`  Fields fixed : ${totalFixed}`);
if (flagged.length > 0) {
    console.log(`  Rows needing manual review:`);
    for (const { table, pk } of flagged) {
        console.log(`    • ${table}[${pk}]`);
    }
}

if (totalIssues === 0) {
    console.log("\n  ✓ Database integrity check passed — no issues found.\n");
    process.exit(0);
} else if (FIX_MODE && flagged.length === 0) {
    console.log("\n  ✓ All issues were automatically fixed.\n");
    process.exit(0);
} else {
    console.log("\n  ✗ Issues remain — see above for details.\n");
    process.exit(1);
}

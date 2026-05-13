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
// Validation helpers
// ---------------------------------------------------------------------------

const SNOWFLAKE_RE = /^\d{17,19}$/;

const CHECKS = {
    nullBytes:     (v) => typeof v === "string" && v.includes("\x00"),
    nonNFC:        (v) => typeof v === "string" && v !== v.normalize("NFC"),
    badSnowflake:  (v) => typeof v === "string" && v !== null && !SNOWFLAKE_RE.test(v),
    overlength:    (v, max) => typeof v === "string" && v.length > max,
};

function checkValue(label, raw, decrypted, maxLen) {
    const issues = [];
    const val = decrypted !== undefined ? decrypted : raw;
    if (val === null || val === undefined) return issues;
    if (CHECKS.nullBytes(val))               issues.push(`null-byte in ${label}`);
    if (CHECKS.nonNFC(val))                  issues.push(`non-NFC Unicode in ${label}`);
    if (maxLen && CHECKS.overlength(val, maxLen)) issues.push(`${label} exceeds max ${maxLen} (len=${val.length})`);
    return issues;
}

function fixValue(val) {
    if (typeof val !== "string") return { fixed: val, changed: false };
    let fixed = val.replace(/\x00/g, ""); // strip null bytes
    fixed = fixed.normalize("NFC");       // NFC normalize
    return { fixed, changed: fixed !== val };
}

// ---------------------------------------------------------------------------
// Schema definition: which columns to check, whether they're encrypted,
// max lengths, and whether they're snowflakes.
// ---------------------------------------------------------------------------

// Each entry: { table, pk, columns: [{ name, encrypted?, maxLen?, snowflake?, fixable? }] }
const SCHEMA = [
    {
        table: "mentionResponses",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "gid",      snowflake: true },
            { name: "trigger",  encrypted: true, maxLen: 200,  fixable: true },
            { name: "response", encrypted: true, maxLen: 2000, fixable: true },
            { name: "image",    encrypted: true, fixable: true },
        ],
    },
    {
        table: "guilds",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "id",               snowflake: true },
            { name: "prefix",           maxLen: 10, fixable: false },
            { name: "onJoinDMMsg",      encrypted: true, maxLen: 2000, fixable: true },
            { name: "onJoinDMMsgTitle", encrypted: true, maxLen: 255, fixable: true },
        ],
    },
    {
        table: "botBans",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "id",       snowflake: true },
            { name: "type",     fixable: false }, // enum: user/guild
            { name: "reason",   encrypted: true, maxLen: 500, fixable: true },
            { name: "bannedBy", snowflake: false, fixable: false },
        ],
    },
    {
        table: "modActions",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "gid",         snowflake: true },
            { name: "moderatorId", snowflake: true },
            { name: "targetId",    snowflake: true },
            { name: "reason",      encrypted: true, maxLen: 500, fixable: true },
        ],
    },
    {
        table: "dmInbox",
        pk: "id",
        updatePk: true,
        columns: [
            { name: "usrId",       snowflake: true },
            { name: "userTag",     maxLen: 200, fixable: true },
            { name: "content",     encrypted: true, maxLen: 4000, fixable: true },
            { name: "attachments", encrypted: true, fixable: true },
        ],
    },
    {
        table: "banImages",
        pk: ["gid", "banner"],
        columns: [
            { name: "gid",    snowflake: true },
            { name: "banner", snowflake: true },
            { name: "image",  encrypted: true, fixable: true },
        ],
    },
    {
        table: "botPresence",
        pk: "id",
        columns: [
            { name: "text",      maxLen: 500, fixable: true },
            { name: "streamUrl", maxLen: 500, fixable: true },
        ],
    },
];

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

for (const { table, pk, columns } of SCHEMA) {
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
            const issues = checkValue(col.name, raw, col.encrypted && passphrase ? decrypted : undefined, col.maxLen);
            if (issues.length > 0) {
                for (const iss of issues) {
                    rowIssues.push(`  ⚠  ${rowLabel}: ${iss}`);
                }

                if (col.fixable && passphrase !== null || (col.fixable && !col.encrypted)) {
                    const { fixed, changed } = fixValue(decrypted);
                    if (changed) {
                        // Re-encrypt if the field was encrypted
                        rowFixes[col.name] = col.encrypted && passphrase
                            ? _tryEncrypt(fixed, passphrase)
                            : fixed;
                    }
                } else if (!col.fixable) {
                    canFixAll = false;
                }
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

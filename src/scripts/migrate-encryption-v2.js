#!/usr/bin/env node
/*
    migrate-encryption-v2.js — Migrate field-level encryption from V1 to V2 format.

    V1 (legacy): salt(16) + iv(16) + authTag(16) + ciphertext
      PBKDF2 (100k iterations) is run on EVERY decrypt call, blocking the event loop.

    V2 (current): YN\x02\x00(4) + iv(12) + authTag(16) + ciphertext
      Master key is derived ONCE at startup; all encrypt/decrypt calls are fast AES-GCM.

    Run this script ONCE after upgrading to the V2 cryptoUtils. After migration the
    bot will never hit the legacy pbkdf2Sync path and the event loop blocking goes away.

    Usage:
      node --experimental-sqlite src/scripts/migrate-encryption-v2.js --passphrase=<key>

    Options:
      --db=<path>          Path to SQLite database file (default: read from config.json)
      --passphrase=<key>   Encryption passphrase (required)
      --dry-run            Show what would be migrated without writing any changes
      --help               Show this message

    Exit codes:
      0  Migration complete (or nothing to migrate).
      1  Error during migration.
      2  Fatal error (bad args, database not found, etc.).
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
        if (arg === "--dry-run") return [["dryRun", true]];
        if (arg === "--help")    return [["help", true]];
        const m = arg.match(/^--([a-zA-Z-]+)=(.+)$/);
        return m ? [[m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()), m[2]]] : [];
    })
);

if (args.help) {
    console.log(fs.readFileSync(__filename, "utf8").match(/\/\*[\s\S]*?\*\//)[0].replace(/^\/\*\s*|\s*\*\/$/g, ""));
    process.exit(0);
}

const passphrase = args.passphrase;
if (!passphrase) {
    console.error("[FATAL] --passphrase=<key> is required.");
    process.exit(2);
}

// ---------------------------------------------------------------------------
// Database connection (same driver priority as database.js)
// ---------------------------------------------------------------------------

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

let db;
try {
    const { DatabaseSync } = require("node:sqlite");
    db = new DatabaseSync(resolvedPath);
    console.log("[DB] Using node:sqlite (native)");
} catch {
    try {
        const sqlcipher = require("@journeyapps/sqlcipher");
        db = new sqlcipher.Database(resolvedPath);
        console.log("[DB] Using sqlcipher");
    } catch {
        try {
            const sqlite3 = require("sqlite3");
            db = new sqlite3.Database(resolvedPath);
            console.log("[DB] Using sqlite3");
        } catch {
            console.error("[FATAL] No SQLite driver available.");
            process.exit(2);
        }
    }
}

// ---------------------------------------------------------------------------
// Sync query helpers
// ---------------------------------------------------------------------------

function queryAll(sql, params = []) {
    if (db.prepare) return db.prepare(sql).all(...params);
    let done = false, rows, err;
    db.all(sql, params, (e, r) => { err = e; rows = r; done = true; });
    const deadline = Date.now() + 10000;
    while (!done && Date.now() < deadline) { /* spin — script context only */ }
    if (err) throw err;
    return rows || [];
}

function runSql(sql, params = []) {
    if (db.prepare) { db.prepare(sql).run(...params); return; }
    let done = false, err;
    db.run(sql, params, e => { err = e; done = true; });
    const deadline = Date.now() + 10000;
    while (!done && Date.now() < deadline) { /* spin */ }
    if (err) throw err;
}

// ---------------------------------------------------------------------------
// V1 / V2 crypto constants
// ---------------------------------------------------------------------------

const ALGORITHM    = "aes-256-gcm";
const AUTH_TAG_LEN = 16;

// V2
const V2_MAGIC  = Buffer.from([0x59, 0x4E, 0x02, 0x00]);
const V2_IV_LEN = 12;

// V1 (legacy)
const V1_SALT_LEN = 16;
const V1_IV_LEN   = 16;
const V1_MIN_LEN  = V1_SALT_LEN + V1_IV_LEN + AUTH_TAG_LEN + 1; // 49

// ---------------------------------------------------------------------------
// Key derivation (async to avoid blocking during migration)
// ---------------------------------------------------------------------------

function pbkdf2Async(passphrase, salt, iterations, keylen, digest) {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(passphrase, salt, iterations, keylen, digest, (err, key) => {
            if (err) reject(err); else resolve(key);
        });
    });
}

async function deriveMasterKeyV2(passphrase) {
    const salt = crypto.createHash("sha256")
        .update("yuno-gasai-field-encryption-v2-salt:")
        .update(passphrase)
        .digest();
    return pbkdf2Async(passphrase, salt, 100_000, 32, "sha256");
}

async function deriveKeyV1(salt) {
    return pbkdf2Async(passphrase, salt, 100_000, 32, "sha256");
}

// ---------------------------------------------------------------------------
// Detect and decode formats
// ---------------------------------------------------------------------------

function isV2(buf) {
    const minV2 = V2_MAGIC.length + V2_IV_LEN + AUTH_TAG_LEN + 1;
    return buf.length >= minV2 && buf.slice(0, V2_MAGIC.length).equals(V2_MAGIC);
}

function isV1(buf) {
    return buf.length >= V1_MIN_LEN && !isV2(buf);
}

async function decryptV1(buf) {
    const salt    = buf.slice(0, V1_SALT_LEN);
    const iv      = buf.slice(V1_SALT_LEN, V1_SALT_LEN + V1_IV_LEN);
    const authTag = buf.slice(V1_SALT_LEN + V1_IV_LEN, V1_SALT_LEN + V1_IV_LEN + AUTH_TAG_LEN);
    const cipher  = buf.slice(V1_SALT_LEN + V1_IV_LEN + AUTH_TAG_LEN);
    const key = await deriveKeyV1(salt);
    const dec = crypto.createDecipheriv(ALGORITHM, key, iv);
    dec.setAuthTag(authTag);
    return Buffer.concat([dec.update(cipher), dec.final()]).toString("utf8");
}

function encryptV2(plaintext, masterKey) {
    const iv  = crypto.randomBytes(V2_IV_LEN);
    const enc = crypto.createCipheriv(ALGORITHM, masterKey, iv);
    const encrypted = Buffer.concat([enc.update(String(plaintext), "utf8"), enc.final()]);
    const authTag = enc.getAuthTag();
    return Buffer.concat([V2_MAGIC, iv, authTag, encrypted]).toString("base64");
}

// ---------------------------------------------------------------------------
// Schema: every encrypted column that needs migrating
// ---------------------------------------------------------------------------

const SCHEMA = [
    { table: "mentionResponses", pk: "id",    columns: ["trigger", "response", "image"] },
    { table: "guilds",           pk: "id",    columns: ["onJoinDMMsg", "onJoinDMMsgTitle"] },
    { table: "botBans",          pk: "id",    columns: ["reason"] },
    { table: "modActions",       pk: "id",    columns: ["reason"] },
    { table: "dmInbox",          pk: "id",    columns: ["content", "attachments"] },
    { table: "banImages",        pk: "id",    columns: ["image"] },
];

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function migrateTable(masterKey, tableSpec) {
    const { table, pk, columns } = tableSpec;

    let rows;
    try {
        rows = queryAll(`SELECT * FROM ${table}`);
    } catch {
        // Table may not exist in all deployments
        return { skipped: 0, migrated: 0, errors: 0 };
    }

    let migrated = 0, skipped = 0, errors = 0;

    for (const row of rows) {
        const updates = {};

        for (const col of columns) {
            const raw = row[col];
            if (raw === null || raw === undefined) { skipped++; continue; }

            let buf;
            try {
                buf = Buffer.from(String(raw), "base64");
            } catch {
                skipped++;
                continue;
            }

            if (isV2(buf)) {
                skipped++;
                continue; // already V2
            }

            if (!isV1(buf)) {
                skipped++;
                continue; // unencrypted / too short
            }

            // V1 → decrypt async (no event loop blocking), re-encrypt as V2
            try {
                const plaintext = await decryptV1(buf);
                updates[col] = encryptV2(plaintext, masterKey);
                migrated++;
            } catch (e) {
                console.error(`  [ERROR] ${table}.${col} row ${row[pk]}: ${e.message}`);
                errors++;
            }
        }

        if (Object.keys(updates).length === 0) continue;

        if (args.dryRun) {
            console.log(`  [DRY-RUN] Would update ${table} row ${row[pk]}: ${Object.keys(updates).join(", ")}`);
            continue;
        }

        const setClauses = Object.keys(updates).map(c => `${c} = ?`).join(", ");
        const values = [...Object.values(updates), row[pk]];
        try {
            runSql(`UPDATE ${table} SET ${setClauses} WHERE ${pk} = ?`, values);
        } catch (e) {
            console.error(`  [ERROR] Failed to update ${table} row ${row[pk]}: ${e.message}`);
            errors++;
            migrated -= Object.keys(updates).length;
        }
    }

    return { migrated, skipped, errors };
}

async function main() {
    console.log(`\nEncryption V1 → V2 migration`);
    console.log(`Database : ${resolvedPath}`);
    if (args.dryRun) console.log(`Mode     : DRY RUN (no changes will be written)`);
    console.log("");

    console.log("Deriving V2 master key (async PBKDF2, ~1s)...");
    const masterKey = await deriveMasterKeyV2(passphrase);
    console.log("Master key ready.\n");

    let totalMigrated = 0, totalSkipped = 0, totalErrors = 0;

    for (const tableSpec of SCHEMA) {
        process.stdout.write(`Migrating ${tableSpec.table}...`);
        const { migrated, skipped, errors } = await migrateTable(masterKey, tableSpec);
        console.log(` ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
        totalMigrated += migrated;
        totalSkipped  += skipped;
        totalErrors   += errors;
    }

    console.log(`\n${"─".repeat(50)}`);
    console.log(`Total migrated : ${totalMigrated}`);
    console.log(`Total skipped  : ${totalSkipped} (already V2 or not encrypted)`);
    console.log(`Total errors   : ${totalErrors}`);

    if (totalErrors > 0) {
        console.error("\nMigration completed with errors. Check output above.");
        process.exit(1);
    }

    if (totalMigrated === 0) {
        console.log("\nNothing to migrate — all rows are already V2.");
    } else if (!args.dryRun) {
        console.log("\nMigration complete. Restart the bot — event loop blocking should be gone.");
    }
}

main().catch(e => {
    console.error("[FATAL]", e.message);
    process.exit(1);
});

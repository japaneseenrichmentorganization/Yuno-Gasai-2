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

// Database driver detection - priority: native SQLite > sqlcipher > sqlite3
let sqlite;
let encryptionAvailable = false;
let useNativeSQLite = false;
let DatabaseImpl;

// Try Node.js 24+ native SQLite first
try {
    const { DatabaseSync } = require('node:sqlite');
    useNativeSQLite = true;
    console.log("[Database] Using Node.js 24 native SQLite");
} catch (e) {
    // Native SQLite not available, try npm packages
    try {
        sqlite = require("@journeyapps/sqlcipher");
        encryptionAvailable = true;
        console.log("[Database] Using @journeyapps/sqlcipher (encryption available)");
    } catch (e2) {
        try {
            sqlite = require("sqlite3");
            console.log("[Database] Using sqlite3 npm package");
        } catch (e3) {
            throw new Error("No SQLite implementation available. Install sqlite3 or use Node.js 24+");
        }
    }
}

/**
 * Native SQLite Database wrapper for Node.js 24+
 * Uses synchronous API wrapped in async for compatibility
 */
class NativeDatabase {
    constructor() {
        this.db = null;
        this.isEncrypted = false;
    }

    isEncryptionAvailable() {
        return false; // Native SQLite doesn't support encryption
    }

    async open(file, options = {}) {
        const { DatabaseSync } = require('node:sqlite');

        if (options.password) {
            console.warn("[Database] Encryption requested but Node.js native SQLite doesn't support encryption. Use @journeyapps/sqlcipher instead.");
        }

        this.db = new DatabaseSync(file);

        // Apply PRAGMA optimizations
        if (options.pragmas) {
            await this._applyPragmas(options.pragmas);
        }

        return this;
    }

    async _applyPragmas(pragmas) {
        const pragmaStatements = [];

        if (pragmas.walMode) {
            pragmaStatements.push("PRAGMA journal_mode = WAL");
        }

        if (pragmas.performanceMode) {
            pragmaStatements.push(
                "PRAGMA synchronous = NORMAL",
                "PRAGMA temp_store = MEMORY",
                "PRAGMA cache_size = -64000",
                "PRAGMA mmap_size = 268435456"
            );
        }

        if (typeof pragmas.cacheSize === "number") {
            pragmaStatements.push(`PRAGMA cache_size = ${pragmas.cacheSize}`);
        }

        if (pragmas.memoryTemp === true) {
            pragmaStatements.push("PRAGMA temp_store = MEMORY");
        }

        if (typeof pragmas.mmapSize === "number") {
            pragmaStatements.push(`PRAGMA mmap_size = ${pragmas.mmapSize}`);
        }

        // Execute all PRAGMAs (they're fast, sequential is fine for setup)
        for (const pragma of pragmaStatements) {
            this.db.exec(pragma);
        }
    }

    prepare(sql, param) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return Promise.resolve(new NativeStatement(this.db.prepare(sql)));
    }

    run(sqlCommand, param, callback) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        try {
            const stmt = this.db.prepare(sqlCommand);
            const result = param ? stmt.run(...(Array.isArray(param) ? param : [param])) : stmt.run();
            callback?.(null);
            return result;
        } catch (err) {
            callback?.(err);
        }
    }

    runPromise(sqlCommand, param) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare(sqlCommand);
                const result = param ? stmt.run(...(Array.isArray(param) ? param : [param])) : stmt.run();
                resolve({ lastID: result.lastInsertRowid, changes: result.changes });
            } catch (err) {
                reject(err);
            }
        });
    }

    each(sql, param, callback, complete) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        try {
            const stmt = this.db.prepare(sql);
            const rows = param ? stmt.all(...(Array.isArray(param) ? param : [param])) : stmt.all();
            for (const row of rows) {
                callback(null, row);
            }
            complete?.();
        } catch (err) {
            callback(err, null);
        }
    }

    all(sql, param, callback) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        try {
            const stmt = this.db.prepare(sql);
            const rows = param ? stmt.all(...(Array.isArray(param) ? param : [param])) : stmt.all();
            callback?.(null, rows);
            return rows;
        } catch (err) {
            callback?.(err, null);
        }
    }

    allPromise(sql, param) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return new Promise((resolve, reject) => {
            try {
                const stmt = this.db.prepare(sql);
                const rows = param ? stmt.all(...(Array.isArray(param) ? param : [param])) : stmt.all();
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    }

    close(callback) {
        if (this.db === null) {
            return callback?.();
        }
        this.db.close();
        this.db = null;
        callback?.();
    }

    closePromise() {
        if (this.db === null) {
            return Promise.resolve();
        }
        this.db.close();
        this.db = null;
        return Promise.resolve();
    }

    rekey(newPassword) {
        return Promise.reject(new Error("Encryption not supported with native SQLite"));
    }
}

/**
 * Native SQLite Statement wrapper
 */
class NativeStatement {
    constructor(stmt) {
        this.stmt = stmt;
    }

    bind(param) {
        // Native SQLite handles binding differently - parameters are passed at execution time
        return Promise.resolve(this);
    }

    reset() {
        // Native statements auto-reset
        return Promise.resolve(this);
    }

    run(param) {
        return new Promise((resolve, reject) => {
            try {
                const result = param ? this.stmt.run(...(Array.isArray(param) ? param : [param])) : this.stmt.run();
                resolve({ lastID: result.lastInsertRowid, changes: result.changes });
            } catch (err) {
                reject(err);
            }
        });
    }

    get(param) {
        return new Promise((resolve, reject) => {
            try {
                const row = param ? this.stmt.get(...(Array.isArray(param) ? param : [param])) : this.stmt.get();
                resolve(row);
            } catch (err) {
                reject(err);
            }
        });
    }

    all(param) {
        return new Promise((resolve, reject) => {
            try {
                const rows = param ? this.stmt.all(...(Array.isArray(param) ? param : [param])) : this.stmt.all();
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        });
    }

    finalize() {
        // Native statements don't need explicit finalization
        return Promise.resolve();
    }
}

/**
 * Legacy sqlite3/sqlcipher Statement wrapper
 */
class LegacyStatement {
    constructor(stmt) {
        this.stmt = stmt;
    }

    bind(param) {
        return new Promise((resolve, reject) => {
            this.stmt.bind(param, (err) => {
                err ? reject(err) : resolve(this);
            });
        });
    }

    reset() {
        return new Promise((resolve, reject) => {
            this.stmt.reset((err) => {
                err ? reject(err) : resolve(this);
            });
        });
    }

    run(param) {
        return new Promise((resolve, reject) => {
            this.stmt.run(param, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(param) {
        return new Promise((resolve, reject) => {
            this.stmt.get(param, (err, row) => {
                err ? reject(err) : resolve(row);
            });
        });
    }

    all(param) {
        return new Promise((resolve, reject) => {
            this.stmt.all(param, (err, rows) => {
                err ? reject(err) : resolve(rows);
            });
        });
    }

    finalize() {
        return new Promise((resolve, reject) => {
            this.stmt.finalize((err) => {
                err ? reject(err) : resolve();
            });
        });
    }
}

/**
 * Legacy sqlite3/sqlcipher Database wrapper
 */
class LegacyDatabase {
    constructor() {
        this.db = null;
        this.isEncrypted = false;
    }

    isEncryptionAvailable() {
        return encryptionAvailable;
    }

    open(file, options = {}) {
        return new Promise((resolve, reject) => {
            this.db = new sqlite.Database(file, async (err) => {
                if (err) {
                    reject(new Error(`Impossible to connect to the database ${file}. ${err.message}`));
                    return;
                }

                try {
                    // Apply encryption if password provided and sqlcipher is available
                    if (options.password && encryptionAvailable) {
                        await this.runPromise(`PRAGMA key = '${options.password.replace(/'/g, "''")}'`);
                        this.isEncrypted = true;
                    } else if (options.password && !encryptionAvailable) {
                        console.warn("[Database] Encryption requested but @journeyapps/sqlcipher is not installed. Database will be unencrypted.");
                    }

                    // Apply PRAGMA optimizations if configured
                    if (options.pragmas) {
                        await this._applyPragmas(options.pragmas);
                    }

                    resolve(this);
                } catch (pragmaErr) {
                    reject(new Error(`Failed to configure database: ${pragmaErr.message}`));
                }
            });
        });
    }

    async _applyPragmas(pragmas) {
        // Collect all PRAGMA statements for potential parallel execution
        const pragmaPromises = [];

        if (pragmas.walMode) {
            pragmaPromises.push(this.runPromise("PRAGMA journal_mode = WAL"));
        }

        // Performance mode settings can be run in parallel
        if (pragmas.performanceMode) {
            pragmaPromises.push(
                this.runPromise("PRAGMA synchronous = NORMAL"),
                this.runPromise("PRAGMA temp_store = MEMORY"),
                this.runPromise("PRAGMA cache_size = -64000"),
                this.runPromise("PRAGMA mmap_size = 268435456")
            );
        }

        // Individual settings
        if (typeof pragmas.cacheSize === "number") {
            pragmaPromises.push(this.runPromise(`PRAGMA cache_size = ${pragmas.cacheSize}`));
        }

        if (pragmas.memoryTemp === true) {
            pragmaPromises.push(this.runPromise("PRAGMA temp_store = MEMORY"));
        }

        if (typeof pragmas.mmapSize === "number") {
            pragmaPromises.push(this.runPromise(`PRAGMA mmap_size = ${pragmas.mmapSize}`));
        }

        // Execute all PRAGMAs in parallel for faster initialization
        await Promise.all(pragmaPromises);
    }

    rekey(newPassword) {
        if (!encryptionAvailable) {
            return Promise.reject(new Error("Encryption not available. Install @journeyapps/sqlcipher"));
        }
        return this.runPromise(`PRAGMA rekey = '${newPassword.replace(/'/g, "''")}'`);
    }

    prepare(sql, param) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(sql, param, (err) => {
                err ? reject(err) : resolve(new LegacyStatement(stmt));
            });
        });
    }

    run(sqlCommand, param, callback) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return this.db.run(sqlCommand, param, callback);
    }

    runPromise(sqlCommand, param) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return new Promise((resolve, reject) => {
            this.db.run(sqlCommand, param, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    each(sql, param, callback, complete) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return this.db.each(sql, param, callback, complete);
    }

    all(sql, param, callback) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return this.db.all(sql, param, callback);
    }

    allPromise(sql, param) {
        if (this.db === null) {
            throw new Error("Tried to access database, but not opened!");
        }
        return new Promise((resolve, reject) => {
            this.db.all(sql, param, (err, rows) => {
                err ? reject(err) : resolve(rows);
            });
        });
    }

    close(callback) {
        if (this.db === null) {
            return callback?.();
        }

        return this.db.close(() => {
            this.db = null;
            callback?.();
        });
    }

    closePromise() {
        if (this.db === null) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.db.close(() => {
                this.db = null;
                resolve();
            });
        });
    }
}

// Export the appropriate database class
DatabaseImpl = useNativeSQLite ? NativeDatabase : LegacyDatabase;

// Add static method to check which implementation is in use
DatabaseImpl.isNativeSQLite = () => useNativeSQLite;
DatabaseImpl.isEncryptionAvailable = () => encryptionAvailable;

module.exports = DatabaseImpl;

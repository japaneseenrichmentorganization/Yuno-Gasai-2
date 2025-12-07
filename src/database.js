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

// Try to load sqlcipher for encryption support, fall back to regular sqlite3
let sqlite;
let encryptionAvailable = false;

try {
    sqlite = require("@journeyapps/sqlcipher");
    encryptionAvailable = true;
} catch (e) {
    sqlite = require("sqlite3");
    encryptionAvailable = false;
}

let instance = null;

/**
 * A sqlite3 database with optional encryption and PRAGMA optimization support.
 * @constructor
 * @singleton
 */
let Database = function() {
    this.db = null;
    this.isEncrypted = false;
}

/**
 * Returns whether encryption is available (sqlcipher installed)
 * @return {boolean}
 */
Database.prototype.isEncryptionAvailable = function() {
    return encryptionAvailable;
}

/**
 * Opens a file as a sqlite3 database.
 * @param {String} file Path to the database.
 * @param {Object} [options] Database options
 * @param {String} [options.password] Encryption password (requires @journeyapps/sqlcipher)
 * @param {Object} [options.pragmas] PRAGMA settings to apply
 * @param {boolean} [options.pragmas.walMode] Enable WAL journal mode
 * @param {boolean} [options.pragmas.performanceMode] Enable performance optimizations
 * @param {number} [options.pragmas.cacheSize] Cache size in KB (negative) or pages (positive)
 * @param {boolean} [options.pragmas.memoryTemp] Store temp tables in memory
 * @param {number} [options.pragmas.mmapSize] Memory-map size in bytes
 * @return {Promise}
 * @async
 */
Database.prototype.open = function(file, options) {
    options = options || {};

    return new Promise((function(resolve, reject) {
        this.db = new sqlite.Database(file, (async function(err) {
            if (err) {
                reject(new Error("Impossible to connect to the database " + file + ". " + err.message));
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
                reject(new Error("Failed to configure database: " + pragmaErr.message));
            }
        }).bind(this));
    }).bind(this));
}

/**
 * Apply PRAGMA settings for optimization
 * @param {Object} pragmas PRAGMA configuration object
 * @private
 * @async
 */
Database.prototype._applyPragmas = async function(pragmas) {
    // WAL mode - better concurrency and performance
    if (pragmas.walMode) {
        await this.runPromise("PRAGMA journal_mode = WAL");
    }

    // Performance mode - bundle of safe optimizations
    if (pragmas.performanceMode) {
        await this.runPromise("PRAGMA synchronous = NORMAL");
        await this.runPromise("PRAGMA temp_store = MEMORY");
        await this.runPromise("PRAGMA cache_size = -64000"); // 64MB cache
        await this.runPromise("PRAGMA mmap_size = 268435456"); // 256MB mmap
    }

    // Individual settings (override performanceMode if set)
    if (typeof pragmas.cacheSize === "number") {
        await this.runPromise("PRAGMA cache_size = " + pragmas.cacheSize);
    }

    if (pragmas.memoryTemp === true) {
        await this.runPromise("PRAGMA temp_store = MEMORY");
    }

    if (typeof pragmas.mmapSize === "number") {
        await this.runPromise("PRAGMA mmap_size = " + pragmas.mmapSize);
    }
}

/**
 * Change the encryption key on an open database
 * @param {String} newPassword The new encryption password
 * @return {Promise}
 * @async
 */
Database.prototype.rekey = function(newPassword) {
    if (!encryptionAvailable) {
        return Promise.reject(new Error("Encryption not available. Install @journeyapps/sqlcipher"));
    }

    return this.runPromise(`PRAGMA rekey = '${newPassword.replace(/'/g, "''")}'`);
}

/**
 * Runs a SQL command
 * @throws {Error} When method is triggered but the db is not opened.
 * @param {String} sqlCommand
 * @param {array|Object} [param] The ? and $value in the SQL command. See https://github.com/mapbox/node-sqlite3/wiki/API#databaserunsql-param--callback
 * @param {function(e)?} [callback] Error is null on success, otherwise, it contains the error
 */
Database.prototype.run = function(sqlCommand, param, callback) {
    if (this.db === null)
        throw new Error("Tryied to access database, but not opened!");
    return this.db.run(sqlCommand, param, callback);
}

/**
 * Runs a SQL command but returns a Promise instead of {@link Database.prototype.run}
 * @throws {Error} When method is triggered but the db is not opened.
 * @param {String} sqlCommand
 * @param {array|Object} [param] The ? and $value in the SQL command. See https://github.com/mapbox/node-sqlite3/wiki/API#databaserunsql-param--callback
 * @returns {Promise}
 */
Database.prototype.runPromise = function(sqlCommand, param) {
    if (this.db === null)
        throw new Error("Tryied to access database, but not opened!");
    return new Promise((function(resolve, reject) {
        this.run(sqlCommand, param, (function(err) {
            if (err)
                reject(err);
            else
                resolve();
        }))
    }).bind(this));
}

/**
 * Retriggers callback for every row returned by the SQL command
 * @throws {Error} When method is triggered but the db is not opened.
 * @param {String} sql The SQL command
 * @param {array|Object} [param] The placeholders.
 * @param {function(err, row)} [callback] Called at every row.
 * @param {function} [complete] Executed when the iteration is done.
 */
Database.prototype.each = function(sql, param, callback, complete) {
    if (this.db === null)
        throw new Error("Tryied to access database, but not opened!");
    return this.db.each(sql, param, callback, complete);
}

/**
 * Executes a SQL command and returns the given rows :
 * Triggers callback with all returned row of the SQL Command.
 * @throws {Error} When method is triggered but the db is not opened.
 * @param {String} sql The SQL command
 * @param {array|Object} [param] The placeholders.
 * @param {function(err, rows)} [callback]
 */
Database.prototype.all = function(sql, param, callback) {
    if (this.db === null)
        throw new Error("Tryied to access database, but not opened!");
    return this.db.all(sql, param, callback);
}

/**
 * Executes a SQL command and returns the given rows through the callback and the Promise's onfulfilled
 * @throws {Error} When method is triggered but the db is not opened.
 * @param {String} sql The SQL command
 * @param {array|Object} [param] The placeholders.
 * @return {Promise} onfulfilled(err|rows)
 */
Database.prototype.allPromise = function(sql, param) {
    if (this.db === null)
        throw new Error("Tryied to access database, but not opened!");
    return new Promise((function(resolve, reject) {
        this.db.all(sql, param, function(err, rows) {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    }).bind(this));
}

/**
 * Close the database.
 */
Database.prototype.close = function(callback) {
    if (this.db === null)
        return callback();

    let callback_ = (function() {
        this.db = null;
        return callback();
    }).bind(this);

    return this.db.close(callback_);
}

/**
 * Close the database but with a promise.
 */
Database.prototype.closePromise = function() {
    if (this.db === null)
        return Promise.resolve();

    return new Promise((function(resolve, reject) {
        this.db.close((function() {
            this.db = null;
            resolve();
        }).bind(this))
    }).bind(this));
}

module.exports = Database;

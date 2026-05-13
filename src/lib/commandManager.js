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

const EventEmitter = require("events"),
    fsPromises = require("fs").promises,
    path = require("path"),
    { GuildMember, PermissionsBitField } = require("discord.js"),
    prompt = require("./prompt").init();

let insufficientPermissionsMessage = "Insufficient permissions.",
    masterusers = [];

// ---------------------------------------------------------------------------
// Per-user token-bucket rate limiter with refill jitter + exponential backoff
//
// Why token bucket over simple sliding window?
//   A fixed-window counter has a predictable reset boundary that a state-actor
//   can profile (send N-1 commands, wait for reset, repeat indefinitely without
//   ever triggering the limit).  A token bucket has no hard window edge — tokens
//   are replenished continuously, so there is no observable "reset" moment to
//   exploit.
//
// Why jitter on the refill rate?
//   Even knowing the nominal refill rate an attacker could pace requests to stay
//   just under it.  The ±JITTER_FACTOR variance makes the effective refill rate
//   non-deterministic on each check, so the attacker cannot reliably calculate
//   when they will have exactly 1 token available.
//
// Why exponential backoff with jitter?
//   After repeated violations the backoff duration doubles each time.  Adding
//   random jitter to the backoff window prevents a "thundering herd" of
//   coordinated accounts all resuming at the same instant and also defeats
//   timing-based reconnaissance of how long the penalty lasts.
// ---------------------------------------------------------------------------

const _rlBuckets = new Map(); // userId -> { tokens, lastRefill, violations, backoffUntil }

const RL = {
    CAPACITY_REGULAR:  5,      // max burst for regular users
    CAPACITY_MASTER:   20,
    REFILL_RATE_REG:   0.8,    // tokens/second for regular (≈ 1 cmd per 1.25 s sustained)
    REFILL_RATE_MASTER: 4,
    JITTER_FACTOR:     0.25,   // ±25 % variance applied to each refill calculation
    BASE_BACKOFF_MS:   1_000,  // 1 s base backoff; doubles per violation
    MAX_BACKOFF_MS:    120_000, // caps at 2 minutes
    MAX_VIOLATIONS:    10,     // exponent cap to prevent integer overflow
};

function _checkRateLimit(userId, isMaster) {
    const now = Date.now();
    const capacity   = isMaster ? RL.CAPACITY_MASTER   : RL.CAPACITY_REGULAR;
    const refillRate = isMaster ? RL.REFILL_RATE_MASTER : RL.REFILL_RATE_REG;

    let entry = _rlBuckets.get(userId);
    if (!entry) {
        // New user — start with a full bucket, no violations.
        entry = { tokens: capacity, lastRefill: now, violations: 0, backoffUntil: 0 };
        _rlBuckets.set(userId, entry);
    }

    // --- exponential backoff check ---
    if (now < entry.backoffUntil) return true; // still penalised

    // --- token refill with jitter ---
    const elapsedSec = (now - entry.lastRefill) / 1000;
    // Jitter multiplier: uniform in [1 - JITTER_FACTOR, 1 + JITTER_FACTOR]
    const jitter = 1 + (Math.random() * 2 - 1) * RL.JITTER_FACTOR;
    entry.tokens = Math.min(capacity, entry.tokens + elapsedSec * refillRate * jitter);
    entry.lastRefill = now;

    // --- consume a token or deny ---
    if (entry.tokens < 1) {
        // Violation: escalate backoff.
        entry.violations = Math.min(entry.violations + 1, RL.MAX_VIOLATIONS);
        const rawBackoff = RL.BASE_BACKOFF_MS * Math.pow(2, entry.violations - 1);
        // Jitter on backoff: uniform in [0.75×, 1.25×] of the computed duration.
        const backoffJitter = rawBackoff * (0.75 + Math.random() * 0.5);
        entry.backoffUntil = now + Math.min(backoffJitter, RL.MAX_BACKOFF_MS);
        return true; // rate-limited
    }

    entry.tokens -= 1;
    // Slowly forgive past violations on successful, un-throttled commands.
    if (entry.violations > 0) entry.violations -= 1;
    return false; // allowed
}

// Amortised map cleanup: evict entries whose backoff has expired and bucket is
// essentially full (they would be re-initialised identically on next touch).
let _rlTrimCounter = 0;
function _maybeCleanRateLimitMap() {
    if (++_rlTrimCounter < 500) return;
    _rlTrimCounter = 0;
    const now = Date.now();
    for (const [uid, entry] of _rlBuckets) {
        if (entry.backoffUntil < now && entry.violations === 0) _rlBuckets.delete(uid);
    }
}

/**
 * A command manager.
 * Parses commands, triggers them, returns error messages, etc...
 * @extends EventEmitter
 */
class CommandManager extends EventEmitter {
    /**
     * @param {String} [directory] Path to the commands directory. Defaults to src/commands
     */
    constructor(directory) {
        super();

        if (typeof directory !== "string")
            directory = path.resolve(__dirname, "../commands");

        this.directory = directory;
        this.commands = {};
    }

    /**
     * Returns the directory for backup
     * @return {String}
     */
    backup() {
        return this.directory;
    }

    /**
     * Inits the command manager by reading all commands in the specified directory.
     */
    async init() {
        const files = await fsPromises.readdir(this.directory, "utf8");
        let cmdLoaded = 0;

        for (const file of files) {
            await this.readCommand(file);
            cmdLoaded++;
        }

        prompt.info(`A total of ${cmdLoaded} command(s) has been loaded.`);
        this.emit("loaded");
    }

    /**
     * Clears the cache of require for a specified file and resolve the file's path.
     * @param {String} file Path to the file.
     * @private
     * @returns {String} The path to the file, resolved.
     */
    _clearCache(file) {
        if (file.endsWith(".js")) {
            file = file.slice(0, -3);
        }

        file = require.resolve(`${this.directory}/${file}`);

        if (require.cache[file]) {
            delete require.cache[file];
        }

        return file;
    }

    /**
     * Returns only the filename of a full path
     * @param {String} file
     * @return {String} The file name.
     */
    _onlyFileName(file) {
        const extensionIndex = file.lastIndexOf(".");
        const extension = file.substring(extensionIndex, file.length);
        return path.basename(file, extension);
    }

    /**
     * Reads a command from a file (module-like.)
     * @param {String} file Path to the file.
     * @returns {Promise}
     */
    async readCommand(file) {
        file = this._clearCache(file);

        let commandModule;
        try {
            commandModule = require(file);
        } catch (e) {
            throw e;
        }

        if (!commandModule.about || !commandModule.about.command || typeof commandModule.about.command !== "string") {
            if (typeof commandModule.about === "object")
                commandModule.about.command = this._onlyFileName(file);
            else
                commandModule.about = {
                    command: this._onlyFileName(file)
                };
        }

        // check for duplicates
        if (this._commandExists(commandModule.about.command))
            throw new Error(`Tried to push a command called ${commandModule.about.command} but it already exists.`);

        this.commands[commandModule.about.command] = commandModule;

        let aliases = commandModule.about.aliases;

        if (typeof aliases === "string")
            aliases = [aliases];
        if (Array.isArray(aliases)) {
            for (const alias of aliases)
                this.commands[alias] = commandModule;
        }

        prompt.info(`Command ${commandModule.about.command} has been loaded.`);
    }

    /**
     * Parse the command, returning an object containing the command and the args.
     * @param {String} command
     * @returns {Object}
     */
    _parse(command) {
        const mainCommandSubstr = command.indexOf(" ");
        const mainCommand = command.substring(0, mainCommandSubstr > -1 ? mainCommandSubstr : command.length).toLowerCase();
        let args = command.substring(mainCommandSubstr > -1 ? mainCommandSubstr : command.length, command.length).trim().match(/[^\s"]+|"([^"]*)"/g);

        if (args === null || (args.length === 1 && args[0] === ""))
            args = [];

        for (let i = 0; i < args.length; i++) {
            const el = args[i];
            if (el.charAt(0) === "\"" && el.charAt(el.length - 1) === "\"")
                args[i] = el.substring(1, el.length - 1);
        }

        return {
            command: mainCommand,
            args: args
        };
    }

    /**
     * Returns either if a command exists or not
     * @param {String} command
     * @return {boolean}
     * @private
     */
    _commandExists(command) {
        return Object.prototype.hasOwnProperty.call(this.commands, command);
    }

    /**
     * Triggered when the main (Yuno's) config is loaded.
     * @param {Yuno} Yuno The yuno's instance
     * @param {Config} config The configuration
     */
    configLoaded(Yuno, config) {
        const insufficientPermissionsMessage_ = config.get("chat.insufficient-permissions");
        const masterusers_ = config.get("commands.master-users");

        // Use ternary for type-guarded assignment
        insufficientPermissionsMessage = typeof insufficientPermissionsMessage_ === "string"
            ? insufficientPermissionsMessage_
            : insufficientPermissionsMessage;

        // Normalize to array and assign if valid
        const normalizedUsers = typeof masterusers_ === "string" ? [masterusers_] : masterusers_;
        masterusers = Array.isArray(normalizedUsers) ? normalizedUsers : masterusers;
    }

    /**
     * Returns whether a user is a master user or not, from his id.
     * @param {String} userId The user's id
     * @return {boolean}
     */
    _isUserMaster(userId) {
        return masterusers.includes(userId);
    }

    /**
     * Converts v12 SCREAMING_SNAKE_CASE permission names to v14 PascalCase
     * @param {String} permission The permission name to convert
     * @private
     * @return {String}
     */
    _convertPermissionName(permission) {
        // If already in PascalCase format, return as-is
        if (permission === permission.toLowerCase() || !permission.includes('_')) {
            return permission;
        }

        // Convert SCREAMING_SNAKE_CASE to PascalCase
        return permission.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('');
    }

    /**
     * Returns whether the guild member has all given permissions
     * @param {GuildMember} member The guild member to check permissions.
     * @param {array|String} permissions The permissions to check.
     * @private
     * @return {boolean}
     */
    _hasPermissions(member, permissions) {
        if (typeof permissions !== "string" && !Array.isArray(permissions))
            return true;

        if (permissions.length === 0)
            return true;

        if (typeof permissions === "string")
            permissions = [permissions];

        for (const perm of permissions) {
            // Convert v12 permission name to v14 format (SCREAMING_SNAKE_CASE to PascalCase)
            const permissionName = this._convertPermissionName(perm);
            const permissionFlag = PermissionsBitField.Flags[permissionName];

            if (!permissionFlag || !member.permissions.has(permissionFlag))
                return false;
        }

        return true;
    }

    /**
     * Returns whether the command is DM possible or not
     * @param {String} command Command
     * @return {Boolean}
     */
    isDMCommand(command) {
        const { commands } = this;
        const parsedCommand = this._parse(command);
        command = parsedCommand.command;

        if (!this._commandExists(command))
            return false;

        const { isDMPossible, discord } = commands[command].about;

        return isDMPossible === true && discord === true;
    }

    /**
     * Executes a command that works for DMs
     * @param {Yuno} Yuno The yuno's instance
     * @param {User} author The message author
     * @param {String} command
     * @param {Message} msg
     */
    async executeDM(Yuno, author, command, msg) {
        const { commands } = this;
        const parsedCommand = this._parse(command);
        const commandObject = commands[command];
        const { about } = commandObject;

        if (!(about.isDMPossible === true && about.discord === true))
            return;

        if (about.onlyMasterUsers === true && !this._isUserMaster(author.id))
            return;

        await commandObject.run(Yuno, author, parsedCommand.args, msg);
    }

    /**
     * Execute a command from its string (when called)
     * @param {Yuno} Yuno The yuno's instance
     * @param {null|GuildMember} source The triggerer of the command
     * @param {String} commandStr The string that was inputed.
     * @param {GuildMessage} message The message where the command is launched.
     * @returns {any} Null if no permission; else, the command result
     */
    async execute(Yuno, source, commandStr, message) {
        const { commands } = this;

        if (commandStr === "" && source === null)
            return prompt.info("Please at least, write something.");

        const parsedCommand = this._parse(commandStr);
        const command = parsedCommand.command;

        if (!this._commandExists(command)) {
            return source === null
                ? prompt.error(`Command ${command} doesn't exist!`)
                : undefined;
        }

        const commandObject = commands[command];
        const { about } = commandObject;

        if (about.terminal === false && source === null)
            return prompt.error(`The command ${command} isn't accessible through terminal. Please use Discord's chat.`);

        if (source instanceof GuildMember || source === null) {
            if (about.discord === false && source instanceof GuildMember)
                return;

            // Rate-limit Discord invocations (terminal is exempt).
            if (source instanceof GuildMember) {
                const isMaster = this._isUserMaster(source.id);
                _maybeCleanRateLimitMap();
                if (_checkRateLimit(source.id, isMaster)) {
                    return; // silently drop; logging would itself be spammable
                }
            }

            if (about.onlyMasterUsers === true && source !== null && !this._isUserMaster(source.id))
                return;

            const hasPermission = source === null ||
                (source instanceof GuildMember && (this._isUserMaster(source.id) || this._hasPermissions(source, about.requiredPermissions)));

            if (hasPermission) {
                // Structured audit trail for any privileged or dangerous command.
                if (source instanceof GuildMember && (about.onlyMasterUsers === true || about.dangerous === true)) {
                    prompt.warning(
                        `[AUDIT] cmd="${command}" user=${source.user?.tag}(${source.id})` +
                        ` guild=${source.guild?.id} ts=${new Date().toISOString()}`
                    );
                }

                let _error;

                try {
                    source === null && commandObject.runTerminal
                        ? await commandObject.runTerminal(Yuno, parsedCommand.args)
                        : await commandObject.run(Yuno, source ?? 0, parsedCommand.args, message);
                } catch (e) {
                    _error = e;
                }

                if (Error.isError(_error))
                    throw _error; // let yuno handle the error.
            } else {
                // command execution failed due to insufficient permissions
                return about.dangerous === true
                    ? message.member.ban({
                        deleteMessageSeconds: 86400,
                        reason: "User tried to execute a command for which they are underprivileged."
                    })
                    : message.channel.send(
                        insufficientPermissionsMessage.replace("${author}", `<@!${source.id}>`)
                    );
            }
        } else {
            await commandObject.run(Yuno, source === null);
        }
    }
}

module.exports = CommandManager;

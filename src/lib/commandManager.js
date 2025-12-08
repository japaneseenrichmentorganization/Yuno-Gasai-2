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

const Util = require("util"),
    EventEmitter = require("events"),
    fs = require("fs"),
    path = require("path"),
    { GuildMember, PermissionsBitField } = require("discord.js");

let insufficientPermissionsMessage = "Insufficient permissions.",
    masterusers = [];

/**
 * A command manager.
 * Parses commands, triggers them, returns error messages, etc...
 * @param {String?} [directory] Path to the commands directory. Defaults to src/commands
 * @constructor
 * @prop {String} directory The directory where all commands are located
 * @prop {Object} commands All the commands. Key as command name and value as the module.
 * @extends EventEmitter
 */
let CommandManager = function(directory) {
    if (typeof directory !== "string")
        directory = path.resolve(__dirname, "../commands");

    this.directory = directory;

    this.commands = {};
}

Util.inherits(CommandManager, EventEmitter)

CommandManager.prototype.backup = function() {
    return this.directory;
}

/**
 * Inits the command manager by reading all commands in the specified directory.
 */
CommandManager.prototype.init = function() {
    return new Promise((function(resolve, reject) {
        fs.readdir(this.directory, "utf8", (async function(err, files) {
            let cmdLoaded = 0;

            if (!err)
                for(let i = 0; i < files.length; i++) {
                    await this.readCommand(files[i]);
                    cmdLoaded++;
                }
            else
                reject(err);

            prompt.info("A total of " + cmdLoaded + " command(s) has been loaded.");
            this.emit("loaded");
            resolve();
        }.bind(this)));
    }).bind(this));
}

/**
 * Clears the cache of require for a specified file and resolve the file's path.
 * @param {String} file Path to the file.
 * @private
 * @returns {String} The path to the file, resolved.
 */
CommandManager.prototype._clearCache = function(file) {
    if (file.indexOf(".js"))
        file = file.substring(0, file.lastIndexOf(".js"));

    file = this.directory + "/" + file;

    file = require.resolve(file);

    if (require.cache[file])
        delete require.cache[file];

    return file;
}

/**
 * Returns only the filename of a full path
 * @param {String} file
 * @return {String} The file name.
 */
CommandManager.prototype._onlyFileName = function(file) {
    let extension = file.lastIndexOf(".");

    extension = file.substring(extension, file.length);

    return path.basename(file, extension)
}

/**
 * Reads a command from a file (module-like.);
 * @param {String} file Path to the file.
 * @returns {Promise}
 */
CommandManager.prototype.readCommand = function(file) {
    let _fs = fs;

    file = this._clearCache(file);


    return new Promise((function(resolve, reject) {
        let commandModule;
        try {
            commandModule = require(file);
        } catch(e) {
            reject(e);
        }

        if (!commandModule.about || !commandModule.about.command || typeof commandModule.about.command !== "string") {
            if (typeof commandModule.about === "object")
                commandModule.about.command = this._onlyFileName(file);
            else
                commandModule.about = {
                    "command": this._onlyFileName(file)
                }
        }

        // check for duplicates
        if (this._commandExists(commandModule.about.command))
            reject(new Error("Tried to push a command called " + commandModule.about.command + " but it already exists."));

        this.commands[commandModule.about.command] = commandModule;

        let aliases = commandModule.about.aliases;

        if (typeof aliases === "string")
            aliases = [aliases];
        if (aliases instanceof Array) {
            for(let i = 0; i < aliases.length; i++)
                this.commands[aliases[i]] = commandModule;
        }

        prompt.info("Command " + commandModule.about.command + " has been loaded.");

        resolve();
    }).bind(this));
}

/**
 * Parse the command, returning an object containing the command and the args.
 * @param {String} command
 * @returns {Object}
 */
CommandManager.prototype._parse = function(command) {
    let mainCommandSubstr = command.indexOf(" "),
        mainCommand = command.substring(0, mainCommandSubstr > -1 ? mainCommandSubstr : command.length).toLowerCase(),
        args = command.substring(mainCommandSubstr > -1 ? mainCommandSubstr : command.length, command.length).trim().match(/[^\s"]+|"([^"]*)"/g);

    if (args === null ||args.length === 1 && args[0] === "")
        args = [];

    for(let i = 0; i < args.length; i++) {
        let el = args[i];

        if (el.charAt(0) === "\"" && el.charAt(el.length - 1) === "\"")
            args[i] = el.substring(1, el.length -1)
    }
    
    return {
        "command": mainCommand,
        "args": args
    }
}

/**
 * Returns either if a command exists or note
 * @param {String} command
 * @return {boolean}
 * @private
 */
CommandManager.prototype._commandExists = function(command) {
    return Object.prototype.hasOwnProperty.call(this.commands, command);
}

/**
 * Triggered when the main (Yuno's) config is loaded.
 * @param {Yuno} Yuno The yuno's instance
 * @param {Config} config The configuration
 */
CommandManager.prototype.configLoaded = function(Yuno, config) {
    let insufficientPermissionsMessage_ = config.get("chat.insufficient-permissions"),
        masterusers_ = config.get("commands.master-users");

    if (typeof insufficientPermissionsMessage_ === "string")
        insufficientPermissionsMessage = insufficientPermissionsMessage_;

    if (typeof masterusers_ === "string")
        masterusers_ = [masterusers_];

    if (masterusers_ instanceof Array)
        masterusers = masterusers_;
}

/**
 * Returns whether a user is a master user or not, from his id.
 * @param {String} userId The user's id
 */
CommandManager.prototype._isUserMaster = function(userId) {
    return masterusers.includes(userId);
}

/**
 * Converts v12 SCREAMING_SNAKE_CASE permission names to v14 PascalCase
 * @param {String} permission The permission name to convert
 * @private
 * @return {String}
 */
CommandManager.prototype._convertPermissionName = function(permission) {
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
CommandManager.prototype._hasPermissions = function(member, permissions) {
    if (typeof permissions !== "string" && !(permissions instanceof Array))
        return true;

    if (permissions.length === 0)
        return true;

    if (typeof permissions === "string")
        permissions = [permissions];

    for(let i = 0; i < permissions.length; i++) {
        // Convert v12 permission name to v14 format (SCREAMING_SNAKE_CASE to PascalCase)
        const permissionName = this._convertPermissionName(permissions[i]);
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
CommandManager.prototype.isDMCommand = function(command) {
    let parsedCommand = this._parse(command);

    command = parsedCommand.command;

    if (!this._commandExists(command))
        return false;

    let commandObject = this.commands[command].about;

    if (commandObject.isDMPossible === true)
        if (commandObject.discord === true)
            return true;

    return false;
}

/**
 * Executes a command that works for DMs
 * @param {Yuno} Yuno The yuno's instance
 * @param {User} author The message author
 * @param {String} command 
 * @param {Message} msg 
 */
CommandManager.prototype.executeDM = async function(Yuno, author, command, msg) {
    let parsedCommand = this._parse(command),
        commandObject = this.commands[command];

    if (!(commandObject.about.isDMPossible === true && commandObject.about.discord === true))
        return;

    if (commandObject.about.onlyMasterUsers === true && !this._isUserMaster(author.id))
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
CommandManager.prototype.execute = async function(Yuno, source, commandStr, message) {
    if (commandStr === "" && source === null)
        return prompt.info("Please at least, write something.");

    let parsedCommand = this._parse(commandStr),
        command = parsedCommand.command;

    if (!this._commandExists(parsedCommand.command))
        if (source === null)
            return prompt.error("Command " + parsedCommand.command + " doesn't exists!");
        else
            return;

    let commandObject = this.commands[command];

    if (typeof commandObject.about.terminal === "boolean" && commandObject.about.terminal === false && source === null)
        return prompt.error("The command " + command + " isn't accessible through terminal. Please use Discord's chat.");

    if (source instanceof GuildMember || source === null) {
        if (commandObject.about.discord === false && source instanceof GuildMember)
            return;

        if (commandObject.about.onlyMasterUsers === true && source !== null)
            if (!this._isUserMaster(source.id))
                return;

        if (source === null || (source instanceof GuildMember && (this._isUserMaster(source.id) || this._hasPermissions(source, commandObject.about.requiredPermissions)))) {
            let _error;
            
            //await message.channel.startTyping();
            try { 
                if (source === null && commandObject.runTerminal) {
                    await commandObject.runTerminal(Yuno, parsedCommand.args);
                } else {
                    await commandObject.run(Yuno, source === null ? 0 : source, parsedCommand.args, message);
                }
            } catch(e) {
                _error = e;
            }
            //await message.channel.stopTyping();
            if (_error instanceof Error)
                throw _error; // let yuno handle the error.
        } else {			
			//command execution failed due to insufficient permissions

			if(commandObject.about.dangerous == true){
				//otherwise, tell them they have insufficient permission.
				return message.member.ban({
					"deleteMessageSeconds": 86400,
					"reason": "User tried to execute a command for which they are underprivileged."
				});
			}else{				
				//otherwise, tell them they have insufficient permission.
				return message.channel.send(
					insufficientPermissionsMessage.replace("${author}", "<@!" + source.id + ">")
				)
			}
		}
    } else {
        await commandObject.run(Yuno, source === null)
    }

}

module.exports = CommandManager;

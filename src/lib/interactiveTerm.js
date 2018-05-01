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
    Util = require("util"),
    readline = require("readline"),
    prompt = (require("./prompt")).init();

let instance = null,
    stdin = process.stdin;

/**
 * The interactive terminal.
 * @constructor
 * @description Gives interactivity to the terminal
 * @deprecated Singleton: Use InteractiveTerminal.init() to create an instance of InteractiveTerminal
 * @param {Function} handler The function that will handle inputs.
 * @prop {boolean} listening Is the interactive terminal listening to new inputs.
 * @prop {String} _input The actual input.
 * @extends EventEmitter
 */
let InteractiveTerminal = function(handler) {
    this.listening = false;
    this.handler = handler;

    this._input = "";
    this._line = true;
}

Util.inherits(InteractiveTerminal, EventEmitter);

/**
 * Inits the singleton
 * @param {Function} handler The function that will handle inputs.
 * @return {InteractiveTerminal} The instance.
 */
InteractiveTerminal.init = function(handler) {
    if (instance === null)
        instance = new InteractiveTerminal(handler);
    return instance;
}

/**
 * Starts listening for commands
 * @return {InteractiveTerminal}
 */
InteractiveTerminal.prototype.listen = function() {
    if (this.listening)
        return;

    if (this.debuggerInteractivity) {
        return;
    }

    stdin.setRawMode(true);
    stdin.setEncoding("utf8");

    this.listening = true;
    stdin.resume();

    this._commandinp();
}

InteractiveTerminal.prototype._commandinp = function() {
    stdin.once("data", (function(key) {
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0)

        switch(key) {
            case "\r":
                // enter
                process.stdout.write("> " + this._input);
                process.stdout.write("\n");
                this._command().then((function() {
                    this._commandinp();
                }).bind(this));
                this._input = "";
                return;
                break;

            case "\u0003":
                // ctrl+c
                this.emit("quit");
                break;

            case "\b":
                // backspace
                this._input = this._input.substring(0, this._input.length - 1);
                break;

            default:
                this._input += key;
                break;
        }

        this._commandinp();
    }).bind(this));
    process.stdout.write("> " + this._input);
}

InteractiveTerminal.prototype._command = function() {
    let command = this._input;

    return new Promise((async function(res, rej) {
        await this.handler(command);
        res();
    }).bind(this));
}

/**
 * Defines the handler of the commands.
 * @param {function} handler {@link InteractiveTerminal}
 * @return {InteractiveTerminal} Returns itself.
 */
InteractiveTerminal.prototype.setHandler = function(handler) {
    this.handler = handler;
    return this;
}

/**
 * Stops listening for commands
 */
InteractiveTerminal.prototype.stop = function() {
    this.listening = false;
    stdin.pause();
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0)
}

module.exports = InteractiveTerminal;

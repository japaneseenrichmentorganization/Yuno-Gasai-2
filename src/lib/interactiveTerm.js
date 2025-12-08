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
    readline = require("readline"),
    prompt = (require("./prompt")).init();

let instance = null,
    stdin = process.stdin;

/**
 * The interactive terminal.
 * @description Gives interactivity to the terminal
 * @deprecated Singleton: Use InteractiveTerminal.init() to create an instance of InteractiveTerminal
 * @param {Function} handler The function that will handle inputs.
 * @prop {boolean} listening Is the interactive terminal listening to new inputs.
 * @prop {String} _input The actual input.
 * @extends EventEmitter
 */
class InteractiveTerminal extends EventEmitter {
    constructor(handler) {
        super();
        this.listening = false;
        this.handler = handler;

        this._input = "";
        this._line = true;
    }

    /**
     * Inits the singleton
     * @param {Function} handler The function that will handle inputs.
     * @return {InteractiveTerminal} The instance.
     */
    static init(handler) {
        if (instance === null)
            instance = new InteractiveTerminal(handler);
        return instance;
    }

    /**
     * Starts listening for commands
     * @return {InteractiveTerminal}
     */
    listen() {
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

    _commandinp() {
        stdin.once("data", (key) => {
            readline.cursorTo(process.stdout, 0);
            readline.clearLine(process.stdout, 0)

            switch(key) {
                case "\r":
                case "\n":
                    // enter
                    process.stdout.write("> " + this._input);
                    process.stdout.write("\n");
                    this._command().then(() => {
                        this._commandinp();
                    });
                    this._input = "";
                    return;
                    break;

                case "\u0003":
                    // ctrl+c
                    this.emit("quit");
                    break;

                case "\u007f":
                case "\u0008":
                case "\b":
                    // backspace (handles DEL, BS, and \b)
                    this._input = this._input.substring(0, this._input.length - 1);
                    break;

                default:
                    // Only add printable characters
                    if (key.charCodeAt(0) >= 32 || key === "\t") {
                        this._input += key;
                    }
                    break;
            }

            this._commandinp();
        });
        process.stdout.write("> " + this._input);
    }

    _command() {
        let command = this._input;

        return new Promise(async (res, rej) => {
            await this.handler(command);
            res();
        });
    }

    /**
     * Defines the handler of the commands.
     * @param {function} handler {@link InteractiveTerminal}
     * @return {InteractiveTerminal} Returns itself.
     */
    setHandler(handler) {
        this.handler = handler;
        return this;
    }

    /**
     * Stops listening for commands
     */
    stop() {
        this.listening = false;
        stdin.pause();
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0)
    }
}

module.exports = InteractiveTerminal;

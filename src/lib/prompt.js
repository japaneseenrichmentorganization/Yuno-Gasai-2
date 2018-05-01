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
    readline = require("readline"),

    GROUPWIDTH = 10;

let instance = null,
    DEFAULT_COLORS;

/**
 * The Prompt singleton.
 * @param {Object} [settings]
 * @deprecated Use Prompt.init() to create an instance of Prompt. Do not use new Prompt().
 * @prop {array} hiddenGroups All groups that are hidden.
 * @prop {Object} _DEFAULTGROUPCOLORS Default group colors.
 * @prop {Object} groupColors The colors for the group.
 * @prop {boolean} showTime Show time in logs.
 * @prop {boolean} colors Defines if colors have to be logged.
 * @constructor
 */
let Prompt = function(settings) {
    this.hiddenGroups =
        typeof settings === "object" && settings.hasOwnProperty("hiddenGroups") && typeof settings.hiddenGroups === "array" ?
            settings.hiddenGroups : [];

    this._DEFAULTGROUPCOLORS = {
        "INFO": "FGBLUE",
        "SUCCESS": "FGGREEN",
        "ERROR": "FGRED",
        "DEBUG": "FGCYAN",
        "WARNING": "FGYELLOW"
    }

    this.groupColors = typeof settings === "object" && settings.hasOwnProperty("groupColors") && typeof settings.groupColors === "object" ?
        settings.groupColors : {};

    this.showTime = typeof settings === "object" && settings.hasOwnProperty("showTime") && typeof settings.showTime === "boolean" ?
        settings.showTime : true;

    this.colors = true;
}

/**
 * Saves the settings, to export them to a new instance (e.g. hot-reload)
 * The new Prompt instance can be reconstructed with `Prompt.init(oldInstance.backup());`
 * @return {Object}
 */
Prompt.prototype.backup = function() {
    return {
        "hiddenGroups": this.hiddenGroups,
        "groupColors": this.groupColors,
        "showTime": this.showTime
    }
}

/**
 * All colors usable in the console/terminal.
 * @description This is the object containing all colors usable in any terminal. It contains characters. After any characters of theses, the chars after the color char will take the color mentionned.
 * @prop {String} RESET Resets the color.
 * @prop {String} BRIGHT ?
 * @prop {String} DIM ?
 * @prop {String} UNDERSCORE Underlines. (may not work on all OS)
 * @prop {String} BLINK Blinks (may not work on all OS)
 * @prop {String} REVERSE Reversing color.
 * @prop {String} HIDDEN ?
 * @prop {String} FGBLACK Sets the foreground black.
 * @prop {String} FGRED Sets the foreground red.
 * @prop {String} FGGREEN  Sets the foreground green.
 * @prop {String} FGYELLOW  Sets the foreground yellow.
 * @prop {String} FGBLUE  Sets the foreground blue.
 * @prop {String} FGMAGENTA  Sets the foreground magenta.
 * @prop {String} FGCYAN  Sets the foreground cyan.
 * @prop {String} FGWHITE  Sets the foreground white.
 * @prop {String} BGBLACK Sets the background black.
 * @prop {String} BGRED Sets the background red.
 * @prop {String} BGGREEN  Sets the background green.
 * @prop {String} BGYELLOW  Sets the background yellow.
 * @prop {String} BGBLUE  Sets the background blue.
 * @prop {String} BGMAGENTA  Sets the background magenta.
 * @prop {String} BGCYAN  Sets the background cyan.
 * @prop {String} BGWHITE  Sets the background white.
 */
Prompt.COLORS = DEFAULT_COLORS = require("./prompt.COLORS.js");

/**
 * Inits the singleton
 * @param {Object} [settings]
 * @return {Prompt} The instance.
 */
Prompt.init = function(settings) {
    if (instance === null)
        instance = new Prompt(settings);
    return instance;
}

/**
 * Logs something
 * @param {String} [group] Optional. The group of the log.
 * @param {String} text The text to show.
 * @param {String} [groupColor] Group's color. Corresponding to a value in Prompt.COLORS (key)
 * @param {String} [textColor] Text's color. Corresponding to a value in Prompt.COLORS (key)
 */
Prompt.prototype.log = function() {
    if (!this.colors)
        Prompt.COLORS = {"RESET":"","BRIGHT":"","DIM":"","UNDERSCORE":"","BLINK":"","REVERSE":"","HIDDEN":"","FGBLACK":"","FGRED":"","FGGREEN":"","FGYELLOW":"","FGBLUE":"","FGMAGENTA":"","FGCYAN":"","FGWHITE":"","BGBLACK":"","BGRED":"","BGGREEN":"","BGYELLOW":"","BGBLUE":"","BGMAGENTA":"","BGCYAN":"","BGWHITE":""};
    else
        Prompt.COLORS = DEFAULT_COLORS;

    let args = Array.from(arguments);

    let group, text = "",
        groupColor = Prompt.COLORS.FGCYAN,
        textColor = Prompt.COLORS.RESET;

    if (args.length === 1)
        text = (args[0]).toString();
    else {
        group = args[0].toUpperCase();
        text = (args[1]).toString();
        groupColor = args.length >= 3 && typeof args[2] === "string" ? args[2] : groupColor;
        textColor = args.length >= 4 && typeof args[3] === "string" ? args[3] : textColor;
    }

    if (this.isGroupHidden(group))
        return;

    if (typeof group === "string")
        group = this._centerGroup(group);
    else
        group = null;

    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0)

    console.log(
        (this.showTime ? Prompt.COLORS.RESET + "[" + this._getTime() + "] " : "") +
        (typeof group === "string" ? "[" + groupColor + group + Prompt.COLORS.RESET + "]" : "" + Prompt.COLORS.RESET) + " " +
        textColor + text + Prompt.COLORS.RESET
    )
}

/**
 * Logs a success.
 * Use only this method to log successes.
 * @param {String} text
 * @param {String} [textColor]
 */
Prompt.prototype.success = function(text, textColor) {
    return this.log("success", text, this._getDefaultGroupColor("success"), textColor);
}

/**
 * Logs a warning.
 * @param {String} text
 * @param {String} [textColor]
 */
Prompt.prototype.warning = function(text, textColor) {
    return this.log("warning", text, this._getDefaultGroupColor("warning"), textColor);
}

/**
 * Logs a warning.
 * @param {String} text
 * @param {String} [textColor]
 * @alias {@link prompt.warning}
 */
Prompt.prototype.warn = function() {
    this.warning.apply(this, Array.from(arguments));
}

/**
 * Logs an error.
 * @param {String?} text
 * @param {(Error|String)?} error
 * @param {String} [textColor]
 */
Prompt.prototype.error = function(text, error, textColor) {
    if (error instanceof Error) {
        text += " : ";

        if (error.code)
            text += error.code + "-";
        if (error.stack)
            text += error.stack
        if (error.message)
            text += "\n" + error.message;
    } else if (typeof error !== "undefined")
        text += " : " + error

    if (typeof textColor !== "string")
        textColor = this._getDefaultGroupColor("error");

    return this.log("error", text, this._getDefaultGroupColor("error"), textColor);
}

/**
 * Logs an info
 * @param {String} text
 */
Prompt.prototype.info = function(text) {
    return this.log("info", text, this._getDefaultGroupColor("info"));
}

/**
 * Logs debugging messages.
 * @param {any} anything
 */
Prompt.prototype.debug = function(anything) {
    return this.log("debug", anything, this._getDefaultGroupColor("debug"))
}

/**
 * Hides a group.
 * @param {String} group
 */
Prompt.prototype.hideGroup = function(group) {
    group = group.toUpperCase();

    if (!this.hiddenGroups.includes(group))
        this.hiddenGroups.push(group);
}

/**
 * Removes a group from hidden groups.
 * @param {String} group
 */
Prompt.prototype.showGroup = function(group) {
    group = group.toUpperCase();

    let ind = this.hiddenGroups.indexOf(group);

    if (ind > -1)
        this.hiddenGroups.splice(ind, 1);
}

/**
 * Returns wether a group is hidden or not.
 * @param {String} group
 * @returns {boolean}
 */
Prompt.prototype.isGroupHidden = function(group) {
    return this.hiddenGroups.includes(group.toUpperCase());
}

/**
 * Returns the default color for a group
 * @param {String} group
 * @private
 * @returns {String} The color.
 */
Prompt.prototype._getDefaultGroupColor = function(group) {
    group = group.toUpperCase();

    if (this.groupColors.hasOwnProperty(group))
        return this.groupColors[group];

    return Prompt.COLORS[this._DEFAULTGROUPCOLORS[group]] || Prompt.COLORS.RESET;
}

/**
 * Sets the color of a group.
 * @param {String} group
 * @param {String} color The key of a color.
 */
Prompt.prototype.setGroupColor = function(group, color) {
    this.groupColors[group.toUpperCase()] = Prompt.COLORS[color.toUpperCase()];
}

/**
 * Centers a group (as a string)
 * @private
 * @param {String} group
 */
Prompt.prototype._centerGroup = function(group) {
    let grplen = group.length,
        side = (GROUPWIDTH - grplen) / 2;

    let sidestr = " ".repeat(side);

    return (side % 1 != 0 ? sidestr : " ".repeat(side - 1)) + group + sidestr;
}

/**
 * Returns time in a nice formated way!
 * @private
 * @return {String}
 */
Prompt.prototype._getTime = function() {
    let now = new Date(Date.now());

    return ("00" + now.getHours()).slice(-2) + ":" + ("00" + now.getMinutes()).slice(-2) + ":" + ("00" + now.getSeconds()).slice(-2);
}

/**
 * Shows a nice CLI help.
 * @param {array[]} args The arguments.
 */
Prompt.prototype.showHelp = function(args) {
    console.log(`
        ${Prompt.COLORS.FGGREEN}Yuno Gasai 2${Prompt.COLORS.RESET} - ${Prompt.COLORS.FGCYAN}Help${Prompt.COLORS.RESET}
    `);

    args.forEach(element => {
        console.log("      " + element.argument + " - " + element.description)
        if (element.aliases)
            element.aliases.forEach(alias => {
                console.log("        aka " + alias)
            });
        console.log("");
    });
}

/**
 * Write text without jumping a line (writing over the last line)
 * @param {String} text
 */
Prompt.prototype.writeWithoutJumpingLine = function(text) {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0)
    process.stdout.write(text);
}

/**
 * Loads configuration into Prompt.
 * @param {Yuno} Yuno The instance of Yuno.
 * @param {Config} config The Yuno's config.
 */
Promise.prototype.configLoaded = function(Yuno, config) {
    let data = {
        "hiddenGroups": config.get("logging.hidden-groups"),
        "showTime": Yuno.config.get("logging.show-time"),
        "groupColors": Yuno.config.get("logging.group-colors")
    }

    this.hiddenGroups =  typeof data === "object" && data.hasOwnProperty("hiddenGroups") && typeof data.hiddenGroups === "array" ?
        data.hiddenGroups : [];

    this.groupColors = typeof data === "object" && data.hasOwnProperty("groupColors") && typeof data.groupColors === "object" ?
        data.groupColors : {};

    this.showTime = typeof data === "object" && data.hasOwnProperty("showTime") && typeof data.showTime === "boolean" ?
        data.showTime : true;
}

/**
 * Event handler for shutdown.
 * @param {Yuno} Yuno The instance.
 */
Prompt.prototype.beforeShutdown = function(Yuno) {
    Yuno.config.set("logging.hidden-groups", JSON.stringify(this.hiddenGroups));
    Yuno.config.set("logging.show-time", this.showTime);
    Yuno.config.set("logging.group-colors", JSON.stringify(this.groupColors));
}

module.exports = Prompt;

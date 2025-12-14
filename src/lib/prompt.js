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

const readline = require("readline"),

    GROUPWIDTH = 10;

let instance = null,
    DEFAULT_COLORS,
    // Pre-cached empty colors object - avoids recreating on every log() call when colors disabled
    EMPTY_COLORS = {"RESET":"","BRIGHT":"","DIM":"","UNDERSCORE":"","BLINK":"","REVERSE":"","HIDDEN":"","FGBLACK":"","FGRED":"","FGGREEN":"","FGYELLOW":"","FGBLUE":"","FGMAGENTA":"","FGCYAN":"","FGWHITE":"","BGBLACK":"","BGRED":"","BGGREEN":"","BGYELLOW":"","BGBLUE":"","BGMAGENTA":"","BGCYAN":"","BGWHITE":""};

/**
 * The Prompt singleton.
 * @param {Object} [settings]
 * @deprecated Use Prompt.init() to create an instance of Prompt. Do not use new Prompt().
 * @prop {Set} hiddenGroups All groups that are hidden (stored uppercase for O(1) lookup).
 * @prop {Object} _DEFAULTGROUPCOLORS Default group colors.
 * @prop {Object} groupColors The colors for the group.
 * @prop {boolean} showTime Show time in logs.
 * @prop {boolean} colors Defines if colors have to be logged.
 */
class Prompt {
    constructor(settings) {
        // Use Set for O(1) lookup instead of Array O(n), store pre-uppercased
        const settingsGroups = typeof settings === "object" && settings.hasOwnProperty("hiddenGroups") && Array.isArray(settings.hiddenGroups)
            ? settings.hiddenGroups
            : [];
        this.hiddenGroups = new Set(settingsGroups.map(g => g.toUpperCase()));

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
     * Inits the singleton
     * @param {Object} [settings]
     * @return {Prompt} The instance.
     */
    static init(settings) {
        if (instance === null)
            instance = new Prompt(settings);
        return instance;
    }

    /**
     * Saves the settings, to export them to a new instance (e.g. hot-reload)
     * The new Prompt instance can be reconstructed with `Prompt.init(oldInstance.backup());`
     * @return {Object}
     */
    backup() {
        return {
            "hiddenGroups": Array.from(this.hiddenGroups), // Convert Set back to Array for serialization
            "groupColors": this.groupColors,
            "showTime": this.showTime
        }
    }

    /**
     * Logs something
     * @param {String} [group] Optional. The group of the log.
     * @param {String} text The text to show.
     * @param {String} [groupColor] Group's color. Corresponding to a value in Prompt.COLORS (key)
     * @param {String} [textColor] Text's color. Corresponding to a value in Prompt.COLORS (key)
     */
    log() {
        const args = Array.from(arguments);

        // Early return: check if group is hidden before any processing
        // For multi-arg calls, group is args[0]
        if (args.length > 1) {
            const groupUpper = args[0].toUpperCase();
            if (this.hiddenGroups.has(groupUpper)) return;
        }

        // Use pre-cached empty colors object instead of recreating every call
        Prompt.COLORS = this.colors ? DEFAULT_COLORS : EMPTY_COLORS;

        let group, text = "",
            groupColor = Prompt.COLORS.FGCYAN,
            textColor = Prompt.COLORS.RESET;

        if (args.length === 1) {
            text = String(args[0]);
        } else {
            group = args[0].toUpperCase();
            text = String(args[1]);
            groupColor = args.length >= 3 && typeof args[2] === "string" ? args[2] : groupColor;
            textColor = args.length >= 4 && typeof args[3] === "string" ? args[3] : textColor;
        }

        const centeredGroup = typeof group === "string" ? this._centerGroup(group) : null;

        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);

        const { RESET } = Prompt.COLORS;
        console.log(
            (this.showTime ? RESET + "[" + this._getTime() + "] " : "") +
            (centeredGroup !== null ? "[" + groupColor + centeredGroup + RESET + "]" : "" + RESET) + " " +
            textColor + text + RESET
        );
    }

    /**
     * Logs a success.
     * Use only this method to log successes.
     * @param {String} text
     * @param {String} [textColor]
     */
    success(text, textColor) {
        return this.log("success", text, this._getDefaultGroupColor("success"), textColor);
    }

    /**
     * Logs a warning.
     * @param {String} text
     * @param {String} [textColor]
     */
    warning(text, textColor) {
        return this.log("warning", text, this._getDefaultGroupColor("warning"), textColor);
    }

    /**
     * Logs a warning.
     * @param {String} text
     * @param {String} [textColor]
     * @alias {@link prompt.warning}
     */
    warn() {
        this.warning.apply(this, Array.from(arguments));
    }

    /**
     * Logs an error.
     * @param {String?} text
     * @param {(Error|String)?} error
     * @param {String} [textColor]
     */
    error(text, error, textColor) {
        if (Error.isError(error)) {
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
    info(text) {
        return this.log("info", text, this._getDefaultGroupColor("info"));
    }

    /**
     * Logs debugging messages.
     * @param {any} anything
     */
    debug(anything) {
        return this.log("debug", anything, this._getDefaultGroupColor("debug"))
    }

    /**
     * Hides a group.
     * @param {String} group
     */
    hideGroup(group) {
        this.hiddenGroups.add(group.toUpperCase());
    }

    /**
     * Removes a group from hidden groups.
     * @param {String} group
     */
    showGroup(group) {
        this.hiddenGroups.delete(group.toUpperCase());
    }

    /**
     * Returns wether a group is hidden or not.
     * @param {String} group
     * @returns {boolean}
     */
    isGroupHidden(group) {
        return this.hiddenGroups.has(group.toUpperCase());
    }

    /**
     * Returns the default color for a group
     * @param {String} group
     * @private
     * @returns {String} The color.
     */
    _getDefaultGroupColor(group) {
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
    setGroupColor(group, color) {
        this.groupColors[group.toUpperCase()] = Prompt.COLORS[color.toUpperCase()];
    }

    /**
     * Centers a group (as a string)
     * @private
     * @param {String} group
     */
    _centerGroup(group) {
        let grplen = group.length,
            side = (GROUPWIDTH - grplen) / 2;

        let sidestr = " ".repeat(side);

        return (side % 1 !== 0 ? sidestr : " ".repeat(side - 1)) + group + sidestr;
    }

    /**
     * Returns time in a nice formated way!
     * @private
     * @return {String}
     */
    _getTime() {
        let now = new Date(Date.now());

        return ("00" + now.getHours()).slice(-2) + ":" + ("00" + now.getMinutes()).slice(-2) + ":" + ("00" + now.getSeconds()).slice(-2);
    }

    /**
     * Shows a nice CLI help.
     * @param {array[]} args The arguments.
     */
    showHelp(args) {
        console.log(`
        ${Prompt.COLORS.FGGREEN}Yuno Gasai 2${Prompt.COLORS.RESET} - ${Prompt.COLORS.FGCYAN}Help${Prompt.COLORS.RESET}
    `);

        for (const element of args) {
            console.log("      " + element.argument + " - " + element.description)
            if (element.aliases) {
                for (const alias of element.aliases) {
                    console.log("        aka " + alias)
                }
            }
            console.log("");
        }
    }

    /**
     * Write text without jumping a line (writing over the last line)
     * @param {String} text
     */
    writeWithoutJumpingLine(text) {
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0)
        process.stdout.write(text);
    }

    /**
     * Loads configuration into Prompt.
     * @param {Yuno} Yuno The instance of Yuno.
     * @param {Config} config The Yuno's config.
     */
    configLoaded(Yuno, config) {
        const hiddenGroupsConfig = config.get("logging.hidden-groups");
        const showTimeConfig = Yuno.config.get("logging.show-time");
        const groupColorsConfig = Yuno.config.get("logging.group-colors");

        // Convert to Set with pre-uppercased values for O(1) lookup
        const groupsArray = Array.isArray(hiddenGroupsConfig) ? hiddenGroupsConfig : [];
        this.hiddenGroups = new Set(groupsArray.map(g => g.toUpperCase()));

        this.groupColors = typeof groupColorsConfig === "object" && groupColorsConfig !== null
            ? groupColorsConfig
            : {};

        this.showTime = typeof showTimeConfig === "boolean" ? showTimeConfig : true;
    }

    /**
     * Event handler for shutdown.
     * @param {Yuno} Yuno The instance.
     */
    beforeShutdown(Yuno) {
        // Convert Set to Array for JSON serialization
        Yuno.config.set("logging.hidden-groups", JSON.stringify(Array.from(this.hiddenGroups)));
        Yuno.config.set("logging.show-time", this.showTime);
        Yuno.config.set("logging.group-colors", JSON.stringify(this.groupColors));
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

module.exports = Prompt;

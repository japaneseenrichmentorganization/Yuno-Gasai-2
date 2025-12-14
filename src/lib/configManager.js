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

const fs = require("fs"),
    fsPromises = require("fs").promises;

let instance = null;

/**
 * The config manager.
 * @description Load configs
 * @deprecated Singleton: use ConfigManager.init() to create an instance
 */
class ConfigManager {
    constructor() {
        // Empty constructor for singleton pattern
    }

    /**
     * Inits the singleton
     * @return {ConfigManager} The instance.
     */
    static init() {
        if (instance === null)
            instance = new ConfigManager();
        return instance;
    }

    /**
     * Reads a file and returns a config if success synchronously
     * @param {String} file The path to the "config" file
     * @throws {Error} If the file isn't JSON.
     * @return {Config}
     */
    readConfigSync(file) {
        const fileContent = fs.readFileSync(file, "utf8");

        if (this._isJSON(fileContent)) {
            const json = JSON.parse(fileContent);
            return new Config(json, file);
        } else {
            throw new Error(`Config file ${file} doesn't exist or isn't JSON.`);
        }
    }

    /**
     * Reads a file and returns a config if success
     * @param {String} file The path to the "config" file
     * @returns {Promise<Config>} Resolves with the config
     */
    async readConfig(file) {
        const data = await fsPromises.readFile(file, "utf8");

        if (this._isJSON(data)) {
            return new Config(JSON.parse(data), file);
        } else {
            throw new Error(`Config file ${file} isn't JSON.`);
        }
    }

    /**
     * Checks if a String is valid JSON.
     * @param {String} json JSON
     * @private
     * @return {boolean}
     */
    _isJSON(json) {
        return /^[\],:{}\s]*$/.test(json.replace(/\\["\\\/bfnrtu]/g, '@').
            replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
            replace(/(?:^|:|,)(?:\s*\[)+/g, ''));
    }
}

/**
 * A config that extends Map
 * @extends {Map}
 */
class Config extends Map {
    /**
     * @param {Object} obj The config object
     * @param {String} [file] The path to the file.
     */
    constructor(obj, file) {
        // Convert object to Map entries
        super(Object.entries(obj));

        this._defaultObj = null;
        this.file = typeof file === "string" ? file : null;
    }

    /**
     * Defines the default object.
     * @param {Object} defaultObj The default object.
     * If the main config file has a property that hasn't been defined.
     * The returned value will be the one from the default object.
     * @returns {Config} Returns itself.
     */
    defaults(defaultObj) {
        this._defaultObj = defaultObj;
        return this;
    }

    /**
     * Returns a value of the config from its key.
     * @param {String} key
     * @returns {any} The value
     */
    get(key) {
        const value = this.getWithoutDefault(key);

        if (typeof value === "undefined")
            return this.getDefault(key);

        return value;
    }

    /**
     * Returns a value from the default object
     * @param {String} key
     * @returns {any|undefined} Returns undefined if the default object hasn't been defined or key doesn't exist.
     */
    getDefault(key) {
        if (!this._defaultObj) return undefined;

        const v = this._defaultObj[key];
        return v;
    }

    /**
     * Returns a value from its key without considerating the default one.
     * @param {String} key
     * @returns {any} The value.
     */
    getWithoutDefault(key) {
        return super.get(key);
    }

    /**
     * Converts the map to an object.
     * @return {Object}
     */
    object() {
        const obj = {};
        for (const [k, v] of this) { obj[k] = v; }
        return obj;
    }

    /**
     * Saves the config to a file.
     *
     * If file not defined, it'll be the source file of the config.
     * @param {String} [file]
     */
    async save(file) {
        if (typeof file !== "string")
            file = this.file;

        if (typeof file !== "string")
            return;

        await fsPromises.writeFile(file, JSON.stringify(this.object(), null, 4), "utf8");
    }
}

module.exports = ConfigManager;

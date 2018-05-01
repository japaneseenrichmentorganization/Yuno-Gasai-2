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
    Util = require("util");

let instance = null;

/**
 * The config manager.
 * @constructor
 * @description Load configs
 * @deprecated Singleton: use ConfigManager.init() to create an instance
 */
function ConfigManager() {

}

/**
 * Inits the singleton
 * @return {ConfigManager} The instance.
 */
ConfigManager.init = function() {
    if (instance === null)
        instance = new ConfigManager();

    return instance;
}

/**
 * Reads a file and returns a config if success synchronously
 * @param {String} file The path to the "config" file
 * @throws {Error} If the file isn't JSON.
 * @return {null|Config}
 */
ConfigManager.prototype.readConfigSync = function(file) {
    let fileContent = fs.readFileSync(file, "utf8");

    if (this._isJSON(fileContent)) {
        let json = JSON.parse(fileContent)
        return new Config(json, file);
    } else {
        throw new Error("Config file " + file + " doesn't exsists or isn't JSON.")
    }

    return;
}

/**
 * Reads a file and returns a config if success
 * @param {String} file The path to the "config" file
 * @returns {Promise} Resolves with the config
 * Rejects with a {@link Error} if fail.
 */
ConfigManager.prototype.readConfig = function(file) {
    return new Promise((function(resolve, reject) {
        fs.readFile(file, "utf8", (function(err, data) {
            if (err)
                return reject(err);

            if (this._isJSON(data))
                return resolve(new Config(JSON.parse(data), file));
            else
                return reject("Config file " + file + " isn't JSON.");
        }).bind(this));
    }).bind(this));
}

/**
 * Checks if a String is valid JSON.
 * @param {String} json JSON
 * @private
 * @return {boolean}
 */
ConfigManager.prototype._isJSON = function(json) {
    return /^[\],:{}\s]*$/.test(json.replace(/\\["\\\/bfnrtu]/g, '@').
    replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
    replace(/(?:^|:|,)(?:\s*\[)+/g, ''))
}

/**
 * A config
 * @constructor
 * @extends {Map}
 * @param {Object} obj
 * @param {String?} [file] The path to the file.
 */
function Config(obj, file) {
    obj = this._objToIterable(obj);
    const self = (Object.getPrototypeOf(this) === Map.prototype) ? this : new Map(obj);
    Object.setPrototypeOf(self, Config.prototype);

    self._defaultObj = null;

    self.file = null;

    if (typeof file === "string")
        self.file = file;

    return self;
}

Util.inherits(Config, Map);
Object.setPrototypeOf(Config, Map);

/**
 * Transforms an Object to an Iterable for Map()
 * @param {Object} obj The object to transform to iterable
 * @private
 * @return {Map} Iterable.
 */
Config.prototype._objToIterable = function(obj) {
    let m = new Map();

    Object.keys(obj).forEach(key => {
        m.set(key, obj[key])
    })

    return m;
}

/**
 * Defines the default object.
 * @param {Object} defaultObj The default object.
 * If the main config file has a property that hasn't been defined.
 * The returned value will be the one from the default object.
 * @returns {Config} Returns itself.
 */
Config.prototype.defaults = function(defaultObj) {
    this._defaultObj = defaultObj
    return this;
}

/**
 * Returns a value of the config from its key.
 * @param {String} key
 * @returns {any} The value
 */
Config.prototype.get = function(key) {
    let value = this.getWithoutDefault(key);

    if (typeof value === "undefined")
        return this.getDefault(key);

    return value;
}

/**
 * Returns a value from the default object
 * @param {String} key
 * @returns {null} Returns null if the default object hasn't been defined.
 */
Config.prototype.getDefault = function(key) {
    let v = this._defaultObj[key];
    
    if (typeof v === "undefined")
        return;

    return v;
}

/**
 * Returns a value from its key without considerating the default one.
 * @param {String} key 
 * @returns {any} The value.
 */
Config.prototype.getWithoutDefault = function(key) {
    return Map.prototype.get.call(this, key);
}

/**
 * Convers the map to an object.
 * @return {Object}
 */
Config.prototype.object = function() {
    let obj = {};

    this.forEach((v,k) => { obj[k] = v });
    return obj;
}

/**
 * Saves the config to a file.
 * 
 * If file not defined, it'll be the source file of the config.
 * @param {String} file
 */
Config.prototype.save = function(file) {
    if (typeof file !== "string")
        file = this.file;

    if (typeof file !== "string")
        return;

    return new Promise((function(resolve, reject) {
        fs.writeFile(file, JSON.stringify(this.object(), null, 4), "utf8", resolve);
    }).bind(this));
}

module.exports = ConfigManager;
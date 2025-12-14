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
    fs = require("fs"),
    prompt = (require("./lib/prompt")).init(),
    Path = require("path");

let instance = null,
    Yuno = null;

/*
 * @event hot-reload(?file) When a file will be hot-reloaded.
 * @event hot-reload-end(?path) When a file has been hot-reloaded.
 * @event hot-reload-full When all files will be hot-reloaded.
 * @event hot-reload-full-end When all files has been hot-reloaded.
 * @event file-changed(file) When a file, corresponding to a module, has been changed.
*/

/**
 * The module exporter
 * @description Exports Modules, and makes them hot-reloadable.
 * @deprecated Use ModuleExporter.init() to create an instance of ModuleExporter. Do not use new ModuleExporter();
 * @extends EventEmitter
 * @prop {Object} modules An object with key as path, and value as the module
 * @prop {array} hotreloadReferences All references that will be updated on a hot-reload
 */
class ModuleExporter extends EventEmitter {
    constructor() {
        super();
        this.modules = {};

        this.hotreloadReferences = {};

        this._inithrReference();
    }

    /**
     * Inits the singleton
     * @return {ModuleExporter} The instance.
     */
    static init() {
        if (instance === null)
            instance = new ModuleExporter();
        return instance;
    }

    /**
     * Exports the main Yuno reference to ModuleExporter.
     * Used for debug purposes, with the auto -hot-reload
     * @param {Yuno} yuno
     */
    heresYuno(yuno) {
        Yuno = yuno;
    }

    /**
     * Pushes a new hot-reload reference.
     * @param {Object} instance An instance where a prop will be updated.
     * @param {String} prop The property of the instance, where the module instance is located.
     * @param {String} file The location of the module
     * @return {EventEmitter} "hot-reloaded"(module): Triggered when the file has been hot-reloaded. Consider constructing your classes again.
     */
    hrReference(instance, prop, file) {
        let path = require.resolve(file),
            ee = new EventEmitter();

        this.hotreloadReferences[path] = {
            "eventEmitter": ee,
            "instance": instance,
            "prop": prop
        };

        return ee;
    }

    /**
     * Trigger all hot-reload references.
     * @private
     * @param {String} path The path to the reference (the file)
     */
    _triggerhrReference(path) {
        if (typeof path !== "string") return;

        const rf = this.hotreloadReferences[path];
        if (!rf) return;

        const backup = {};
        rf.eventEmitter.emit("reloading", backup);

        const mod = this._loadModule(path);

        if (rf.instance && typeof rf.prop === "string")
            rf.instance[rf.prop] = mod;

        rf.eventEmitter.emit("done", mod, backup);
    }

    /**
     * Makes link between hot-reload events.
     * @private
     */
    _inithrReference() {
        this.on("hot-reload-end", (path) => {
            this._triggerhrReference(path);
        });
    }

    /**
     * Requires a new module and returns it
     * @param {String} file
     * @return {Object} The module.
     */
    require(file) {
        let path = require.resolve(file);

        return this.modules[path] = this._loadModule(path);
    }

    /**
     * Requires and do a hot-reload reference
     * @param {String} file
     * @param {Object} instance
     * @param {String} prop
     * @alias .require -> .hrReference
     * @returns {EventEmitter} with property .module, containing the module.
     */
    requireAndRef(file, instance, prop) {
        let path = require.resolve(file),
            ee = this.hrReference(instance, prop, file);

        ee.module = this.modules[path] = this._loadModule(path);

        return ee;
    }

    /**
     * Exports a singleton, init it, make it hot-reloadable and returns it.
     * A little way to make singleton declaring quicker & easier & more human-readable.
     * @param {Object} instance
     * @param {String} file The file without extension
     * @param {String?} [prop] The property. Defaults to filename
     * @param {String?} [subdir] The subdir to the file w/out end trainling slash. Defaults to "./src/lib".
     * @param {any?} [arg] Argument to .init of the singleton
     * @return {Object} Module.
     */
    singletonPreset(instance, file, prop, subdir, arg) {
        const dir = subdir ?? "./lib";
        const property = prop ?? file;

        return this.requireAndRef(`${dir}/${file}`, instance, property).on("reloading", function(backup) {
            if (instance[property]?.backup)
                backup = instance[property].backup();
            else
                console.log(`Error with ${property} no backup()`);
        }).on("done", function(MOD, backupdata) {
            delete instance[property];
            instance[property] = MOD.init(backupdata);
        }).module.init(arg);
    }

    /**
     * Exports a Class, construct it, make it hot-reloadable and returns it.
     * Used to make class declaring & constructing quicker, easier & more human-readable
     * @param {Object} instance
     * @param {String} file The file without extension
     * @param {String?} [prop] The property. Defaults to filename
     * @param {String?} [subdir] The subdir to the file w/out end trailing slash
     * @param {any} arg Argument used when the instance will be instancied: new Class(arg);
     */
    instancePreset(instance, file, prop, subdir, arg) {
        const dir = subdir ?? "./lib";
        const property = prop ?? file;

        return new (this.requireAndRef(`${dir}/${file}`, this, property).on("reloading", function(backup) {
            if (instance[property]?.backup)
                backup = instance[property].backup();
            else
                console.log(`Error with ${property} no backup()`);
        }).on("done", function(MOD, backupdata) {
            delete instance[property];
            instance[property] = new MOD(backupdata);
        }).module)(arg);
    }

    /**
     * Hot Reload a modules.
     * @param {?string} file The file as module that has to be reloaded. If undefined/null, it'll reload all modules.
     * @description Hot reload a specific module.
     */
    hotreload(file) {
        if (file === null) return this._hotreloadAllFiles();

        this.emit("hot-reload", file);
        const path = require.resolve(file);
        this.modules[path] = this._loadModule(path);
        this.emit("hot-reload-end", path);
    }

    /**
     * Hot reload all files. (files = required modules)
     * @private
     */
    _hotreloadAllFiles() {
        this.emit("hot-reload-full");
        for (const modulePath of Object.keys(this.modules)) {
            this.hotreload(modulePath);
        }
        this.emit("hot-reload-full-end");
    }

    /**
     * Loads a module
     * @param {string} path The path to the module
     * @private
     * @description Deletes cache, and require (again) the module
     */
    _loadModule(path) {
        delete require.cache[path];

        try {
            return require(path);
        } catch(e) {
            prompt.error(`Fatal error: Module ${path} has a syntax error:\n${e.message}`);
            process.exit(0);
        }
    }

    /**
     * Returns if the file is an exported module
     * @param {String} path
     * @private
     * @return {boolean} If the file given (as path) is a module (that has been exported).
     */
    _isAnExportedModule(path) {
        return this.modules[require.resolve(path)] !== undefined;
    }

    /**
     * Watches a directory. In case of any changes, the modules will be reloaded.
     * @param {String?} [towatch] The file/directory to watch. Defaults to dir "src"
     * @return {String} The directory/file watched.
     */
    watch(towatch) {
        const watchPath = towatch ?? "./src/";

        fs.watch(watchPath, {
            persistent: false,
            recursive: true,
        }, async (eType, file) => {
            const fullPath = Path.join(__dirname, file);
            if (this._isAnExportedModule(fullPath)) {
                this.emit("file-changed", fullPath);
                this.hotreload(fullPath);
                prompt.debug(`File ${fullPath} hot-reloaded.`);
            } else {
                prompt.debug("Reloading all the bot (we're in a debug env, np huh ?)");
                prompt.warning("In case of a production environment, it's better to disable auto hot-reload for better stability.");
                Yuno
                    ? await Yuno.hotreload()
                    : prompt.warning("Yuno's hot reload cancelled. Yuno's reference has been not defined.");
            }
        });

        return watchPath;
    }
}

module.exports = ModuleExporter;

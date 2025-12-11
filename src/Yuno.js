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

/**
 * @prop {String} DEFAULT_CONFIG_FILE The default file for config.
 * @prop {Object} DEFAULT_CONFIG The default configuration.
 */
const DEFAULT_CONFIG_FILE = "config.json",
    DEFAULT_CONFIG = require("../DEFAULT_CONFIG.json"),

    PACKAGE = require("../package.json");

const fsPromises = require("fs").promises,
    EventEmitter = require("events"),
    {Client, GatewayIntentBits} = require("discord.js");

let ModuleExporter = (require("./ModuleExporter.js")).init(),
    InteractiveTerminal = null,
    DatabaseCommands = null,
    Database = (require("./database.js")),
    CUSTOM_CONFIG_FILE = null,
    CUSTOM_TOKEN = null;

let ONETIME_EVENT = false

/**
 * Main Yuno Gasai 2 Class
 * @extends EventEmitter
 * @prop {Prompt} prompt
 * @prop {InteractiveTerminal} interactiveTerm
 * @prop {CommandManager} commandMan
 * @prop {Discord.Client} discordClient
 * @prop {Discord.Client} dC Alias for {@link discordClient}
 * @prop {Config|null} config
 * @prop {array} modules The all different modules of Yuno.
 * @prop {boolean} interactivity If the interactivity in the terminal is enabled.
 * @prop {String} version Yuno's version (extracted from package.json)
 * @prop {String} intVersion Yuno's version as an int (useful to do comparaisons.)
 * @prop {Object} hotreloadDisabledReasons An object containing the reasons of disabled hot-reload. As key an id, and as value the reason.
 * @description The main bot's class.
 */
class Yuno extends EventEmitter {
    constructor() {
        super();

        // Increase max listeners to accommodate all modules
        this.setMaxListeners(20);

        this.prompt = ModuleExporter.singletonPreset(this, "prompt")

        // Not hot-reloading this one: it's the core of interactivity => essential.
        this.interactiveTerm = (require("./lib/interactiveTerm")).init((cmd) => {
            return new Promise(async (res, rej) => {
                try { await this.commandMan.execute(this, null, cmd) } catch(e) {
                    this.prompt.error("Error happened while executing command", e);
                }
                res();
            });
        });

        this.database = new Database();

        this.dbCommands = DatabaseCommands = ModuleExporter.requireAndRef("./DatabaseCommands").on("done", (module) => {
            this.dbCommands = DatabaseCommands = module;
        }).module;

        this.commandMan = ModuleExporter.instancePreset(this, "commandManager", "commandMan", null);

        this.discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildBans,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildPresences
            ]
        });
        this.dC = this.discordClient;

        this.configMan = ModuleExporter.singletonPreset(this, "configManager", "configMan");

        this.intervalMan = ModuleExporter.singletonPreset(this, "intervalManager", "intervalMan");

        this.config = null;

        this.modules = []

        this.interactivity = true;

        this.version = PACKAGE.version;
        this.intVersion = parseInt(PACKAGE.version.replace(new RegExp("[.]", "gi"), ""));

        this.prompt.info("Yuno " + this.version + " initialised.")

        this.hotreloadDisabledReasons = {};

        this.UTIL = ModuleExporter.requireAndRef("./Util").on("done", (module) => {
            this.UTIL = module;
        }).module;

        ModuleExporter.heresYuno(this);
    }

    /**
     * Hot reloads all classes/required modules except Yuno & ModuleExporter.
     */
    async hotreload() {
        if (Object.keys(this.hotreloadDisabledReasons).length > 0) {
            let r = Object.values(this.hotreloadDisabledReasons)[0];
            this.prompt.error("Hot-reload aborted because hr is disabled, reason: " + r);
            return r;
        }

        this.prompt.info("Hot-reloading. Bot may be unresponsive while hot-reloading.");

        this.removeAllListeners();
        this.dC.removeAllListeners();
        await this._triggerShutdownEvents();
        this.modules = [];

        ModuleExporter.once("hot-reload-full-end", async () => {
            await this._init();
            await this.readConfig(DEFAULT_CONFIG_FILE);
            this._loadModulesHR();
            await this._triggerConfigEvents();
            this.prompt.success("Bot has successfully hot-reloaded!");
        });

        ModuleExporter.hotreload();

        return;
    }

    /**
     * Inits Yuno.
     * @private
     * @return {Promise}
     */
    _init() {
        return new Promise(async (resolve, reject) => {
            this.commandMan.on("loaded", () => {
                if (this.interactivity)
                    this.interactiveTerm.listen();
            });

            await this.commandMan.init();

            if (!ONETIME_EVENT) {
                ONETIME_EVENT = true;

                this.interactiveTerm.on("quit", () => {
                    this.shutdown(1);
                });

                process.on("uncaughtException", (e) => {
                    this._uncaughtException(e);
                })
                process.on("unhandledRejection", (e) => {
                    this._unhandledRejection(e);
                });
                this.dC.on("error", (e) => {
                    this.prompt.error("Discord.JS's client threw an error", e);
                });
            }
            resolve();
        });
    }

    /**
     * Shows a nice CLI help.
     */
    showCLIHelp() {
        return this.prompt.showHelp([
            {
                "argument": "--help",
                "aliases": ["-h"],
                "description": "Shows this."
            }, {
                "argument": "--token=[token]",
                "description": "Starts the bot with a new token. The bot next save the token."
            }, {
                "argument": "--hot-reload",
                "aliases": ["-hr"],
                "description": "Hot-reloads on file change."
            }, {
                "argument": "--no-interactions",
                "aliases": ["-noit"],
                "description": "Removes the interactions with the terminal."
            }, {
                "argument": "--debug-script",
                "description": "Evalutes debug-script.js when ready."
            }, {
                "argument": "--upgrade-database=v1yunodb.db;destination.db",
                "description": "Updates the Yuno's 1st version database to the Yuno's 2nd database"
            }, {
                "argument": "--quick-crash",
                "aliases": ["-qc"],
                "description": "Stops the process on any uncaught exception or unhandled rejection."
            }, {
                "argument": "--no-colors",
                "aliases": ["-nc"],
                "description": "Logs without any color."
            }
        ])
    }

    /**
     * Evals a code under with the Yuno's context.
     * @param {String} code
     * @warning Don't provide any shit to this method.
     * @async
     * @returns {any} The result of the "eval"
     * @private
     */
    _eval(code) {
        return eval(code)
    }

    /**
     * Upgrades the Yuno's first version database to this version
     * @private
     * @param {String} file
     * @param {String} destination The filename of the destination file.
     * @return {Promise}
     */
    _upgradeDb(file, destination) {
        this.prompt.warn("The terminal will have no interactivity while updating the database...");
        return DatabaseCommands.upgrade(this, this.prompt, file, destination);
    }

    /**
     * Parse arguments & launches the bot.
     * @param {array} pargv process.argv
     * @description Used to parse the process.argv arguments
     * @async
     */
    async parseArguments(pargv) {
        // duplicating
        pargv = Array.from(pargv).slice(2).concat([""]);

        if (pargv.includes("--help") || pargv.includes("-h"))
            return this.showCLIHelp();

        // Display ASCII art banner - using RGB escape for #c88c8d (dusty rose pink)
        const YUNO_PINK = "\x1b[38;2;200;140;141m";
        const YUNO_PINK_BOLD = "\x1b[1;38;2;200;140;141m";
        const RESET = "\x1b[0m";

        console.log(`
${YUNO_PINK}⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣯⢻⡘⢷⠀⠀⠀⠀⠀⠀⣿⣦⠹⡄⠀⢿⠟⣿⡆⠀⠸⡄⠀⢸⡄⠀⠀⠀⠀⠀⠀⠀⠀⣧
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡄⠀⢸⣤⣳⡘⣇⠀⠀⠀⠀⠀⢸⣟⣆⢻⣆⢸⡆⢹⣿⣄⠀⣷⠀⢰⡇⠀⠀⠀⠀⠀⠀⠀⠀⢸
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠸⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣇⠀⠈⣆⠹⣿⣸⡇⡄⠀⠀⠀⢸⢧⠀⠈⠻⣆⢿⠀⠉⢻⡆⢹⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⢸
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⠀⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣟⣦⠀⠘⣆⠘⢷⣷⠹⣆⣀⣀⣸⣿⣧⣀⣀⣈⡳⡄⢸⠀⢹⡀⡀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⢸
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⠘⡆⣿⢇⠀⠰⡄⠀⠀⠀⠐⢦⡀⣀⣠⣿⣯⣳⣀⠼⣮⠻⣿⠋⠹⡉⠉⠇⠈⢿⡈⢹⣏⠉⠛⢻⡀⠈⣷⣇⣾⡇⠀⠀⠀⠀⠀⠀⠀⠀⢸
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣧⣇⣿⢘⡆⠀⠸⡄⠀⠀⠀⠀⠁⠀⠀⢹⠀⠀⠈⢲⣼⣦⣼⣧⡤⣄⣰⣤⣀⠈⣧⠏⢻⡀⠀⢸⡇⠉⢹⣸⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠘
⠀⠀⠀⠀⢰⠀⠀⠀⠀⠀⠀⠀⠀⠘⡟⡟⡏⠉⠙⣇⠀⢿⣄⠀⠀⠀⠀⠀⢦⡸⣄⡴⣾⠿⠋⣹⣿⡟⣻⣿⠟⠷⢶⣤⡏⠀⠘⢧⠀⢸⠇⠀⠸⣿⡏⠀⠀⠀⠀⠀⠀⡄⠀⢀⣀
⠀⢣⠀⢀⡿⡀⠀⠀⢀⡀⠀⠀⠀⠀⣿⣿⣷⣶⣶⠾⢦⡈⣏⢢⡀⠀⡀⠀⠀⠙⣿⡜⠁⠀⡿⠟⠁⠀⠉⣃⣴⣶⡄⠘⣿⣦⣀⠸⣆⢸⠀⠀⣰⡟⠀⠀⠀⠀⠀⠀⣰⡇⠀⡼⣆
⠀⠸⡆⠸⡇⣧⠀⠀⣤⢣⠀⠀⠀⠀⢻⣿⣿⡏⠹⢿⣷⣝⢿⣆⠙⢦⡉⠢⢄⡀⢬⣓⣦⡀⠀⠀⠀⠸⡿⠜⣿⣿⣿⠀⣿⣾⡟⠛⣿⡟⠀⢠⡟⣀⡤⠋⢀⠀⠀⣠⣿⠇⣸⠇⠁
⠀⠀⠸⡀⡇⠸⡄⠀⡟⢮⢇⠀⠀⠀⠈⢿⣿⡇⢰⣾⣿⣿⡆⠙⢦⠀⠉⠲⢤⣉⠓⠿⠭⠍⠃⠀⠀⠀⢹⣄⠹⠿⠛⢀⡿⠘⠁⠀⣿⠃⠀⣹⣾⣟⣠⣶⠏⠀⣴⣿⣟⣴⠏⠀⠙
⠀⠀⠀⠹⣽⠀⢣⡀⡇⠈⠻⣧⠀⠀⠀⠘⢿⠀⠈⣇⢹⡿⣿⠀⠀⠀⠀⠀⠀⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠶⠤⠴⠾⣁⢀⣠⣴⣣⣶⣿⣽⡿⢻⣿⠃⣠⣾⣿⣿⠏⣿⠀⠀⠀
⠀⠀⠀⠀⠹⣇⠈⢳⢱⠀⠀⢈⡷⣄⠀⢳⣌⣳⣀⠘⠷⠴⢿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠉⠉⠀⠀⠀⠉⠉⠁⠀⠀⢀⣿⣦⣿⣣⣾⣿⡿⠋⣿⠀⣿⠀⠀⠀
⠀⠀⠀⠀⠀⠈⠓⠀⠻⡄⣠⠾⠋⠀⣹⢦⣙⣟⠛⠛⠛⠃⡼⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢈⣿⠟⠋⣻⣾⠏⠀⠀⡿⠀⣿⡤⠖⠋
⠀⠀⠀⠀⠀⠀⢠⣄⣤⠛⢁⣠⣴⣞⡁⣸⡏⢿⡁⠀⢀⡴⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⠇⢀⣶⠟⠀⠀⠀⢠⡇⢰⡏⠀⠀⢀
⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠉⢩⣾⠿⢹⢷⣸⣇⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⣾⠁⠀⠀⠀⠀⢸⠀⢸⠀⢀⡴⡟
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡴⠟⠁⠀⢸⠈⣿⣿⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣸⠇⠀⠀⠀⢰⠆⠀⠀⢸⡶⣿⣭⣟
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⢸⠀⢹⣿⡈⠳⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⡟⣠⠄⠀⠀⡼⠀⠀⠀⢸⠃⠈⠻⣿
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⠀⠀⢻⣷⡀⠘⢷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⢧⠏⠀⠀⢰⡇⠀⠀⠀⣿⠀⠀⠀⠈
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡆⠀⠈⣿⣷⡀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⡿⡼⠀⠀⠀⠾⣸⠀⠀⠀⡟⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠘⣏⠻⣄⠀⠀⠀⠀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣡⡇⠀⠀⠀⢰⡇⠀⠀⢰⡇⠀⠀⠠⠖
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⡇⠀⠀⠀⠈⣾⠎⢷⡀⠀⠀⠸⣍⠉⠉⠉⠁⠀⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⢷⣿⠇⠀⠀⠀⡞⠀⠀⠀⣾⣧⡴⠋⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠈⢷⣿⡿⣄⠀⠀⠈⠙⠿⠶⠤⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⡟⢀⣿⠀⠀⠀⢰⠃⠀⠀⢰⡿⠋⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣯⠀⠀⠀⠀⠀⠀⢿⡇⠈⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣴⡿⠟⢻⡇⢸⣿⠀⠀⢠⡏⠀⠀⢀⣾⠀⠀⠀⠀⠀⠀
⣠⡄⠀⠀⠀⠀⠀⠀⠀⠀⣴⣦⡦⠀⠀⠀⢸⠀⠀⠀⠀⠀⠀⢸⡇⠀⢹⠱⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣴⡾⠟⠋⠀⠀⣼⡇⣿⣿⠀⢀⡎⠀⠀⠀⣸⡟⠀⠀⠀⠀⠀⠀
⣿⣿⣦⣤⣤⣤⣤⣤⣠⣶⣿⣿⣄⠀⠀⠀⠈⡆⠀⠀⠀⠀⠀⠀⡇⠀⢸⠀⠹⡆⠀⠀⠀⠀⠀⠀⣀⣤⣶⣾⣿⠟⠀⠀⠀⠀⠀⣹⢁⣿⣿⢀⡾⠀⠀⠀⢠⢻⠇⠀⠀⠀⠀⣀⡤
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠁⠀⠀⠀⡇⠀⠀⠀⠀⠀⠀⣇⠀⢸⠀⠀⠘⠶⠤⠶⠶⠛⠋⠁⠀⢈⣿⡁⠀⠀⠀⠀⠀⠀⣾⣾⣿⣿⡾⠀⠀⠀⠀⠈⡏⣀⡤⠶⠊⠉⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇⠀⠀⠀⠀⠀⢳⠀⠀⠀⠀⠀⠀⣿⠀⢸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣧⠀⠀⠀⠀⠀⣼⣿⣿⣿⡿⠁⠀⠀⠀⠀⣼⠏⠁⠀⠀⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⢸⡆⠀⠀⠀⠀⠀⣿⠀⢸⠀⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠀⠀⢸⡄⠀⠀⠀⣠⡟⢹⣿⡟⠁⠀⠀⠀⣀⣸⡿⠀⠀⠀⠀⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠀⣸⠀⢸⠀⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠀⠀⠘⣷⠀⠀⢰⣿⢥⣽⠏⠀⠀⠀⠀⠀⢩⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⢹⠀⠀⠀⠀⠀⣿⠀⡸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣠⣴⣾⣯⡾⠋⠀⠀⠀⠀⠀⢠⣿⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠸⡄⠀⠀⠀⠀⣾⠀⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠞⠿⠋⠁⢸⡿⠀⠀⠀⠀⠀⠀⣰⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⠀⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⣿⠀⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⡞⠁⠀⠀⠀⢀⡞⠀⠀⠀⠀⠀⢀⣾⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠏⠀⠀⠀⠀⠀⠀⢸⡄⠀⠀⠀⢸⣠⡇⠀⠀⠀⠀⠀⠀⠀⢀⣠⡾⠋⠀⠀⠀⠀⣠⡞⠀⢀⠀⣀⢀⣴⣿⣿⣋⣤⠤⠖⠒⠚⠛⠛⠒⠦⣤⣀⠀${RESET}

${YUNO_PINK_BOLD}                    ♥ Yuno Gasai v${this.version} ♥${RESET}
${YUNO_PINK}           "I'll protect this server forever... just for you~"${RESET}
`);

        this.interactivity = !((pargv.includes("--no-interactions") || pargv.includes("-noit") || process.env.NO_INTERACTION))

        if (!this.interactivity)
            this.prompt.warning("Interactive terminal is disabled.");

        for(let i = 0; i < pargv.length; i++) {
            let el = pargv[i];

            if (el.indexOf("--token") === 0) {
                if (el.indexOf("--token=") === 0)
                    CUSTOM_TOKEN = el.split("=")[1];
                else
                    this.prompt.warning("Not any new token defined. You have to define token like --token=yourtoken")
            }

            if (el.indexOf("--custom-config") === 0) {
                if (el.indexOf("--custom-config=") === 0) {
                    CUSTOM_CONFIG_FILE = el.split("=")[1];
                } else
                    this.prompt.warning("Not any custom config path defined. You have to define path like --custom-config=yourconfig.json");
            }

            if (el.indexOf("--upgrade-database") === 0) {
                if (!this.interactivity)
                    return this.prompt.error("Cannot upgrade database without interactive terminal.");

                if (el.indexOf("--upgrade-database=") === 0) {
                    let files = el.split("=")[1].split(";"),
                        file = files[0],
                        to = files[1]

                    if (!file || file === "")
                        this.prompt.warn("No source file given to --upgrade-database. Example: --customconfig=yunov1.db;destination.db");
                    else if (!to || to === "")
                        return this.prompt.warn("No destination file for --upgrade-database. Example: --customconfig=yunov1.db;destination.db");
                    else {
                        process.on("uncaughtException", (e) => {
                            this._uncaughtException(e);
                        })
                        process.on("unhandledRejection", (e) => {
                            this._unhandledRejection(e);
                        });

                        this.interactiveTerm.setHandler(async (enter) => {
                            if (enter === "yes") {
                                this.interactiveTerm.stop();
                                this.prompt.info("Starting the upgrade of the database...");
                                await this._upgradeDb(file, to);
                            } else if (enter === "no") {
                                this.prompt.info("You cancelled the upgrade of the database. Stopping...");
                                this.shutdown(3);
                            } else {
                                this.prompt.warn("Please enter either \"yes\" or \"no\".");
                            }
                        })

                        this.interactiveTerm.on("quit", () => {
                            this.shutdown(3)
                        })

                        this.interactiveTerm.listen();

                        this.prompt.info("If your destination file " + to + " exists, it'll be erased.");
                        this.prompt.info("The database " + file + " will not be affected by the upgrade.");
                        this.prompt.info("Please confirm the upgrading of the database by entering \"yes\" or \"no\" in lowercase then press Enter.");
                    }
                } else {
                    this.prompt.warn("No value given to --upgrade-database.");
                }
                return;
            }

            if (el.indexOf("--hot-reload") === 0 || el.indexOf("-hr") === 0)
                if (el.split("=").length > 0)
                    this.prompt.debug("Hot-Reload enabled on " + ModuleExporter.watch(el.split("=")[1]))
                else
                    this.prompt.debug("Hot-Reload enabled on " + ModuleExporter.watch())

            if (el === "--debug-script") {
                this.on("ready", () => {
                    require("fs").readFile("./debug-script.js", "utf8", (err, data) => {
                        this._eval(data);
                        this.prompt.info("Debug-script loaded.");
                    });
                })
            }

            if (el === "--no-colors" || el === "-nc")
                this.prompt.colors = false;

            if (el === "--quick-crash" || el === "-qc") {
                process.on("uncaughtException", (e) => {
                    console.log("uncaughtException", e);
                    this.shutdown(-1);
                });
                process.on("unhandledRejection", (e) => {
                    console.log("unhandledRejection", e)
                    this.shutdown(-1);
                });
            }

            if (el.indexOf("--custom-config") === 0) {
                if (el.indexOf("--custom-config=") === 0) {
                    let file = el.split("=")[1]

                    if (!file || file === "")
                        this.prompt.warn("No value given to --custom-config.");
                    else {
                        this.prompt.info("Loading " + file + " as config file.");
                        await this.readConfig(file);
                    }
                } else {
                    this.prompt.warn("Please define --custom-config. Example: --custom-config=DEBUG will load ./DEBUG.json as a config file")
                }
            }
        }

        await this._init();

        this.launch();
    }

    /**
     * Loads a config file.
     * @param {String} file The config file (without the extension)
     * @return {Promise}
     */
    readConfig(file) {
        return new Promise((resolve, reject) => {
            this.config = this.configMan.readConfigSync(file).defaults(DEFAULT_CONFIG)
            resolve();
        });
    }

    /**
     * Switches steathly to an another config
     * @param {String} file The config file (without the extension)
     * @return {Promise}
     */
    switchToConfig(file) {
        return new Promise(async (resolve, reject) => {
            await this._triggerShutdownEvents()
            this.config = (async (this.configMan.readConfig(file)).defaults(DEFAULT_CONFIG));
            await this._triggerConfigEvents()
            resolve();
        });
    }

    /**
     * Handles unhandled rejections. Logs everything.
     * @param {Error} e Error
     * @private
     */
    _unhandledRejection(e) {
        this.prompt.error("Unhandled rejection", e);
        this.emit("error", e);
    }

    /**
     * Handles uncaught exceptions. Logs everything.
     * @param {Error} e Error
     * @private
     */
    _uncaughtException(e) {
        this.prompt.error("Uncaught exception", e);
        this.emit("error", e);
    }

    /**
     * Triggers the config event for the instances.
     * @private
     * @return {Promise}
     */
    async _triggerConfigEvents() {
        // Instances that need a config event.
        // Sorted by their importance (from first to last)
        const INSTANCES = [this.prompt, this.interactiveTerm, this.commandMan, this.configMan];

        for (const el of INSTANCES) {
            if (typeof el.configLoaded === "function")
                await el.configLoaded(this, this.config);
        }

        for (const el of this.modules) {
            if (typeof el.configLoaded === "function")
                await el.configLoaded(this, this.config);
        }
    }

    /**
     * Triggers the shutdown event for the some instances.
     * @private
     * @return {Promise}
     */
    async _triggerShutdownEvents() {
        // Instances that need a shutdown event.
        // Sorted by their importance (from first to last)
        const INSTANCES = [this.prompt, this.interactiveTerm, this.commandMan, this.configMan]

        for (const el of INSTANCES) {
            if (el.beforeShutdown && typeof el.beforeShutdown === "function")
                await el.beforeShutdown(this);
        }

        for (const el of this.modules) {
            if (typeof el.beforeShutdown === "function")
                await el.beforeShutdown(this, this.config);
        }
    }

    /**
     * Makes the bot shutdown.
     * @async
     * @param {number?} reason
     *  0/undefined - Unknown;
     *  1 - User asked to;
     * -1 - Exception.
     *  3 - Database upgrade cancelled.
     * @param {Error?} [e] The error.
     */
    async shutdown(reason, e) {
        let reasonStr = "Unknown.";

        switch(reason) {
            case 1:
                reasonStr = "User (via terminal: CTRL+C) asked to.";
                break;
            case 2:
                reasonStr = "Shutdown command.";
                break;
            case 3:
                reasonStr = "Database upgrade cancelled.";
                break;
            case -1:
                reasonStr = "Fatal exception."
        }

        this.prompt.info("Shutdowning... Reason: " + reasonStr);

        this.interactiveTerm.stop();



        // Since instances aren't intialised when starting index.js with --upgrade-database, triggering shutdown events on them is useless.
        if (reason !== 3) {
            try { await this._triggerShutdownEvents(); } catch(e) { console.log("Error on trigger shutdown event", e)}
            this.prompt.info("Saving config...");

            let configSaveErr = false;
            try {await this.config.save();} catch(e) {
                configSaveErr = true;
                this.prompt.error("Error while saving config", e);
            }
            if (!configSaveErr)
                this.prompt.success("Config saved!");

            this.prompt.info("Closing database...");

            let dbClosingErr = false;
            try {
                await this.database.closePromise();
            } catch(e) {
                dbClosingErr = true;
                this.prompt.error("Error while closing database", e);
            }
            if (!dbClosingErr)
                this.prompt.success("Database closed!");
        }

        if (this.dC.token && this.dC.ping) {
            this.prompt.info("Disconnecting from Discord...");
            try {
                await this.dC.destroy()
                this.prompt.success("Successfully disconnected from Discord.");
            } catch(e) {
                this.prompt.error("Error while disconnecting from Discord")
            }
        }

        process.exit(0);
    }

    /**
     * Load all modules.
     * Do not confound the ModuleExporter (which is for "librairies") and this, that will load Yuno's module.
     * @async
     */
    async _loadModules() {
        let files = await fsPromises.readdir("./src/modules");

        for (const file of files) {
            delete require.cache[require.resolve("./modules/" + file)]
            let mod = require("./modules/" + file);
            this.modules.push(mod);
            await mod.init(this);
            this.prompt.success("Module " + mod.modulename + " successfully loaded.");
        }
    }

    /**
     * Load all modules, with hot-reload enabled.
     * Do not confound the ModuleExporter (which is for "librairies") and this, that will load Yuno's module.
     * @async
     */
    async _loadModulesHR() {
        let files = await fsPromises.readdir("./src/modules");

        for (const file of files) {
            delete require.cache[require.resolve("./modules/" + file)]
            let mod = require("./modules/" + file);
            this.modules.push(mod);
            await mod.configLoaded(this, this.config);
            await mod.init(this, true);
            this.prompt.success("Module " + mod.modulename + " successfully loaded.");
        }
    }

    /**
     * Refreshes/restart a module
     * @async
     * @return null if the module has not been found, else, what .init has returned.
     */
    async _refreshMod(modulename) {
        for(let i = 0; i < this.modules.length; i++) {
            let el = this.modules[i];
            if (el.modulename === modulename) {
                this.prompt.success("Module " + modulename + " refreshed.");
                await el.configLoaded(this, this.config);
                return await el.init(this, true);
            }
        }
        return null;
    }

    /**
     * Everything went fine! Launch the bot!
     */
    async launch() {
        if (!this.config)
            if (typeof CUSTOM_CONFIG_FILE === "string")
                this.readConfig(CUSTOM_CONFIG_FILE)
            else
                this.readConfig(DEFAULT_CONFIG_FILE);

        this.prompt.success("Config loaded.");

        this.prompt.info("Loading modules...");

        await this._loadModules();

        await this._triggerConfigEvents()



        let dbPath = this.config.get("database"),
            dbPassword = this.config.get("database.password"),
            dbPragmas = this.config.get("database.pragmas"),
            newDb;

        try { await fsPromises.stat(dbPath) } catch(e) {
            if (e.code === "ENOENT") {
                newDb = true;
                this.prompt.warn("Database " + dbPath + " as specified in the config doesn't exists. Creating a new one...");
            }
        }

        // Build database options from config
        let dbOptions = {};

        if (dbPassword) {
            dbOptions.password = dbPassword;
        }

        if (dbPragmas && typeof dbPragmas === "object") {
            dbOptions.pragmas = {
                walMode: dbPragmas.walMode === true,
                performanceMode: dbPragmas.performanceMode === true,
                memoryTemp: dbPragmas.memoryTemp === true
            };

            if (typeof dbPragmas.cacheSize === "number") {
                dbOptions.pragmas.cacheSize = dbPragmas.cacheSize;
            }

            if (typeof dbPragmas.mmapSize === "number") {
                dbOptions.pragmas.mmapSize = dbPragmas.mmapSize;
            }
        }

        try {
            await this.database.open(dbPath, dbOptions);
            await DatabaseCommands.initDB(this.database, this, newDb);
        } catch(e) {
            this.prompt.error("Cannot open database.", e);
            this.shutdown(-1);
            return;
        }

        // Log database status
        if (this.database.isEncrypted) {
            this.prompt.success("SQLite database opened with encryption enabled.");
        } else {
            this.prompt.success("SQLite database opened.");
            if (dbPassword && !this.database.isEncryptionAvailable()) {
                this.prompt.warn("Database encryption was requested but @journeyapps/sqlcipher is not installed.");
            }
        }

        if (dbPragmas && (dbPragmas.walMode || dbPragmas.performanceMode)) {
            this.prompt.info("Database optimizations applied.");
        }

        this.emit("sqlite-opened");

        this.prompt.info("Connecting to Discord...");
        try {
            if (typeof CUSTOM_TOKEN === "string")
                this.config.set("discord.token", CUSTOM_TOKEN).save();
            let token = this.config.get("discord.token");
            await this.discordClient.login(token);
        } catch(e) {
            if (e.message.indexOf("invalid token") > -1 || e.message.indexOf("Incorrect login") > -1)
                throw new Error("Error while connecting to Discord. Incorrect token.")
            throw e;
        }

        this.emit("discord-connected", this);
        this.prompt.success("Successfully connected to Discord as " + this.dC.user.tag);
        this.prompt.info("Bot launched.");
    }
}

module.exports = Yuno;

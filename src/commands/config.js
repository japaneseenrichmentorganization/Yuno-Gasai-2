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

const say = (yuno, isTerminal, msg, tosay) =>
    isTerminal ? yuno.prompt.info(tosay) : msg.channel.send(tosay);

const tryParseJSON = (str) => {
    try { return JSON.parse(str); }
    catch { return str; }
};

const tryStringifyJSON = (obj) => {
    if (typeof obj !== "object") return obj;
    try { return JSON.stringify(obj); }
    catch { return obj; }
};

// Action handlers using handler object pattern
const ACTION_HANDLERS = {
    set: (config, key, value, yuno) => {
        const parsedValue = tryParseJSON(value);
        config.set(key, parsedValue);
        return `Value with the key \`${key}\` has been set with the value: \`${parsedValue}\``;
    },
    get: (config, key, value, yuno) => {
        const result = tryStringifyJSON(config.get(key));
        return String(result).replace(new RegExp(RegExp.escape(yuno.dC.token), "gi"), "[token]");
    }
};

// Argument parsing strategies
const parseArgs = (args) => {
    const [first, second, ...rest] = args;

    // Explicit get/set
    if (first === "get") {
        if (args.length < 2) throw new Error("No key given with `config get`.");
        return { action: "get", key: second };
    }

    if (first === "set") {
        if (args.length < 3) throw new Error("Not enough arguments for `config set`.");
        return { action: "set", key: second, value: rest.join(" ") };
    }

    // Implicit: if 2+ args, assume set; otherwise get
    return args.length >= 2
        ? { action: "set", key: first, value: [second, ...rest].join(" ") }
        : { action: "get", key: first };
};

module.exports.run = async function(yuno, author, args, msg) {
    const isTerminal = author === 0;

    if (args.length === 0) {
        return say(yuno, isTerminal, msg, "Maybe some arguments ? :thinking:");
    }

    try {
        const { action, key, value } = parseArgs(args);
        const handler = ACTION_HANDLERS[action];

        if (!handler) {
            return say(yuno, isTerminal, msg, "Nothing to do.");
        }

        const result = handler(yuno.config, key, value, yuno);
        return say(yuno, isTerminal, msg, result);
    } catch (e) {
        return say(yuno, isTerminal, msg, e.message);
    }
}

module.exports.about = {
    "command": "config",
    "usage": "config < get | set > <key> [value]",
    "description": "Gets & delete config values.",
    "examples": ["config set key value", "config get key", "config key"],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": true,
    "onlyMasterUsers": true
}

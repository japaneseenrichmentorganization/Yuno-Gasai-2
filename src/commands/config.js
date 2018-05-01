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

let say = function(yuno, isTerminal, msg, tosay) {
    if (isTerminal)
        yuno.prompt.info(tosay);
    else
        msg.channel.send(tosay);
}

module.exports.run = async function(yuno, author, args, msg) {
    if (args.length === 0)
        return say(yuno, author === 0, msg, "Maybe some arguments ? :thinking:");
    
    let action = args[0],
        key = args[1],
        value;

    if (action === "get")
        if (args.length >= 2)
            key = args[1]
        else
            return say(yuno, author === 0, msg, "No key given with `config get`.");
    else if (action === "set")
        if (args.length >= 3) {
            key = args[1];
            value = args.slice(2).join(" ");
        } else
            return say(yuno, author === 0, msg, "Not enough arguments for `config set`.");
    else {
        if (args.length >= 2) {
            action = "set";
            key = args[0];
            value = (args.slice(1)).join(" ");
        } else {
            key = action;
            action = "get";
        }
    }

    let config = yuno.config;

    if (action === "set") {
        try {let temp = JSON.parse(value); value = temp;} catch(e) {}
        config.set(key, value);
        return say(yuno, author === 0, msg, "Value with the key " + "`" + key + "`" + " has been set with the value : " + "`" + value + "`")
    } else if (action === "get") {
        let r = config.get(key);
        if (typeof r === "object")
            try {r = JSON.stringify(r)} catch(e) {}

        return say(yuno, author === 0, msg, new String(r).replace(new RegExp(Yuno.dC.token, "gi"), "[token]"));
    }
    return say(yuno, author === 0, msg, "Nothing to do.");
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
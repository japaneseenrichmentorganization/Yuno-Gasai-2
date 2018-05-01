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

let timeout = null;

module.exports.runTerminal = async function(yuno, args) {
    if (args.includes("-c"))
        if (timeout === null)
            return yuno.prompt.info("No timeout has been set.");
        else {
            clearTimeout(timeout);
            timeout = null;
            delete yuno.hotreloadDisabledReasons["shutdown-t"]
            return yuno.prompt.info("Timeout cleared! Shutdown aborted.");
        }

    let force = args.includes("-f");

    if (args.includes("-t")) {
        let time = parseInt(args[args.indexOf("-t") + 1])

        if (isNaN(time))
            return yuno.prompt.warning("The time argument isn't an int as expected.");

        if (time * 1000 >= 2147483647)
            return yuno.prompt.warning("Please enter a number of second less than 2147483.");
        
        if (force && time < 10)
            return yuno.prompt.warning("Please enter a timeout higher than 10s for force.");

        if (time < 0)
            return yuno.prompt.warning("Please enter a positive value.");

        timeout = setTimeout(function() {
            if (force)
                process.exit();
            else
                yuno.shutdown(2);
        }, time * 1000)
        yuno.hotreloadDisabledReasons["shutdown-t"] = "Cannot hot-reload the bot with a shutdown timeout. Please execute shutdown -c";
        return yuno.prompt.info("The bot will shutdown in " + time + " seconds" + (force ? " in force" : "") + "." + (force ? "\nThis will maybe create a data loss." : ""));
    }

    if (force)
        return yuno.prompt.info("Cannot shutdown instantly with force (for security measures & data protection). Confirm it by using `shutdown -t 10 -f`. It's to prevent any mistyping.")
    yuno.shutdown(2);
}

module.exports.run = async function(yuno, author, args, msg) {
    if (args.includes("-c"))
        if (timeout === null)
            return msg.channel.send("No timeout has been set.");
        else {
            clearTimeout(timeout);
            timeout = null;
            delete yuno.hotreloadDisabledReasons["shutdown-t"]
            return msg.channel.send("Timeout cleared! Shutdown aborted.");
        }

    let force = args.includes("-f");

    if (args.includes("-t")) {
        let time = parseInt(args[args.indexOf("-t") + 1])

        if (isNaN(time))
            return msg.channel.send("The time argument isn't an int as expected.");

        if (time * 1000 >= 2147483647)
            return msg.channel.send("Please enter a number of second **less than 2147483**.");

        if (force && time < 10)
            return msg.channel.send("Please enter a timeout **higher than 10s for force**.");

        if (time < 0)
            return msg.channel.send("Please enter a positive value.");

        timeout = setTimeout(function() {
            if (force)
                process.exit();
            else
                yuno.shutdown(2);
        }, time * 1000)
        yuno.hotreloadDisabledReasons["shutdown-t"] = "Cannot hot-reload the bot with a shutdown timeout. Please execute shutdown -c";
        return msg.channel.send("The bot will shutdown in " + time + " seconds" + (force ? " in force" : "") + "." + (force ? "\nThis will maybe create a data loss." : ""));
    }

    if (force)
        return msg.channel.send("Cannot shutdown instantly with force (for security measures & data protection). Confirm it by using `shutdown -t 10 -f`. It's to prevent any mistyping.")
    yuno.shutdown(2);
}

module.exports.about = {
    "command": "shutdown",
    "description": "Shutdowns the bot.",
    "examples": ["shutdown", "\nshutdown -t 10 **shutdowns in 10s**", "\nshutdown -f **force, may trigger errors**", "\nshutdown -c **clears timeout**"],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": false,
    "onlyMasterUsers": true
}

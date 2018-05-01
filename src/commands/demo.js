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

module.exports.run = async function(yuno, author, args, msg) {
    if (author === 0)
        yuno.prompt.info("Modified!");
    else
        if (msg)
            msg.reply("Hey xd");
}

module.exports.about = {
    // This "command" value isn't necessary.
    "command": "demo",
    // Some description text.
    "description": "Some demo text.",
    // Exemples
    "examples": ["demo -t", "demo @[user]"],
    // Does the command will be accessible through Discord's chat. Default: true
    "discord": false,
    // Does the command will be accessible through terminal. Default: true
    "terminal": true,
    // Does the cmd shows in list/help
    "list": true,
    // Does the cmd shows in list/help even in the console. Default: true
    "listTerminal": true,
    // All permissions that are required to the user. From the terminal, this will be ignored. Default: command only accessible by terminal.
    "requiredPermissions": ["MANAGE_MESSAGES"],/*
    // If any aliases of the command. Type: array/string
    "aliases": ["demo_"],*/
    // Master user, does the command will be opened only for masters.
    "onlyMasterUsers": false
}

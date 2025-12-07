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
    const isDiscord = author !== 0;
    const send = (text) => {
        if (isDiscord) {
            msg.channel.send(text);
        } else {
            yuno.prompt.info(text);
        }
    };

    const sendError = (text) => {
        if (isDiscord) {
            msg.channel.send(":negative_squared_cross_mark: " + text);
        } else {
            yuno.prompt.error(text);
        }
    };

    const sendSuccess = (text) => {
        if (isDiscord) {
            msg.channel.send(":white_check_mark: " + text);
        } else {
            yuno.prompt.success(text);
        }
    };

    // Check if encryption is available
    if (!yuno.database.isEncryptionAvailable()) {
        return sendError("Database encryption is not available.\nInstall it with: `npm install @journeyapps/sqlcipher`");
    }

    const subcommand = args[0] ? args[0].toLowerCase() : "status";

    switch (subcommand) {
        case "status":
            if (yuno.database.isEncrypted) {
                sendSuccess("Database is currently **encrypted**.");
            } else {
                send("Database is currently **not encrypted**.\nUse `db-encrypt set <password>` to enable encryption.");
            }
            break;

        case "set":
            if (args.length < 2) {
                return sendError("Please provide a password: `db-encrypt set <password>`");
            }

            const newPassword = args.slice(1).join(" ");

            if (newPassword.length < 8) {
                return sendError("Password must be at least 8 characters long.");
            }

            try {
                if (yuno.database.isEncrypted) {
                    // Change existing password
                    await yuno.database.rekey(newPassword);
                    sendSuccess("Database encryption password has been changed.");
                } else {
                    // Enable encryption on unencrypted database
                    await yuno.database.rekey(newPassword);
                    yuno.database.isEncrypted = true;
                    sendSuccess("Database encryption has been enabled.");
                }

                // Save password to config
                yuno.config.set("database.password", newPassword);
                await yuno.config.save();

                send(":warning: **Important**: The password has been saved to config.json. Keep this file secure!");

                if (isDiscord) {
                    // Delete the message containing the password for security
                    try {
                        await msg.delete();
                        send("Your command message was deleted for security.");
                    } catch (e) {
                        send(":warning: Could not delete your message. Please delete it manually to protect your password.");
                    }
                }
            } catch (e) {
                sendError("Failed to set encryption: " + e.message);
            }
            break;

        case "remove":
            if (!yuno.database.isEncrypted) {
                return sendError("Database is not encrypted.");
            }

            try {
                // Remove encryption by setting empty key
                await yuno.database.runPromise("PRAGMA rekey = ''");
                yuno.database.isEncrypted = false;

                // Remove password from config
                yuno.config.set("database.password", null);
                await yuno.config.save();

                sendSuccess("Database encryption has been removed.");
                send(":warning: Your database is now unencrypted. Anyone with file access can read it.");
            } catch (e) {
                sendError("Failed to remove encryption: " + e.message);
            }
            break;

        case "help":
        default:
            send("**Database Encryption Commands**\n" +
                "```\n" +
                "db-encrypt status  - Check encryption status\n" +
                "db-encrypt set <password>  - Enable/change encryption\n" +
                "db-encrypt remove  - Remove encryption (not recommended)\n" +
                "db-encrypt help    - Show this help\n" +
                "```\n" +
                ":information_source: Requires `@journeyapps/sqlcipher` to be installed.");
            break;
    }
};

module.exports.about = {
    "command": "db-encrypt",
    "description": "Manage database encryption. Requires @journeyapps/sqlcipher.",
    "examples": [
        "db-encrypt status",
        "db-encrypt set MySecurePassword123",
        "db-encrypt remove"
    ],
    "discord": true,
    "terminal": true,
    "list": false,
    "listTerminal": true,
    "onlyMasterUsers": true
};

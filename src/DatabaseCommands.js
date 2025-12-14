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

const Database = require("./database");
const LRUCache = require("./lib/lruCache");

// Cache for guild settings (5 minute TTL, max 500 guilds)
const guildSettingsCache = new LRUCache(500, 5 * 60 * 1000);
// Cache for XP data (1 minute TTL, max 1000 entries)
const xpDataCache = new LRUCache(1000, 60 * 1000);
// Cache for log channel settings (5 minute TTL, max 500 guilds)
const logChannelCache = new LRUCache(500, 5 * 60 * 1000);
// Cache for VC XP config (5 minute TTL, max 500 guilds)
const vcXpConfigCache = new LRUCache(500, 5 * 60 * 1000);
// Cache for DM config (5 minute TTL, max 500 guilds)
const dmConfigCache = new LRUCache(500, 5 * 60 * 1000);
// Cache for bot bans (5 minute TTL, max 1000 entries)
const botBanCache = new LRUCache(1000, 5 * 60 * 1000);

let self;

const zeroPadding = (num, places) => {
    const zero = places - num.toString().length + 1;
    return Array(+(zero > 0 && zero)).join("0") + num;
};

module.exports = self = {
    /**
     * Upgrades the Yuno's first version database to this version
     * @param {Yuno} Yuno The Yuno instance
     * @param {Prompt} prompt The Prompt
     * @param {String} file
     * @param {String} destination The filename of the destination file.
     * @return {Promise}
     */
    "upgrade": async function(Yuno, prompt, file, to) {
        // Ensure .db extension
        if (!to.endsWith(".db")) to += ".db";

        try { require("fs").unlinkSync(to); } catch {}

        const olddb = await (new Database).open(file);
        const olddbVers = await olddb.allPromise("PRAGMA user_version;");
        const isItReallyFromV1 = Array.isArray(olddbVers);
        const newdb = await (new Database).open(to);

        if (!isItReallyFromV1) {
            Yuno.prompt.error("Database isn't from Yuno Gasai v1. If it's really from v1, why is then a user_version PRAGMA ? :thinking:");
            return;
        }

        const experiences = await olddb.allPromise("SELECT * FROM exp");
        const guilds = await olddb.allPromise("SELECT * FROM guilds");

        await self.initDB(newdb, Yuno, true);

        prompt.info("Exporting experiences... 1/2");
        for (let i = 0; i < experiences.length; i++) {
            const el = experiences[i];
            await newdb.runPromise("INSERT INTO experiences VALUES(?, ?, ?, ?)",
                [el.level, el.userID, el.guildID, el.expCount]);
            prompt.writeWithoutJumpingLine(`${i}/${experiences.length} values inserted into table experiences.`);
        }
        prompt.success("Experiences exported...");

        prompt.info("Exporting guild settings... 2/2");
        for (let i = 0; i < guilds.length; i++) {
            const el = guilds[i]; // Fixed: was experiences[i]
            await newdb.runPromise("INSERT INTO guilds VALUES(?, ?, ?, NULL, true)",
                [el.guildID, el.prefix, el.joinDMMessage]);
            prompt.writeWithoutJumpingLine(`${zeroPadding(i, guilds.length.toString().length)}/${guilds.length} values inserted into table guild settings.`);
        }
        prompt.success("Guild settings exported");

        await newdb.closePromise();
        prompt.success("The database has been updated!");
    },

    /**
     * Inits the tables of a new database.
     * @param {Database} database
     * @param {Yuno} Yuno Yuno's instance.
     * @param {boolean} newDb Representing if the DB was just created.
     * @async
     */
    "initDB": async function(database, Yuno, newDb) {
        let version = await database.allPromise("PRAGMA user_version;"),
            dbVer = version[0]["user_version"];

        if (dbVer < Yuno.intVersion && !newDb) {
            Yuno.prompt.info("The database isn't at the good version for the bot. (Yuno's version: " + Yuno.intVersion + "; dbvers: " + dbVer + "). Expect errors, and report them.")
            if (dbVer === 0) {
                Yuno.prompt.error("The database isn't for the Yuno's v2 version. Please update the db, see node index -h to upgrade it.");
                return Yuno.shutdown(-1);
            }
        }

        await database.runPromise("PRAGMA user_version = " + Yuno.intVersion);

        await database.runPromise(`CREATE TABLE IF NOT EXISTS experiences (
            level INTEGER,
            userID STRING,
            guildID STRING,
            exp INTEGER
        )`)
        /*
            id = the guild id
            prefix = the prefix triggering commands
            onJoinDMMsg = the message sent to new users
            onJoinDMMsgTitle = the title of the msg sent to new users
        */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS guilds (
            id TEXT,
            prefix VARCHAR(5),
            onJoinDMMsg TEXT,
            onJoinDMMsgTitle VARCHAR(255),
            spamFilter BOOL,
            measureXP BOOL,
            levelRoleMap TEXT
        )`)
        /*
            gid = the guild id
            cname = the channel's name
            cleantime = the nb of hours between each clean
            warningtime = the nb of minutes before the clean to warn
            remainingtime = remaining time before clean in minute (updated every minute)
        */
       await database.runPromise(`CREATE TABLE IF NOT EXISTS channelcleans (
           gid TEXT,
           cname TEXT,
           cleantime INTEGER,
           warningtime INTEGER,
           remainingtime TEXT
        )`)
        /*
            id = index
            gid = the guild id
            trigger
            response
            image
        */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS mentionResponses (
            id INTEGER PRIMARY KEY, 
            gid TEXT,
            trigger TEXT,
            response TEXT,
            image TEXT
        )`)
        /*
         * gid = guild id
         * banner = user id of the banner
         * image = image url
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS banImages (
            gid TEXT,
            banner TEXT,
            image TEXT
        )`)

        /*
         * Moderation actions tracking
         * gid = guild id
         * moderatorId = user id of the moderator who performed the action
         * targetId = user id of the target
         * action = 'ban', 'kick', 'unban', 'timeout'
         * reason = reason for the action
         * timestamp = when the action occurred
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS modActions (
            id INTEGER PRIMARY KEY,
            gid TEXT,
            moderatorId TEXT,
            targetId TEXT,
            action TEXT,
            reason TEXT,
            timestamp INTEGER
        )`)

        /*
         * Log channel configuration per guild
         * gid = guild id
         * logType = 'unified', 'voice', 'nickname', 'avatar', 'presence'
         * channelId = channel id to send logs to
         * enabled = whether this log type is enabled
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS logChannels (
            gid TEXT,
            logType TEXT,
            channelId TEXT,
            enabled INTEGER DEFAULT 1,
            PRIMARY KEY (gid, logType)
        )`)

        /*
         * Log settings per guild
         * gid = guild id
         * flushInterval = seconds between log flushes (min 10, max 300)
         * maxBufferSize = max entries before force flush (min 10, max 100)
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS logSettings (
            gid TEXT PRIMARY KEY,
            flushInterval INTEGER DEFAULT 30,
            maxBufferSize INTEGER DEFAULT 50
        )`)

        /*
         * Voice channel XP configuration per guild
         * gid = guild id
         * enabled = whether VC XP is enabled
         * xpPerInterval = XP amount granted per interval
         * intervalSeconds = time interval in seconds
         * ignoreAfkChannel = whether to ignore AFK channel
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS vcXpConfig (
            gid TEXT PRIMARY KEY,
            enabled INTEGER DEFAULT 0,
            xpPerInterval INTEGER DEFAULT 10,
            intervalSeconds INTEGER DEFAULT 300,
            ignoreAfkChannel INTEGER DEFAULT 1
        )`)

        /*
         * Active voice channel sessions for XP tracking
         * gid = guild id
         * usrId = user id
         * channelId = current voice channel id
         * joinedAt = timestamp when user joined VC
         * lastXpGrant = timestamp of last XP grant
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS vcSessions (
            gid TEXT,
            usrId TEXT,
            channelId TEXT,
            joinedAt INTEGER,
            lastXpGrant INTEGER,
            PRIMARY KEY (gid, usrId)
        )`)

        /*
         * DM forwarding configuration per guild
         * gid = guild id
         * channelId = channel to forward DMs to
         * enabled = whether forwarding is enabled
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS dmConfig (
            gid TEXT PRIMARY KEY,
            channelId TEXT,
            enabled INTEGER DEFAULT 1
        )`)

        /*
         * Users/servers banned from using the bot
         * id = user id or guild id
         * type = 'user' or 'server'
         * reason = ban reason
         * bannedAt = timestamp
         * bannedBy = user id who banned
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS botBans (
            id TEXT PRIMARY KEY,
            type TEXT,
            reason TEXT,
            bannedAt INTEGER,
            bannedBy TEXT
        )`)

        /*
         * DM inbox for storing messages sent to the bot
         * usrId = user id who sent the DM
         * userTag = user tag at time of message
         * content = message content
         * attachments = JSON array of attachment URLs
         * timestamp = when message was received
         * replied = whether bot has replied
         */
        await database.runPromise(`CREATE TABLE IF NOT EXISTS dmInbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usrId TEXT,
            userTag TEXT,
            content TEXT,
            attachments TEXT,
            timestamp INTEGER,
            replied INTEGER DEFAULT 0
        )`)

        // Create indexes for common queries
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_botbans_type ON botBans(type)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_dminbox_usrid ON dmInbox(usrId)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_dminbox_timestamp ON dmInbox(timestamp)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_modactions_gid_moderator ON modActions(gid, moderatorId)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_modactions_gid_action ON modActions(gid, action)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_experiences_user_guild ON experiences(userID, guildID)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_guilds_id ON guilds(id)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_channelcleans_gid_cname ON channelcleans(gid, cname)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_mentionresponses_gid_trigger ON mentionResponses(gid, trigger)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_banimages_gid_banner ON banImages(gid, banner)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_logchannels_gid ON logChannels(gid)`);
        await database.runPromise(`CREATE INDEX IF NOT EXISTS idx_vcsessions_gid ON vcSessions(gid)`);
    },

    /**
     * Inits a guild in the database. (if it's not recorded in the db.)
     * @param {Database} database
     * @param {String} guildid
     * @async
     */
    "initGuild": async function(database, guildid) {
        let exists = await database.allPromise("SELECT * FROM guilds WHERE id = ?", [guildid]);
        if (exists.length === 0)
            await database.runPromise("INSERT INTO guilds(id) VALUES(?)", [guildid]);
    },

    /**
     * Returns the prefixes of all guilds in an object
     * @param {Database} database
     * @async
     * @return {Object}
     */
    "getPrefixes": async function(database) {
        let guilds = await database.allPromise("SELECT id, prefix FROM guilds"),
            finalObj = {};

        for (const el of guilds) finalObj[el.id] = el.prefix;

        return finalObj;
    },

    /**
     * Sets the prefix for a guild (from its guild id)
     * @param {Database} database
     * @param {String} guildid
     * @param {String} prefix
     * @async
     */
    "setPrefix": async function(database, guildid, prefix) {
        await self.initGuild(database, guildid);
        await database.runPromise("UPDATE guilds SET prefix = ? WHERE id = ?", [prefix, guildid]);
    },

    /**
     * Returns the messages to send via DM to users.
     * @param {Database} database
     * @async
     * @return {Object}
     */
    "getJoinDMMessages": async function(database) {
        let messages = await database.allPromise("SELECT id, onJoinDMMsg FROM guilds"),
            finalObj = {};

        for (const el of messages) finalObj[el.id] = el.onJoinDMMsg;

        return finalObj;
    },

    /**
     * Sets the DM Message for a user joins for a guild (from its guild id)
     * @param {Database} database
     * @param {String} guildid
     * @param {String} message
     * @async
     */
    "setJoinDMMessage": async function(database, guildid, message) {
        await self.initGuild(database, guildid);
        await database.runPromise("UPDATE guilds SET onJoinDMMsg = ? WHERE id = ?", [message, guildid]);
    },

    /**
     * Returns the title of the messages to send via DM to users.
     * @param {Database} database
     * @async
     * @return {Object}
     */
    "getJoinDMMessagesTitles": async function(database) {
        let messages = await database.allPromise("SELECT id, onJoinDMMsgTitle FROM guilds"),
            finalObj = {};

        for (const el of messages) finalObj[el.id] = el.onJoinDMMsgTitle;

        return finalObj;
    },

    /**
     * Sets the DM Message's title for a user joins for a guild (from its guild id)
     * @param {Database} database
     * @param {String} guildid
     * @param {String} messageTitle
     * @async
     */
    "setJoinDMMessageTitle": async function(database, guildid, messageTitle) {
        await self.initGuild(database, guildid);
        await database.runPromise("UPDATE guilds SET onJoinDMMsgTitle = ? WHERE id = ?", [messageTitle, guildid]);
    },

    /**
     * Returns an object, as key guild ids, and as value a boolean value to say if the spam filter is enabled.
     * @param {Database} database
     * @async
     * @return {Object}
     */
    "getSpamFilterEnabled": async function(database) {
        let spam = await database.allPromise("SELECT id, spamFilter FROM guilds"),
            finalObj = {};

        for (const el of spam) finalObj[el.id] = el.spamFilter;

        return finalObj;
    },

    /**
     * Enable/Disable spam filter for a guild (from its guildid)
     * @param {Database} database
     * @param {String} guildid
     * @param {String} spamFilter
     * @async
     */
    "setSpamFilterEnabled": async function(database, guildid, spamFilter) {
        await self.initGuild(database, guildid);
        await database.runPromise("UPDATE guilds SET spamFilter = ? WHERE id = ?", [spamFilter, guildid]);
    },

    /**
     * Returns an array, with all guilds with exp counting is enabled.
     * @param {Database} database
     * @async
     * @return {Object}
     */
    "getGuildsWhereExpIsEnabled": async function(database) {
        let sql = await database.allPromise("SELECT id, measureXP FROM guilds"),
            arr = [];

        for (const el of sql) {
            if (el.measureXP === "true" || el.measureXP === true)
                arr.push(el.id);
        }

        return arr;
    },

    /**
     * Enable/Disable xp for a guild (from its guildid)
     * @param {Database} database
     * @param {String} guildid
     * @param {String} xpen
     * @async
     */
    "setXPEnabled": async function(database, guildid, xpen) {
        await self.initGuild(database, guildid);
        await database.runPromise("UPDATE guilds SET measureXP = ? WHERE id = ?", [xpen, guildid]);
    },

    /**
     * Returns the level role map of a guild from its guildid
     * @param {Database} database
     * @param {String} guildid
     * @async
     * @return {Object}
     */
    "getLevelRoleMap": async function(database, guildid) {
        const cacheKey = `guild:levelRoleMap:${guildid}`;
        const cached = guildSettingsCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        let sql = await database.allPromise("SELECT levelRoleMap FROM guilds WHERE id = ?;", [guildid]);

        if (!sql || sql.length === 0 || sql[0]["levelRoleMap"] === null) {
            guildSettingsCache.set(cacheKey, null);
            return null;
        }

        const result = JSON.parse(sql[0]["levelRoleMap"]);
        guildSettingsCache.set(cacheKey, result);
        return result;
    },

    /**
     * Enable/Disable xp for a guild (from its guildid)
     * @param {Database} database
     * @param {String} guildid
     * @param {String|Object} rolemap
     * @async
     */
    "setLevelRoleMap": async function(database, guildid, rolemap) {
        if (typeof rolemap === "object")
            rolemap = JSON.stringify(rolemap);

        // Invalidate cache on update
        guildSettingsCache.delete(`guild:levelRoleMap:${guildid}`);
        await self.initGuild(database, guildid);
        await database.runPromise("UPDATE guilds SET levelRoleMap = ? WHERE id = ?", [rolemap, guildid]);
    },

    /**
     * Returns XP data of a user by its id and guilds's id.
     * Creates the entry if inexistant.
     * @param {Database} database
     * @param {String} guildid
     * @param {String} userid
     * @async
     * @return {Object}
     */
    "getXPData": async function(database, guildid, userid) {
        const cacheKey = `xp:${guildid}:${userid}`;
        const cached = xpDataCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        let sql = await database.allPromise("SELECT level, exp FROM experiences WHERE userID = ? AND guildID = ?", [userid, guildid]);

        if (!sql || sql.length === 0) {
            await database.runPromise("INSERT INTO experiences (level, userID, guildID, exp) VALUES(?,?,?,?)",
                [0, userid, guildid, 0])
            const result = {
                "xp": 0,
                "level": 0
            };
            xpDataCache.set(cacheKey, result);
            return result;
        }

        let ret = sql[0];

        const result = {
            "xp": parseInt(ret.exp, 10),
            "level": parseInt(ret.level, 10)
        };
        xpDataCache.set(cacheKey, result);
        return result;
    },

    /**
     * Sets XP data.
     * @param {Database} database
     * @param {String} guildid
     * @param {String} userid
     * @param {number} xp
     * @param {number} level
     * @async
     */
    "setXPData": async function(database, guildid, userid, xp, level) {
        // Invalidate cache on update
        xpDataCache.delete(`xp:${guildid}:${userid}`);
        return await database.runPromise("UPDATE experiences SET level = ?, exp = ? WHERE guildID = ? AND userID = ?",
            [level, xp, guildid, userid])
    },

    /**
     * Returns the cleans in the database
     * @param {Database} database
     * @async
     * @return {array} For each el., an object containing for each value string: guildid, channelid, timeFEachClean, timeBeforeClean 
     */
    "getCleans": async function(database) {
        let cleans = await database.allPromise("SELECT * FROM channelcleans"),
            finalObj = [];

        for (const el of cleans) {
            finalObj.push({
                "guildId": el.gid,
                "channelName": el.cname,
                "timeFEachClean": parseInt(el.cleantime, 10),
                "timeBeforeClean": parseInt(el.warningtime, 10),
                "remainingTime": parseInt(el.remainingtime, 10)
            });
        }

        return finalObj;
    },

    /**
     * Get a wanted clean
     * @param {Database} database
     * @param {String} guildid
     * @param {String} channelname
     * @async
     * @return {Object|null} as a value from .getCleans
     */
    "getClean": async function(database, guildid, channelname) {
        let clean = await database.allPromise("SELECT * FROM channelcleans WHERE gid = ? AND cname = ?", [guildid, channelname]);

        clean = clean[0];
        if (typeof clean !== "object")
            return null;
        return {
            "guildId": guildid,
            "channelName": clean.cname,
            "timeFEachClean": parseInt(clean.cleantime, 10),
            "timeBeforeClean": parseInt(clean.warningtime, 10),
            "remainingTime": parseInt(clean.remainingtime, 10)
        }
    },

    /**
     * Creates/Edits a clean entry in the database 
     * @param {Database} database
     * @param {String} guildid
     * @param {String} channelname
     * @param {String|number} timeFEachClean Time between the cleans
     * @param {String|number} timeBeforeClean The warn sent before this number of minutes before the clean
     * @param {String|number|null} remainingTime The remaining time for the clean in seconds
     * @async
     * @returns {array} The first element is whether "creating" or "updating": creating if the rule has been created, updating whether it was updated.
     * The second is the database return.
     */
    "setClean": async function(database, guildid, channelname, timeFEachClean, timeBeforeClean, remainingTime) {
        await self.initGuild(database, guildid);

        if (typeof guildid !== "string" || typeof channelname !== "string")
            return;

        if (typeof timeFEachClean === "string")
            timeFEachClean = parseInt(timeFEachClean, 10);

        if (typeof timeBeforeClean === "string")
            timeBeforeClean = parseInt(timeBeforeClean, 10);

        if (typeof remainingTime === "string")
            remainingTime = parseInt(remainingTime, 10);

        if (remainingTime > timeFEachClean * 60)
            remainingTime = timeFEachClean;

        if (remainingTime === null)
            remainingTime = timeFEachClean * 60;

        if (isNaN(timeFEachClean) || isNaN(timeBeforeClean))
            return;

        const entry = await database.allPromise("SELECT cleantime FROM channelcleans WHERE gid = ? AND cname = ?;", [guildid, channelname]);

        if (entry.length === 0) {
            return ["creating", await database.runPromise("INSERT INTO channelcleans(gid, cname, cleantime, warningtime, remainingtime) VALUES(?, ?, ?, ?, ?);", [guildid, channelname, timeFEachClean, timeBeforeClean, remainingTime])];
        }
        return ["updating", await database.runPromise("UPDATE channelcleans SET cleantime = ?, warningtime = ?, remainingtime = ? WHERE gid = ? AND cname = ?;", [timeFEachClean, timeBeforeClean, remainingTime.toString(), guildid, channelname])];
    },

    /**
     * Deletes an auto-clean
     * @param {Database} database
     * @param {String} guildid
     * @param {String} channelname
     * @async
     */
    "delClean": async function(database, guildid, channelname) {
        await self.initGuild(database, guildid);
        await database.runPromise("DELETE FROM channelcleans WHERE gid = ? AND cname = ?;", [guildid, channelname]);
    },

    /**
     * Adds a mention response
     * @param {Database} database
     * @param {String} guildid
     * @param {String} trigger
     * @param {String} response
     * @param {String} image
     */
    "addMentionResponses": async function(database, guildid, trigger, response, image) {
        if (typeof image !== "string")
            image = "null";

        await self.initGuild(database, guildid);
        return await database.runPromise("INSERT INTO mentionResponses(id, gid, trigger, response, image) VALUES(null, ?, ?, ?, ?)", [guildid, trigger, response, image])
    },

    /**
     * Returns all the mentions responses in an array containing objects (id, guildId, trigger, response, image)
     * @param {Database} database
     * @async
     */
    "getMentionResponses": async function(database) {
        let mentionResponses = await database.allPromise("SELECT * FROM mentionResponses"),
            r = [];

        for (const el of mentionResponses) {
            r.push({
                "id": el.id,
                "guildId": el.gid,
                "trigger": el.trigger,
                "response": el.response,
                "image": el.image
            })
        }

        return r;
    },

    /**
     * Return a mention response from trigger
     * @param {Database} database
     * @param {String} guildid
     * @param {String} trigger
     * @async
     */
    "getMentionResponseFromTrigger": async function(database, guildid, trigger) {
        let mentionResponse = (await database.allPromise("SELECT * FROM mentionResponses WHERE gid = ? AND trigger = ?", [guildid, trigger]))[0];

        if (typeof mentionResponse === "undefined")
            return null;
        else
            return {
                "id": mentionResponse.id,
                "guildId": mentionResponse.gid,
                "trigger": mentionResponse.trigger,
                "response": mentionResponse.response,
                "image": mentionResponse.image
            }
    },

    /**
     * Deletes a mention response
     * @param {Database} database
     * @param {number} id
     */
    "delMentionResponse": async function(database, id) {
        return await database.runPromise("DELETE FROM mentionResponses WHERE id = ?;", [id])
    },

    /**
     * Sets the ban image for a banner
     * @param {Database} database
     * @param {String} guildid
     * @param {String} bannerid
     * @param {String} imageurl
     * @async
     * @return Array containing first "creating"/"updating" and as second element the database return
     */
    "setBanImage": async function(database, guildid, bannerid, imageurl) {
        await self.initGuild(database, guildid);
        let entry = await database.allPromise("SELECT image FROM banImages WHERE gid = ? AND banner = ?;", [guildid, bannerid]);

        if (entry.length === 0) {
            let dbr = await database.runPromise("INSERT INTO banImages(gid, banner, image) VALUES(?, ?, ?);", [guildid, bannerid, imageurl]);
            return ["creating", dbr]
        } else {
            let dbr = await database.runPromise("UPDATE banImages SET image = ? WHERE gid = ? AND banner = ?;", [imageurl, guildid, bannerid]);
            return ["updating", dbr]
        }
    },

    /**
     * Returns the image of the banner id
     * @param {Database} database
     * @param {String} guildid
     * @param {String} bannerid
     * @async
     * @return {null|String}
     */
    "getBanImage": async function(database, guildid, bannerid) {
        await self.initGuild(database, guildid);

        let result = await database.allPromise("SELECT * FROM banImages WHERE gid = ? AND banner = ?", [guildid, bannerid])

        if (result.length === 0)
            return null;

        return result[0].image;
    },

    /**
     * Deletes the ban image (causing the default image to appear when banning)
     * @param {Database} database
     * @param {String} guildid
     * @param {String} bannerid
     * @async
     */
    "delBanImage": async function(database, guildid, bannerid) {
        return await database.runPromise("DELETE FROM banImages WHERE gid = ? AND banner = ?;", [guildid, bannerid])
    },

    /**
     * Clear all caches (useful for shutdown/hot-reload)
     */
    "clearCaches": function() {
        guildSettingsCache.clear();
        xpDataCache.clear();
        logChannelCache.clear();
        vcXpConfigCache.clear();
        dmConfigCache.clear();
        botBanCache.clear();
    },

    /**
     * Invalidate all caches for a specific guild
     * @param {String} guildid
     */
    "invalidateGuildCache": function(guildid) {
        guildSettingsCache.invalidatePrefix(`guild:`);
        xpDataCache.invalidatePrefix(`xp:${guildid}:`);
    },

    /**
     * Add a moderation action to the database
     * @param {Database} database
     * @param {String} guildid
     * @param {String} moderatorId
     * @param {String} targetId
     * @param {String} action - 'ban', 'kick', 'unban', 'timeout'
     * @param {String} reason
     * @param {number} timestamp - Unix timestamp in ms
     * @async
     */
    "addModAction": async function(database, guildid, moderatorId, targetId, action, reason, timestamp) {
        await self.initGuild(database, guildid);
        return await database.runPromise(
            "INSERT INTO modActions(id, gid, moderatorId, targetId, action, reason, timestamp) VALUES(null, ?, ?, ?, ?, ?, ?)",
            [guildid, moderatorId, targetId, action, reason || null, timestamp]
        );
    },

    /**
     * Check if a mod action already exists (to avoid duplicates when scanning)
     * @param {Database} database
     * @param {String} guildid
     * @param {String} targetId
     * @param {String} action
     * @param {number} timestamp
     * @async
     * @return {boolean}
     */
    "modActionExists": async function(database, guildid, targetId, action, timestamp) {
        const result = await database.allPromise(
            "SELECT id FROM modActions WHERE gid = ? AND targetId = ? AND action = ? AND timestamp = ?",
            [guildid, targetId, action, timestamp]
        );
        return result.length > 0;
    },

    /**
     * Get mod action stats for a guild
     * @param {Database} database
     * @param {String} guildid
     * @async
     * @return {Object} Stats object with counts per moderator and action type
     */
    "getModStats": async function(database, guildid) {
        await self.initGuild(database, guildid);

        // Get counts by action type
        const actionCounts = await database.allPromise(
            "SELECT action, COUNT(*) as count FROM modActions WHERE gid = ? GROUP BY action",
            [guildid]
        );

        // Get counts by moderator
        const modCounts = await database.allPromise(
            "SELECT moderatorId, action, COUNT(*) as count FROM modActions WHERE gid = ? GROUP BY moderatorId, action ORDER BY count DESC",
            [guildid]
        );

        // Get top moderators by total actions
        const topMods = await database.allPromise(
            "SELECT moderatorId, COUNT(*) as count FROM modActions WHERE gid = ? GROUP BY moderatorId ORDER BY count DESC LIMIT 10",
            [guildid]
        );

        return {
            actionCounts,
            modCounts,
            topMods
        };
    },

    /**
     * Get total mod actions count for a guild
     * @param {Database} database
     * @param {String} guildid
     * @async
     * @return {number}
     */
    "getModActionsCount": async function(database, guildid) {
        const result = await database.allPromise(
            "SELECT COUNT(*) as count FROM modActions WHERE gid = ?",
            [guildid]
        );
        return result[0]?.count || 0;
    },

    // ==================== Log Channel Functions ====================

    /**
     * Get all log channel configurations for a guild
     * @param {Database} database
     * @param {String} guildid
     * @async
     * @return {Object} Object with logType as keys and {channelId, enabled} as values
     */
    "getLogChannels": async function(database, guildid) {
        const cacheKey = `logChannels:${guildid}`;
        const cached = logChannelCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const result = await database.allPromise(
            "SELECT logType, channelId, enabled FROM logChannels WHERE gid = ?",
            [guildid]
        );

        const channels = {};
        for (const row of result) {
            channels[row.logType] = {
                channelId: row.channelId,
                enabled: row.enabled === 1
            };
        }

        logChannelCache.set(cacheKey, channels);
        return channels;
    },

    /**
     * Set a log channel for a specific log type
     * @param {Database} database
     * @param {String} guildid
     * @param {String} logType - 'unified', 'voice', 'nickname', 'avatar', 'presence'
     * @param {String} channelId
     * @async
     */
    "setLogChannel": async function(database, guildid, logType, channelId) {
        await self.initGuild(database, guildid);
        logChannelCache.delete(`logChannels:${guildid}`);

        const existing = await database.allPromise(
            "SELECT channelId FROM logChannels WHERE gid = ? AND logType = ?",
            [guildid, logType]
        );

        if (existing.length === 0) {
            await database.runPromise(
                "INSERT INTO logChannels(gid, logType, channelId, enabled) VALUES(?, ?, ?, 1)",
                [guildid, logType, channelId]
            );
        } else {
            await database.runPromise(
                "UPDATE logChannels SET channelId = ?, enabled = 1 WHERE gid = ? AND logType = ?",
                [channelId, guildid, logType]
            );
        }
    },

    /**
     * Remove a log channel configuration
     * @param {Database} database
     * @param {String} guildid
     * @param {String} logType
     * @async
     */
    "removeLogChannel": async function(database, guildid, logType) {
        logChannelCache.delete(`logChannels:${guildid}`);
        await database.runPromise(
            "DELETE FROM logChannels WHERE gid = ? AND logType = ?",
            [guildid, logType]
        );
    },

    /**
     * Toggle a log channel enabled/disabled
     * @param {Database} database
     * @param {String} guildid
     * @param {String} logType
     * @param {boolean} enabled
     * @async
     */
    "setLogChannelEnabled": async function(database, guildid, logType, enabled) {
        logChannelCache.delete(`logChannels:${guildid}`);
        await database.runPromise(
            "UPDATE logChannels SET enabled = ? WHERE gid = ? AND logType = ?",
            [enabled ? 1 : 0, guildid, logType]
        );
    },

    /**
     * Get log settings for a guild
     * @param {Database} database
     * @param {String} guildid
     * @async
     * @return {Object} {flushInterval, maxBufferSize}
     */
    "getLogSettings": async function(database, guildid) {
        const result = await database.allPromise(
            "SELECT flushInterval, maxBufferSize FROM logSettings WHERE gid = ?",
            [guildid]
        );

        if (result.length === 0) {
            return {
                flushInterval: 30,
                maxBufferSize: 50
            };
        }

        return {
            flushInterval: result[0].flushInterval,
            maxBufferSize: result[0].maxBufferSize
        };
    },

    /**
     * Set log settings for a guild
     * @param {Database} database
     * @param {String} guildid
     * @param {Object} settings - {flushInterval, maxBufferSize}
     * @async
     */
    "setLogSettings": async function(database, guildid, settings) {
        await self.initGuild(database, guildid);

        // Enforce limits (respect Discord API)
        const flushInterval = Math.max(10, Math.min(300, settings.flushInterval || 30));
        const maxBufferSize = Math.max(10, Math.min(100, settings.maxBufferSize || 50));

        const existing = await database.allPromise(
            "SELECT gid FROM logSettings WHERE gid = ?",
            [guildid]
        );

        if (existing.length === 0) {
            await database.runPromise(
                "INSERT INTO logSettings(gid, flushInterval, maxBufferSize) VALUES(?, ?, ?)",
                [guildid, flushInterval, maxBufferSize]
            );
        } else {
            await database.runPromise(
                "UPDATE logSettings SET flushInterval = ?, maxBufferSize = ? WHERE gid = ?",
                [flushInterval, maxBufferSize, guildid]
            );
        }
    },

    // ==================== VC XP Config Functions ====================

    /**
     * Get VC XP configuration for a guild
     * @param {Database} database
     * @param {String} guildid
     * @async
     * @return {Object} Config object with enabled, xpPerInterval, intervalSeconds, ignoreAfkChannel
     */
    "getVcXpConfig": async function(database, guildid) {
        const cacheKey = `vcXpConfig:${guildid}`;
        const cached = vcXpConfigCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const result = await database.allPromise(
            "SELECT enabled, xpPerInterval, intervalSeconds, ignoreAfkChannel FROM vcXpConfig WHERE gid = ?",
            [guildid]
        );

        if (result.length === 0) {
            const defaultConfig = {
                enabled: false,
                xpPerInterval: 10,
                intervalSeconds: 300,
                ignoreAfkChannel: true
            };
            vcXpConfigCache.set(cacheKey, defaultConfig);
            return defaultConfig;
        }

        const config = {
            enabled: result[0].enabled === 1,
            xpPerInterval: result[0].xpPerInterval,
            intervalSeconds: result[0].intervalSeconds,
            ignoreAfkChannel: result[0].ignoreAfkChannel === 1
        };

        vcXpConfigCache.set(cacheKey, config);
        return config;
    },

    /**
     * Set VC XP configuration for a guild
     * @param {Database} database
     * @param {String} guildid
     * @param {Object} config - {enabled, xpPerInterval, intervalSeconds, ignoreAfkChannel}
     * @async
     */
    "setVcXpConfig": async function(database, guildid, config) {
        await self.initGuild(database, guildid);
        vcXpConfigCache.delete(`vcXpConfig:${guildid}`);

        const existing = await database.allPromise(
            "SELECT gid FROM vcXpConfig WHERE gid = ?",
            [guildid]
        );

        if (existing.length === 0) {
            await database.runPromise(
                "INSERT INTO vcXpConfig(gid, enabled, xpPerInterval, intervalSeconds, ignoreAfkChannel) VALUES(?, ?, ?, ?, ?)",
                [
                    guildid,
                    config.enabled ? 1 : 0,
                    config.xpPerInterval || 10,
                    config.intervalSeconds || 300,
                    config.ignoreAfkChannel !== false ? 1 : 0
                ]
            );
        } else {
            await database.runPromise(
                "UPDATE vcXpConfig SET enabled = ?, xpPerInterval = ?, intervalSeconds = ?, ignoreAfkChannel = ? WHERE gid = ?",
                [
                    config.enabled ? 1 : 0,
                    config.xpPerInterval || 10,
                    config.intervalSeconds || 300,
                    config.ignoreAfkChannel !== false ? 1 : 0,
                    guildid
                ]
            );
        }
    },

    // ==================== VC Session Functions ====================

    /**
     * Start a VC session for a user
     * @param {Database} database
     * @param {String} guildid
     * @param {String} userId
     * @param {String} channelId
     * @async
     */
    "startVcSession": async function(database, guildid, userId, channelId) {
        const now = Date.now();
        const existing = await database.allPromise(
            "SELECT usrId FROM vcSessions WHERE gid = ? AND usrId = ?",
            [guildid, userId]
        );

        if (existing.length === 0) {
            await database.runPromise(
                "INSERT INTO vcSessions(gid, usrId, channelId, joinedAt, lastXpGrant) VALUES(?, ?, ?, ?, ?)",
                [guildid, userId, channelId, now, now]
            );
        } else {
            await database.runPromise(
                "UPDATE vcSessions SET channelId = ?, joinedAt = ?, lastXpGrant = ? WHERE gid = ? AND usrId = ?",
                [channelId, now, now, guildid, userId]
            );
        }
    },

    /**
     * Update the channel for an existing VC session (for channel moves)
     * @param {Database} database
     * @param {String} guildid
     * @param {String} userId
     * @param {String} channelId
     * @async
     */
    "updateVcSessionChannel": async function(database, guildid, userId, channelId) {
        await database.runPromise(
            "UPDATE vcSessions SET channelId = ? WHERE gid = ? AND usrId = ?",
            [channelId, guildid, userId]
        );
    },

    /**
     * End a VC session and return the duration
     * @param {Database} database
     * @param {String} guildid
     * @param {String} userId
     * @async
     * @return {Object|null} {joinedAt, lastXpGrant, duration} or null if no session
     */
    "endVcSession": async function(database, guildid, userId) {
        const session = await database.allPromise(
            "SELECT joinedAt, lastXpGrant FROM vcSessions WHERE gid = ? AND usrId = ?",
            [guildid, userId]
        );

        if (session.length === 0) {
            return null;
        }

        const now = Date.now();
        const result = {
            joinedAt: session[0].joinedAt,
            lastXpGrant: session[0].lastXpGrant,
            duration: now - session[0].joinedAt
        };

        await database.runPromise(
            "DELETE FROM vcSessions WHERE gid = ? AND usrId = ?",
            [guildid, userId]
        );

        return result;
    },

    /**
     * Get a specific VC session
     * @param {Database} database
     * @param {String} guildid
     * @param {String} userId
     * @async
     * @return {Object|null}
     */
    "getVcSession": async function(database, guildid, userId) {
        const result = await database.allPromise(
            "SELECT channelId, joinedAt, lastXpGrant FROM vcSessions WHERE gid = ? AND usrId = ?",
            [guildid, userId]
        );

        if (result.length === 0) return null;

        return {
            channelId: result[0].channelId,
            joinedAt: result[0].joinedAt,
            lastXpGrant: result[0].lastXpGrant
        };
    },

    /**
     * Get all active VC sessions (for recovery on bot restart)
     * @param {Database} database
     * @async
     * @return {Array}
     */
    "getAllVcSessions": async function(database) {
        const result = await database.allPromise("SELECT * FROM vcSessions");
        return result.map(row => ({
            guildId: row.gid,
            oderId: row.usrId,
            channelId: row.channelId,
            joinedAt: row.joinedAt,
            lastXpGrant: row.lastXpGrant
        }));
    },

    /**
     * Update the last XP grant timestamp for a session
     * @param {Database} database
     * @param {String} guildid
     * @param {String} userId
     * @param {number} timestamp
     * @async
     */
    "updateVcSessionXpTime": async function(database, guildid, userId, timestamp) {
        await database.runPromise(
            "UPDATE vcSessions SET lastXpGrant = ? WHERE gid = ? AND usrId = ?",
            [timestamp, guildid, userId]
        );
    },

    /**
     * Get all active sessions for a guild
     * @param {Database} database
     * @param {String} guildid
     * @async
     * @return {Array}
     */
    "getGuildVcSessions": async function(database, guildid) {
        const result = await database.allPromise(
            "SELECT usrId, channelId, joinedAt, lastXpGrant FROM vcSessions WHERE gid = ?",
            [guildid]
        );
        return result.map(row => ({
            oderId: row.usrId,
            channelId: row.channelId,
            joinedAt: row.joinedAt,
            lastXpGrant: row.lastXpGrant
        }));
    },

    /**
     * Clear all VC sessions (useful for cleanup)
     * @param {Database} database
     * @async
     */
    "clearAllVcSessions": async function(database) {
        await database.runPromise("DELETE FROM vcSessions");
    },

    // ==================== DM Config Functions ====================

    /**
     * Get DM forwarding configuration for a guild
     * @param {Database} database
     * @param {String} guildid
     * @async
     * @return {Object|null} {channelId, enabled} or null if not configured
     */
    "getDmConfig": async function(database, guildid) {
        const cacheKey = `dmConfig:${guildid}`;
        const cached = dmConfigCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const result = await database.allPromise(
            "SELECT channelId, enabled FROM dmConfig WHERE gid = ?",
            [guildid]
        );

        if (result.length === 0) {
            dmConfigCache.set(cacheKey, null);
            return null;
        }

        const config = {
            channelId: result[0].channelId,
            enabled: result[0].enabled === 1
        };
        dmConfigCache.set(cacheKey, config);
        return config;
    },

    /**
     * Set DM forwarding channel for a guild
     * @param {Database} database
     * @param {String} guildid
     * @param {String} channelId
     * @async
     */
    "setDmConfig": async function(database, guildid, channelId) {
        await self.initGuild(database, guildid);
        dmConfigCache.delete(`dmConfig:${guildid}`);

        const existing = await database.allPromise(
            "SELECT gid FROM dmConfig WHERE gid = ?",
            [guildid]
        );

        if (existing.length === 0) {
            await database.runPromise(
                "INSERT INTO dmConfig(gid, channelId, enabled) VALUES(?, ?, 1)",
                [guildid, channelId]
            );
        } else {
            await database.runPromise(
                "UPDATE dmConfig SET channelId = ?, enabled = 1 WHERE gid = ?",
                [channelId, guildid]
            );
        }
    },

    /**
     * Remove DM forwarding configuration for a guild
     * @param {Database} database
     * @param {String} guildid
     * @async
     */
    "removeDmConfig": async function(database, guildid) {
        dmConfigCache.delete(`dmConfig:${guildid}`);
        await database.runPromise(
            "DELETE FROM dmConfig WHERE gid = ?",
            [guildid]
        );
    },

    /**
     * Get all guilds with DM forwarding configured
     * @param {Database} database
     * @async
     * @return {Array} Array of {guildId, channelId, enabled}
     */
    "getAllDmConfigs": async function(database) {
        const result = await database.allPromise(
            "SELECT gid, channelId, enabled FROM dmConfig WHERE enabled = 1"
        );
        return result.map(row => ({
            guildId: row.gid,
            channelId: row.channelId,
            enabled: row.enabled === 1
        }));
    },

    // ==================== Bot Ban Functions ====================

    /**
     * Add a bot-level ban (user or server)
     * @param {Database} database
     * @param {String} id - User ID or Guild ID
     * @param {String} type - 'user' or 'server'
     * @param {String} reason
     * @param {String} bannedBy - User ID who issued the ban
     * @async
     */
    "addBotBan": async function(database, id, type, reason, bannedBy) {
        botBanCache.delete(`botBan:${id}`);
        const existing = await database.allPromise(
            "SELECT id FROM botBans WHERE id = ?",
            [id]
        );

        if (existing.length === 0) {
            await database.runPromise(
                "INSERT INTO botBans(id, type, reason, bannedAt, bannedBy) VALUES(?, ?, ?, ?, ?)",
                [id, type, reason || null, Date.now(), bannedBy]
            );
        } else {
            await database.runPromise(
                "UPDATE botBans SET type = ?, reason = ?, bannedAt = ?, bannedBy = ? WHERE id = ?",
                [type, reason || null, Date.now(), bannedBy, id]
            );
        }
    },

    /**
     * Remove a bot-level ban
     * @param {Database} database
     * @param {String} id - User ID or Guild ID
     * @async
     */
    "removeBotBan": async function(database, id) {
        botBanCache.delete(`botBan:${id}`);
        await database.runPromise(
            "DELETE FROM botBans WHERE id = ?",
            [id]
        );
    },

    /**
     * Check if a user or server is bot-banned
     * @param {Database} database
     * @param {String} id - User ID or Guild ID
     * @async
     * @return {Object|null} Ban info or null if not banned
     */
    "getBotBan": async function(database, id) {
        const cacheKey = `botBan:${id}`;
        const cached = botBanCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }

        const result = await database.allPromise(
            "SELECT id, type, reason, bannedAt, bannedBy FROM botBans WHERE id = ?",
            [id]
        );

        if (result.length === 0) {
            botBanCache.set(cacheKey, null);
            return null;
        }

        const ban = {
            id: result[0].id,
            type: result[0].type,
            reason: result[0].reason,
            bannedAt: result[0].bannedAt,
            bannedBy: result[0].bannedBy
        };
        botBanCache.set(cacheKey, ban);
        return ban;
    },

    /**
     * Get all bot bans (optionally filtered by type)
     * @param {Database} database
     * @param {String} type - 'user', 'server', or null for all
     * @async
     * @return {Array}
     */
    "getAllBotBans": async function(database, type) {
        let result;
        if (type) {
            result = await database.allPromise(
                "SELECT id, type, reason, bannedAt, bannedBy FROM botBans WHERE type = ? ORDER BY bannedAt DESC",
                [type]
            );
        } else {
            result = await database.allPromise(
                "SELECT id, type, reason, bannedAt, bannedBy FROM botBans ORDER BY bannedAt DESC"
            );
        }

        return result.map(row => ({
            id: row.id,
            type: row.type,
            reason: row.reason,
            bannedAt: row.bannedAt,
            bannedBy: row.bannedBy
        }));
    },

    /**
     * Check if user or their server is bot-banned
     * @param {Database} database
     * @param {String} userId
     * @param {String} guildId - Optional guild ID to check
     * @async
     * @return {Object} {banned: boolean, reason?: string, type?: string}
     */
    "isBotBanned": async function(database, userId, guildId) {
        const userBan = await self.getBotBan(database, userId);
        if (userBan) {
            return { banned: true, reason: userBan.reason, type: 'user' };
        }

        if (guildId) {
            const serverBan = await self.getBotBan(database, guildId);
            if (serverBan) {
                return { banned: true, reason: serverBan.reason, type: 'server' };
            }
        }

        return { banned: false };
    },

    // ==================== DM Inbox Functions ====================

    /**
     * Save a DM to the inbox
     * @param {Database} database
     * @param {String} usrId
     * @param {String} userTag
     * @param {String} content
     * @param {Array} attachments - Array of attachment URLs
     * @async
     * @return {number} The inserted row ID
     */
    "saveDm": async function(database, usrId, userTag, content, attachments) {
        const attachmentsJson = JSON.stringify(attachments || []);
        const result = await database.runPromise(
            "INSERT INTO dmInbox(usrId, userTag, content, attachments, timestamp, replied) VALUES(?, ?, ?, ?, ?, 0)",
            [usrId, userTag, content, attachmentsJson, Date.now()]
        );
        return result.lastID;
    },

    /**
     * Get inbox messages
     * @param {Database} database
     * @param {number} limit - Max messages to return
     * @param {number} offset - Offset for pagination
     * @async
     * @return {Array}
     */
    "getInbox": async function(database, limit = 20, offset = 0) {
        const result = await database.allPromise(
            "SELECT id, usrId, userTag, content, attachments, timestamp, replied FROM dmInbox ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );

        return result.map(row => ({
            id: row.id,
            usrId: row.usrId,
            userTag: row.userTag,
            content: row.content,
            attachments: JSON.parse(row.attachments || '[]'),
            timestamp: row.timestamp,
            replied: row.replied === 1
        }));
    },

    /**
     * Get inbox messages from a specific user
     * @param {Database} database
     * @param {String} usrId
     * @param {number} limit
     * @async
     * @return {Array}
     */
    "getInboxByUser": async function(database, usrId, limit = 20) {
        const result = await database.allPromise(
            "SELECT id, usrId, userTag, content, attachments, timestamp, replied FROM dmInbox WHERE usrId = ? ORDER BY timestamp DESC LIMIT ?",
            [usrId, limit]
        );

        return result.map(row => ({
            id: row.id,
            usrId: row.usrId,
            userTag: row.userTag,
            content: row.content,
            attachments: JSON.parse(row.attachments || '[]'),
            timestamp: row.timestamp,
            replied: row.replied === 1
        }));
    },

    /**
     * Get a specific inbox message by ID
     * @param {Database} database
     * @param {number} id
     * @async
     * @return {Object|null}
     */
    "getInboxMessage": async function(database, id) {
        const result = await database.allPromise(
            "SELECT id, usrId, userTag, content, attachments, timestamp, replied FROM dmInbox WHERE id = ?",
            [id]
        );

        if (result.length === 0) return null;

        return {
            id: result[0].id,
            usrId: result[0].usrId,
            userTag: result[0].userTag,
            content: result[0].content,
            attachments: JSON.parse(result[0].attachments || '[]'),
            timestamp: result[0].timestamp,
            replied: result[0].replied === 1
        };
    },

    /**
     * Mark a DM as replied
     * @param {Database} database
     * @param {number} id
     * @async
     */
    "markDmReplied": async function(database, id) {
        await database.runPromise(
            "UPDATE dmInbox SET replied = 1 WHERE id = ?",
            [id]
        );
    },

    /**
     * Clear old DMs (cleanup)
     * @param {Database} database
     * @param {number} days - Delete DMs older than this many days
     * @async
     * @return {number} Number of deleted rows
     */
    "clearOldDms": async function(database, days = 30) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const result = await database.runPromise(
            "DELETE FROM dmInbox WHERE timestamp < ?",
            [cutoff]
        );
        return result.changes || 0;
    },

    /**
     * Get count of unread (unreplied) DMs
     * @param {Database} database
     * @async
     * @return {number}
     */
    "getUnreadDmCount": async function(database) {
        const result = await database.allPromise(
            "SELECT COUNT(*) as count FROM dmInbox WHERE replied = 0"
        );
        return result[0]?.count || 0;
    }
}

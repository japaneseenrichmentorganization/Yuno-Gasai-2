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
const { Guild, EmbedBuilder } = require("discord.js");

let intervalManager = null;

// Locking mechanism to prevent concurrent cleans of the same channel
const cleaningLocks = new Set();

module.exports.modulename = "auto-cleaner";

// Factory function to create clean handler - avoids .bind() in loop
const createCleanHandler = (Yuno, el, g) => async () => {
    // Check if bot is connected before proceeding
    if (!Yuno.dC.isReady()) {
        Yuno.prompt.log("[AutoClean] Skipping - bot not connected");
        return;
    }

    const actualClean = await Yuno.dbCommands.getClean(Yuno.database, el.guildId, el.channelName);
    if (actualClean === null) return;

    const channelNameLower = el.channelName?.toLowerCase();
    if (!channelNameLower) {
        Yuno.prompt.error("[AutoClean] Invalid channel name configuration");
        return;
    }

    const ch = g.channels.cache.find((c) => c.name?.toLowerCase() === channelNameLower);
    if (!ch || !ch.isTextBased()) {
        Yuno.dbCommands.delClean(Yuno.database, el.guildId, el.channelName);
        Yuno.prompt.error(`[AutoClean] Cannot clean channel: channel doesn't exist! Guild: ${g?.name ?? 'Unknown'}; Channel: ${el.channelName}`);
        return;
    }

    if (actualClean.remainingTime === actualClean.timeBeforeClean) {
        ch.send({
            embeds: [new EmbedBuilder()
                .setAuthor({ name: `Yuno is going to clean this channel in ${actualClean.timeBeforeClean} minutes. Speak now or forever hold your peace.` })]
        });
    }

    if (actualClean.remainingTime <= 0) {
        const lockKey = `${el.guildId}-${el.channelName}`;

        // Check if already cleaning this channel
        if (cleaningLocks.has(lockKey)) {
            Yuno.prompt.log(`[AutoClean] Channel ${el.channelName} already being cleaned, skipping`);
            return;
        }

        // Acquire lock
        cleaningLocks.add(lockKey);

        try {
            // Double-check connection before expensive operation
            if (!Yuno.dC.isReady()) {
                Yuno.prompt.log("[AutoClean] Aborting clean - bot disconnected");
                return;
            }

            // Clone the channel (this creates the new channel)
            const newChannel = await Yuno.UTIL.clean(ch);

            // CRITICAL: Update database IMMEDIATELY after clone succeeds
            actualClean.remainingTime = actualClean.timeFEachClean * 60;
            await Yuno.dbCommands.setClean(
                Yuno.database,
                actualClean.guildId,
                el.channelName,
                actualClean.timeFEachClean,
                actualClean.timeBeforeClean,
                actualClean.remainingTime
            );

            // Send success message (non-critical)
            try {
                await newChannel.send({
                    embeds: [new EmbedBuilder()
                        .setImage("https://vignette3.wikia.nocookie.net/futurediary/images/9/94/Mirai_Nikki_-_06_-_Large_05.jpg")
                        .setAuthor({ name: "Auto-clean: Yuno is done cleaning.", iconURL: Yuno.dC.user.avatarURL() })
                        .setColor("#ff51ff")]
                });
            } catch (msgErr) {
                Yuno.prompt.error(`[AutoClean] Warning: Failed to send clean message: ${msgErr.message}`);
            }

            Yuno.prompt.log(`[AutoClean] Successfully cleaned channel: ${el.channelName}`);
        } catch (cleanErr) {
            Yuno.prompt.error(`[AutoClean] Failed to clean channel ${el.channelName}: ${cleanErr.message}`);
            // Don't update remaining time - will retry next minute
        } finally {
            // Always release lock
            cleaningLocks.delete(lockKey);
        }
    } else {
        actualClean.remainingTime -= 1;
        await Yuno.dbCommands.setClean(
            Yuno.database,
            actualClean.guildId,
            el.channelName,
            actualClean.timeFEachClean,
            actualClean.timeBeforeClean,
            actualClean.remainingTime
        );
    }
};

const setupCleaners = async (Yuno) => {
    const cleans = await Yuno.dbCommands.getCleans(Yuno.database);

    for (const el of cleans) {
        const g = Yuno.dC.guilds.cache.get(el.guildId);

        if (!(g instanceof Guild)) {
            Yuno.prompt.error(`Cannot (auto-)clean a channel: guild doesn't exist! GuildId: ${el.guildId}`);
            continue;
        }

        const intervalId = `autocleaner-clean-${el.guildId}-${el.channelName}`;

        if (!intervalManager._has(intervalId)) {
            // Use factory function instead of .bind() in loop
            const handler = createCleanHandler(Yuno, el, g);
            intervalManager.setInterval(intervalId, handler, 60 * 1000);
        }
    }
};

module.exports.configLoaded = function() {};

module.exports.init = function(Yuno, hotreloaded) {
    intervalManager = Yuno.intervalMan;

    if (hotreloaded) {
        setupCleaners(Yuno);
    } else {
        // Use arrow function instead of .bind()
        Yuno.on("discord-connected", () => setupCleaners(Yuno));
    }
};

module.exports.beforeShutdown = function(Yuno) {
    // Clear all autocleaner intervals on shutdown/hot-reload
    if (intervalManager) {
        const intervals = Object.keys(intervalManager.intervals);
        for (const id of intervals) {
            if (id.startsWith("autocleaner-clean-")) {
                intervalManager.clear(id);
            }
        }
    }
};

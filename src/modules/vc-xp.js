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

module.exports.modulename = "vc-xp";

let DISCORD_EVENTED = false,
    discClient = null,
    yunoInstance = null,
    voiceStateHandler = null,
    xpTickInterval = null;

/**
 * Calculate XP needed for next level
 * Uses same formula as message XP: 5 * level^2 + 50 * level + 100
 */
function calculateNeededXP(level) {
    return 5 * Math.pow(level, 2) + 50 * level + 100;
}

/**
 * Grant XP to a user and handle level ups
 * Integrates with the main XP system in experiences table
 */
async function grantXP(guildId, oderId, xpAmount) {
    try {
        const dbCommands = yunoInstance.dbCommands;
        const db = yunoInstance.database;

        // Get current XP data
        let xpData = await dbCommands.getXPData(db, guildId, oderId);
        let neededXP = calculateNeededXP(xpData.level);

        xpData.xp += xpAmount;

        // Handle level ups (possibly multiple)
        while (xpData.xp >= neededXP) {
            xpData.level += 1;
            xpData.xp -= neededXP;
            neededXP = calculateNeededXP(xpData.level);

            // Try to assign level role if configured
            await assignLevelRole(guildId, oderId, xpData.level);
        }

        // Save updated XP
        await dbCommands.setXPData(db, guildId, oderId, xpData.xp, xpData.level);

        return xpData;
    } catch (e) {
        console.error("Error granting VC XP:", e);
        return null;
    }
}

/**
 * Assign level role to a user if configured
 */
async function assignLevelRole(guildId, oderId, level) {
    try {
        const dbCommands = yunoInstance.dbCommands;
        const db = yunoInstance.database;

        const rolemap = await dbCommands.getLevelRoleMap(db, guildId);
        if (!rolemap || !rolemap[level]) return;

        const guild = discClient.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(oderId) || await guild.members.fetch(oderId);
        if (!member) return;

        const role = guild.roles.cache.get(rolemap[level]);
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }
    } catch (e) {
        // Silently fail if we can't assign role
    }
}

/**
 * Check if a user is in an AFK channel
 */
function isInAfkChannel(voiceState, ignoreAfk) {
    if (!ignoreAfk) return false;
    if (!voiceState.channel) return false;

    const guild = voiceState.guild;
    return guild.afkChannelId && voiceState.channelId === guild.afkChannelId;
}

/**
 * Voice state update handler - tracks VC sessions
 */
async function onVoiceStateUpdate(oldState, newState) {
    if (!newState.guild) return;
    const guildId = newState.guild.id;
    const oderId = newState.member?.id;
    if (!oderId) return;

    // Ignore bots
    if (newState.member.user.bot) return;

    const dbCommands = yunoInstance.dbCommands;
    const db = yunoInstance.database;

    // Check if VC XP is enabled for this guild
    const config = await dbCommands.getVcXpConfig(db, guildId);
    if (!config.enabled) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // Join VC
    if (!oldChannel && newChannel) {
        // Don't start session if joining AFK channel
        if (!isInAfkChannel(newState, config.ignoreAfkChannel)) {
            await dbCommands.startVcSession(db, guildId, oderId, newChannel.id);
        }
    }
    // Leave VC
    else if (oldChannel && !newChannel) {
        // End session and grant XP based on time spent
        const session = await dbCommands.endVcSession(db, guildId, oderId);
        if (session) {
            const now = Date.now();
            const timeSinceLastGrant = now - session.lastXpGrant;
            const intervalsEarned = Math.floor(timeSinceLastGrant / (config.intervalSeconds * 1000));

            if (intervalsEarned > 0) {
                const xpToGrant = intervalsEarned * config.xpPerInterval;
                await grantXP(guildId, oderId, xpToGrant);
            }
        }
    }
    // Move between channels
    else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
        const wasInAfk = isInAfkChannel(oldState, config.ignoreAfkChannel);
        const nowInAfk = isInAfkChannel(newState, config.ignoreAfkChannel);

        if (wasInAfk && !nowInAfk) {
            // Moved from AFK to regular channel - start new session
            await dbCommands.startVcSession(db, guildId, oderId, newChannel.id);
        } else if (!wasInAfk && nowInAfk) {
            // Moved to AFK channel - end session and grant XP
            const session = await dbCommands.endVcSession(db, guildId, oderId);
            if (session) {
                const now = Date.now();
                const timeSinceLastGrant = now - session.lastXpGrant;
                const intervalsEarned = Math.floor(timeSinceLastGrant / (config.intervalSeconds * 1000));

                if (intervalsEarned > 0) {
                    const xpToGrant = intervalsEarned * config.xpPerInterval;
                    await grantXP(guildId, oderId, xpToGrant);
                }
            }
        } else if (!nowInAfk) {
            // Regular move - just update channel
            await dbCommands.updateVcSessionChannel(db, guildId, oderId, newChannel.id);
        }
    }
}

/**
 * Periodic XP tick - grants XP to users in VC at regular intervals
 * This ensures users get XP even during long sessions
 */
async function xpTick() {
    try {
        const dbCommands = yunoInstance.dbCommands;
        const db = yunoInstance.database;

        // Process each guild
        for (const guild of discClient.guilds.cache.values()) {
            const config = await dbCommands.getVcXpConfig(db, guild.id);
            if (!config.enabled) continue;

            const sessions = await dbCommands.getGuildVcSessions(db, guild.id);
            const now = Date.now();

            for (const session of sessions) {
                const timeSinceLastGrant = now - session.lastXpGrant;
                const intervalsEarned = Math.floor(timeSinceLastGrant / (config.intervalSeconds * 1000));

                if (intervalsEarned > 0) {
                    // Check if user is still in VC and not in AFK channel
                    const member = guild.members.cache.get(session.oderId);
                    if (member && member.voice.channel) {
                        const isAfk = config.ignoreAfkChannel &&
                            guild.afkChannelId &&
                            member.voice.channelId === guild.afkChannelId;

                        if (!isAfk) {
                            const xpToGrant = intervalsEarned * config.xpPerInterval;
                            await grantXP(guild.id, session.oderId, xpToGrant);

                            // Update last XP grant time
                            const newLastGrant = session.lastXpGrant + (intervalsEarned * config.intervalSeconds * 1000);
                            await dbCommands.updateVcSessionXpTime(db, guild.id, session.oderId, newLastGrant);
                        }
                    } else {
                        // User no longer in VC - clean up stale session
                        await dbCommands.endVcSession(db, guild.id, session.oderId);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error in VC XP tick:", e);
    }
}

/**
 * Recover existing VC sessions on bot startup
 * Creates sessions for users already in voice channels
 */
async function recoverSessions() {
    try {
        const dbCommands = yunoInstance.dbCommands;
        const db = yunoInstance.database;

        // Clear stale sessions first
        await dbCommands.clearAllVcSessions(db);

        // Create sessions for users currently in voice
        for (const guild of discClient.guilds.cache.values()) {
            const config = await dbCommands.getVcXpConfig(db, guild.id);
            if (!config.enabled) continue;

            for (const voiceState of guild.voiceStates.cache.values()) {
                if (!voiceState.channel) continue;
                if (voiceState.member?.user.bot) continue;

                // Skip if in AFK channel
                if (config.ignoreAfkChannel && guild.afkChannelId && voiceState.channelId === guild.afkChannelId) {
                    continue;
                }

                await dbCommands.startVcSession(db, guild.id, voiceState.member.id, voiceState.channelId);
            }
        }
    } catch (e) {
        console.error("Error recovering VC sessions:", e);
    }
}

let discordConnected = async function(Yuno) {
    discClient = Yuno.dC;
    yunoInstance = Yuno;

    if (!DISCORD_EVENTED) {
        voiceStateHandler = onVoiceStateUpdate;
        discClient.on("voiceStateUpdate", voiceStateHandler);

        // Start XP tick interval (every 60 seconds)
        xpTickInterval = setInterval(xpTick, 60 * 1000);
    }

    DISCORD_EVENTED = true;

    // Recover sessions for users already in VC
    await recoverSessions();
};

module.exports.init = async function(Yuno, hotReloaded) {
    if (hotReloaded)
        await discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected);
};

module.exports.configLoaded = function() {};

module.exports.beforeShutdown = async function(Yuno) {
    if (discClient && voiceStateHandler) {
        discClient.removeListener("voiceStateUpdate", voiceStateHandler);
    }

    if (xpTickInterval) {
        clearInterval(xpTickInterval);
        xpTickInterval = null;
    }

    // Grant remaining XP to all users currently in VC before shutdown
    try {
        const dbCommands = Yuno.dbCommands;
        const db = Yuno.database;

        for (const guild of discClient.guilds.cache.values()) {
            const config = await dbCommands.getVcXpConfig(db, guild.id);
            if (!config.enabled) continue;

            const sessions = await dbCommands.getGuildVcSessions(db, guild.id);
            const now = Date.now();

            for (const session of sessions) {
                const timeSinceLastGrant = now - session.lastXpGrant;
                const intervalsEarned = Math.floor(timeSinceLastGrant / (config.intervalSeconds * 1000));

                if (intervalsEarned > 0) {
                    const xpToGrant = intervalsEarned * config.xpPerInterval;
                    await grantXP(guild.id, session.oderId, xpToGrant);
                }
            }
        }

        // Clear all sessions
        await dbCommands.clearAllVcSessions(db);
    } catch (e) {
        console.error("Error during VC XP shutdown:", e);
    }

    DISCORD_EVENTED = false;
    voiceStateHandler = null;
};

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

module.exports.modulename = "activity-logger";

const { EmbedBuilder } = require("discord.js");

let DISCORD_EVENTED = false,
    discClient = null,
    yunoInstance = null,
    voiceStateHandler = null,
    guildMemberUpdateHandler = null,
    userUpdateHandler = null,
    presenceUpdateHandler = null,
    flushInterval = null;

// Buffer for collecting log entries before sending
// Structure: Map<guildId, Map<logType, Array<logEntry>>>
const logBuffer = new Map();

// Track rate limit state per channel
const rateLimitState = new Map();

// Cache for guild log settings
const settingsCache = new Map();
const SETTINGS_CACHE_TTL = 60000; // 1 minute cache

// Default configuration (respects Discord API limits)
const DEFAULT_FLUSH_INTERVAL = 30;  // seconds
const DEFAULT_MAX_BUFFER_SIZE = 50;
const MIN_FLUSH_INTERVAL = 10;      // minimum 10 seconds (API safety)
const MAX_FLUSH_INTERVAL = 300;     // maximum 5 minutes
const MIN_BUFFER_SIZE = 10;
const MAX_BUFFER_SIZE = 100;

// Global flush check interval (checks all guilds)
const GLOBAL_CHECK_INTERVAL = 5000; // Check every 5 seconds

// Track last flush time per guild
const lastFlushTime = new Map();

// === LOW MEMORY MODE (for Pi/embedded systems) ===
// Enable via config: "activityLogger.lowMemoryMode": true
let lowMemoryMode = false;
const LOW_MEM_HARD_BUFFER_LIMIT = 200;      // Max entries per log type per guild
const LOW_MEM_HARD_TOTAL_LIMIT = 2000;      // Max total entries across all guilds
const LOW_MEM_STALE_TIMEOUT = 300000;       // 5 min - remove inactive guild buffers
const LOW_MEM_CHECK_INTERVAL = 60000;       // Check memory every 60 seconds

// Track last activity time per guild (for stale cleanup in low-memory mode)
const lastActivityTime = new Map();

// Memory monitoring interval
let memoryCheckInterval = null;

/**
 * Get total buffer entry count across all guilds
 */
function getTotalBufferCount() {
    let total = 0;
    for (const guildBuffer of logBuffer.values()) {
        for (const entries of guildBuffer.values()) {
            total += entries.length;
        }
    }
    return total;
}

/**
 * Emergency flush - drops oldest entries when limits exceeded
 */
function emergencyTrim(guildId, logType, maxEntries) {
    const guildBuffer = logBuffer.get(guildId);
    if (!guildBuffer) return;

    const entries = guildBuffer.get(logType);
    if (!entries || entries.length <= maxEntries) return;

    // Keep only the most recent entries
    const dropped = entries.length - maxEntries;
    guildBuffer.set(logType, entries.slice(dropped));

    if (yunoInstance?.prompt) {
        yunoInstance.prompt.warning(`[activity-logger] Dropped ${dropped} old ${logType} entries for guild ${guildId} (low-memory mode)`);
    }
}

/**
 * Cleanup stale guild buffers (low-memory mode only)
 */
function cleanupStaleBuffers() {
    if (!lowMemoryMode) return;

    const now = Date.now();
    const staleGuilds = [];

    for (const [guildId, lastTime] of lastActivityTime.entries()) {
        if (now - lastTime > LOW_MEM_STALE_TIMEOUT) {
            staleGuilds.push(guildId);
        }
    }

    for (const guildId of staleGuilds) {
        logBuffer.delete(guildId);
        lastActivityTime.delete(guildId);
        lastFlushTime.delete(guildId);
        settingsCache.delete(guildId);
    }

    if (staleGuilds.length > 0 && yunoInstance?.prompt) {
        yunoInstance.prompt.info(`[activity-logger] Cleaned up ${staleGuilds.length} stale guild buffers`);
    }
}

/**
 * Memory check for low-memory mode
 */
function lowMemoryCheck() {
    if (!lowMemoryMode) return;

    const totalCount = getTotalBufferCount();

    // If over total limit, force flush everything
    if (totalCount > LOW_MEM_HARD_TOTAL_LIMIT) {
        if (yunoInstance?.prompt) {
            yunoInstance.prompt.warning(`[activity-logger] Buffer limit exceeded (${totalCount}/${LOW_MEM_HARD_TOTAL_LIMIT}), forcing flush`);
        }
        forceFlushAllLogs();
    }

    // Cleanup stale buffers
    cleanupStaleBuffers();
}

// Embed colors
const COLORS = {
    voiceJoin: 0x00ff00,      // green
    voiceLeave: 0xff0000,     // red
    voiceMove: 0xffff00,      // yellow
    nickname: 0x0099ff,       // blue
    avatar: 0x9900ff,         // purple
    presenceOnline: 0x43b581, // green
    presenceIdle: 0xfaa61a,   // orange
    presenceDnd: 0xf04747,    // red
    presenceOffline: 0x747f8d // gray
};

const PRESENCE_COLORS = {
    online: COLORS.presenceOnline,
    idle: COLORS.presenceIdle,
    dnd: COLORS.presenceDnd,
    offline: COLORS.presenceOffline
};

const STATUS_EMOJIS = {
    online: "🟢",
    idle: "🟡",
    dnd: "🔴",
    offline: "⚫"
};

/**
 * Get log settings for a guild (with caching)
 */
async function getGuildSettings(guildId) {
    const cached = settingsCache.get(guildId);
    if (cached && Date.now() - cached.time < SETTINGS_CACHE_TTL) {
        return cached.settings;
    }

    try {
        const settings = await yunoInstance.dbCommands.getLogSettings(yunoInstance.database, guildId);
        settingsCache.set(guildId, { settings, time: Date.now() });
        return settings;
    } catch (e) {
        return { flushInterval: DEFAULT_FLUSH_INTERVAL, maxBufferSize: DEFAULT_MAX_BUFFER_SIZE };
    }
}

/**
 * Invalidate settings cache for a guild
 */
function invalidateSettingsCache(guildId) {
    settingsCache.delete(guildId);
}

/**
 * Get the appropriate log channel for a guild and log type
 */
async function getLogChannel(guildId, logType) {
    try {
        const logChannels = await yunoInstance.dbCommands.getLogChannels(yunoInstance.database, guildId);

        if (logChannels[logType] && logChannels[logType].enabled && logChannels[logType].channelId) {
            return logChannels[logType].channelId;
        }

        if (logChannels.unified && logChannels.unified.enabled && logChannels.unified.channelId) {
            return logChannels.unified.channelId;
        }

        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Add a log entry to the buffer
 */
async function bufferLog(guildId, logType, entry) {
    if (!logBuffer.has(guildId)) {
        logBuffer.set(guildId, new Map());
    }

    const guildBuffer = logBuffer.get(guildId);
    if (!guildBuffer.has(logType)) {
        guildBuffer.set(logType, []);
    }

    guildBuffer.get(logType).push({
        ...entry,
        timestamp: Date.now()
    });

    // Track activity time for stale cleanup (low-memory mode)
    if (lowMemoryMode) {
        lastActivityTime.set(guildId, Date.now());

        // Enforce hard limits in low-memory mode
        emergencyTrim(guildId, logType, LOW_MEM_HARD_BUFFER_LIMIT);
    }

    // Get guild-specific max buffer size
    const settings = await getGuildSettings(guildId);
    const maxSize = settings.maxBufferSize || DEFAULT_MAX_BUFFER_SIZE;

    // Force flush if buffer is getting too large
    if (guildBuffer.get(logType).length >= maxSize) {
        await flushGuildLogType(guildId, logType);
    }
}

/**
 * Create a compact summary embed for multiple voice events
 */
function createVoiceSummaryEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle("Voice Activity Summary")
        .setColor(0x7289da)
        .setTimestamp();

    const joins = entries.filter(e => e.action === "join");
    const leaves = entries.filter(e => e.action === "leave");
    const moves = entries.filter(e => e.action === "move");

    let description = "";

    if (joins.length > 0) {
        description += "**Joined:**\n";
        description += joins.map(e => `🟢 ${e.userName} → ${e.channel}`).join("\n");
        description += "\n\n";
    }

    if (leaves.length > 0) {
        description += "**Left:**\n";
        description += leaves.map(e => `🔴 ${e.userName} ← ${e.channel}`).join("\n");
        description += "\n\n";
    }

    if (moves.length > 0) {
        description += "**Moved:**\n";
        description += moves.map(e => `🟡 ${e.userName}: ${e.fromChannel} → ${e.toChannel}`).join("\n");
    }

    embed.setDescription(description.trim() || "No activity");
    embed.setFooter({ text: `${entries.length} events` });

    return embed;
}

/**
 * Create a compact summary embed for nickname changes
 */
function createNicknameSummaryEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle("Nickname Changes")
        .setColor(COLORS.nickname)
        .setTimestamp();

    const description = entries.map(e =>
        `**${e.userTag}**\n\`${e.oldNick || "None"}\` → \`${e.newNick || "None"}\``
    ).join("\n\n");

    embed.setDescription(description || "No changes");
    embed.setFooter({ text: `${entries.length} changes` });

    return embed;
}

/**
 * Create a compact summary embed for presence changes
 */
function createPresenceSummaryEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle("Status Changes")
        .setColor(0x7289da)
        .setTimestamp();

    // Group by status transition type
    const grouped = {};
    for (const e of entries) {
        const key = `${e.oldStatus}_${e.newStatus}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
    }

    let description = "";
    for (const [transition, users] of Object.entries(grouped)) {
        const [oldS, newS] = transition.split("_");
        const emoji = STATUS_EMOJIS[newS] || "⚪";
        const names = users.map(u => u.userName).join(", ");
        description += `${emoji} **${oldS} → ${newS}:** ${names}\n`;
    }

    embed.setDescription(description.trim() || "No changes");
    embed.setFooter({ text: `${entries.length} changes` });

    return embed;
}

/**
 * Create a compact summary embed for avatar changes
 */
function createAvatarSummaryEmbed(entries) {
    const embed = new EmbedBuilder()
        .setTitle("Avatar Changes")
        .setColor(COLORS.avatar)
        .setTimestamp();

    const description = entries.map(e => `• **${e.userTag}** changed their avatar`).join("\n");

    embed.setDescription(description || "No changes");
    embed.setFooter({ text: `${entries.length} changes` });

    // Show most recent avatar as thumbnail if available
    if (entries.length > 0 && entries[entries.length - 1].newAvatar) {
        embed.setThumbnail(entries[entries.length - 1].newAvatar);
    }

    return embed;
}

/**
 * Flush logs for a specific guild and log type
 */
async function flushGuildLogType(guildId, logType) {
    const guildBuffer = logBuffer.get(guildId);
    if (!guildBuffer) return;

    const entries = guildBuffer.get(logType);
    if (!entries || entries.length === 0) return;

    // Clear the buffer first
    guildBuffer.set(logType, []);

    const channelId = await getLogChannel(guildId, logType);
    if (!channelId) return;

    // Check rate limit
    const rateLimit = rateLimitState.get(channelId);
    if (rateLimit && Date.now() < rateLimit.retryAfter) {
        // Put entries back in buffer to try later
        const currentBuffer = guildBuffer.get(logType) || [];
        guildBuffer.set(logType, [...entries, ...currentBuffer]);
        return;
    }

    const guild = discClient.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    try {
        let embed;

        switch (logType) {
            case "voice":
                embed = createVoiceSummaryEmbed(entries);
                break;
            case "nickname":
                embed = createNicknameSummaryEmbed(entries);
                break;
            case "presence":
                embed = createPresenceSummaryEmbed(entries);
                break;
            case "avatar":
                embed = createAvatarSummaryEmbed(entries);
                break;
            default:
                return;
        }

        await channel.send({ embeds: [embed] });
        rateLimitState.delete(channelId);

    } catch (e) {
        if (e.status === 429 || e.code === 429 || e.message?.includes("rate limit")) {
            const retryAfter = e.retryAfter || e.retry_after || 10000;
            rateLimitState.set(channelId, {
                retryAfter: Date.now() + retryAfter
            });
            // Put entries back
            const currentBuffer = guildBuffer.get(logType) || [];
            guildBuffer.set(logType, [...entries, ...currentBuffer]);
        }
        // Other errors: messages are dropped
    }
}

/**
 * Flush all buffered logs (respects per-guild intervals)
 */
async function flushAllLogs() {
    const now = Date.now();

    for (const [guildId, guildBuffer] of logBuffer.entries()) {
        // Get guild-specific flush interval
        const settings = await getGuildSettings(guildId);
        const flushIntervalMs = (settings.flushInterval || DEFAULT_FLUSH_INTERVAL) * 1000;

        // Check if enough time has passed since last flush for this guild
        const lastFlush = lastFlushTime.get(guildId) || 0;
        if (now - lastFlush < flushIntervalMs) {
            continue; // Not time to flush this guild yet
        }

        // Flush all log types for this guild
        let hasFlushed = false;
        for (const logType of guildBuffer.keys()) {
            const entries = guildBuffer.get(logType);
            if (entries && entries.length > 0) {
                await flushGuildLogType(guildId, logType);
                hasFlushed = true;
            }
        }

        if (hasFlushed) {
            lastFlushTime.set(guildId, now);
        }
    }
}

/**
 * Force flush all logs immediately (for shutdown)
 */
async function forceFlushAllLogs() {
    for (const [guildId, guildBuffer] of logBuffer.entries()) {
        for (const logType of guildBuffer.keys()) {
            await flushGuildLogType(guildId, logType);
        }
    }
}

/**
 * Voice state update handler
 */
async function onVoiceStateUpdate(oldState, newState) {
    if (!newState.guild) return;
    const guildId = newState.guild.id;
    const member = newState.member;
    if (!member || member.user.bot) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // Join
    if (!oldChannel && newChannel) {
        bufferLog(guildId, "voice", {
            action: "join",
            oderId: member.id,
            userName: member.displayName,
            channel: newChannel.name
        });
    }
    // Leave
    else if (oldChannel && !newChannel) {
        bufferLog(guildId, "voice", {
            action: "leave",
            oderId: member.id,
            userName: member.displayName,
            channel: oldChannel.name
        });
    }
    // Move
    else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
        bufferLog(guildId, "voice", {
            action: "move",
            oderId: member.id,
            userName: member.displayName,
            fromChannel: oldChannel.name,
            toChannel: newChannel.name
        });
    }
}

/**
 * Guild member update handler - logs nickname changes
 */
async function onGuildMemberUpdate(oldMember, newMember) {
    if (!newMember.guild || newMember.user.bot) return;

    if (oldMember.nickname !== newMember.nickname) {
        bufferLog(newMember.guild.id, "nickname", {
            oderId: newMember.id,
            userTag: newMember.user.tag,
            oldNick: oldMember.nickname,
            newNick: newMember.nickname
        });
    }
}

/**
 * User update handler - logs avatar changes
 */
async function onUserUpdate(oldUser, newUser) {
    if (newUser.bot) return;

    if (oldUser.avatar !== newUser.avatar) {
        // Buffer for all guilds where user is a member
        for (const guild of discClient.guilds.cache.values()) {
            if (guild.members.cache.has(newUser.id)) {
                bufferLog(guild.id, "avatar", {
                    oderId: newUser.id,
                    userTag: newUser.tag,
                    oldAvatar: oldUser.avatar ? oldUser.displayAvatarURL({ size: 128 }) : null,
                    newAvatar: newUser.displayAvatarURL({ size: 256 })
                });
            }
        }
    }
}

/**
 * Presence update handler
 */
async function onPresenceUpdate(oldPresence, newPresence) {
    if (!newPresence || !newPresence.guild) return;

    const member = newPresence.member;
    if (!member || member.user.bot) return;

    const oldStatus = oldPresence?.status || "offline";
    const newStatus = newPresence.status || "offline";

    if (oldStatus === newStatus) return;

    bufferLog(newPresence.guild.id, "presence", {
        oderId: member.id,
        userName: member.displayName,
        oldStatus,
        newStatus
    });
}

let discordConnected = async function(Yuno) {
    discClient = Yuno.dC;
    yunoInstance = Yuno;

    if (!DISCORD_EVENTED) {
        voiceStateHandler = onVoiceStateUpdate;
        guildMemberUpdateHandler = onGuildMemberUpdate;
        userUpdateHandler = onUserUpdate;
        presenceUpdateHandler = onPresenceUpdate;

        discClient.on("voiceStateUpdate", voiceStateHandler);
        discClient.on("guildMemberUpdate", guildMemberUpdateHandler);
        discClient.on("userUpdate", userUpdateHandler);
        discClient.on("presenceUpdate", presenceUpdateHandler);

        // Start global flush check interval (checks per-guild intervals)
        flushInterval = setInterval(flushAllLogs, GLOBAL_CHECK_INTERVAL);
    }

    DISCORD_EVENTED = true;
};

module.exports.init = async function(Yuno, hotReloaded) {
    if (hotReloaded)
        await discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected);
};

module.exports.configLoaded = function(Yuno, config) {
    // Check for low-memory mode setting
    const newLowMemoryMode = config.get("activityLogger.lowMemoryMode") === true;

    if (newLowMemoryMode !== lowMemoryMode) {
        lowMemoryMode = newLowMemoryMode;

        if (lowMemoryMode) {
            Yuno.prompt.info("[activity-logger] Low-memory mode ENABLED (for Pi/embedded systems)");

            // Start memory check interval if not already running
            if (!memoryCheckInterval) {
                memoryCheckInterval = setInterval(lowMemoryCheck, LOW_MEM_CHECK_INTERVAL);
            }
        } else {
            Yuno.prompt.info("[activity-logger] Low-memory mode disabled");

            // Stop memory check interval
            if (memoryCheckInterval) {
                clearInterval(memoryCheckInterval);
                memoryCheckInterval = null;
            }

            // Clear low-memory tracking data
            lastActivityTime.clear();
        }
    }
};

module.exports.beforeShutdown = async function(Yuno) {
    // Stop flush interval
    if (flushInterval) {
        clearInterval(flushInterval);
        flushInterval = null;
    }

    // Stop memory check interval (low-memory mode)
    if (memoryCheckInterval) {
        clearInterval(memoryCheckInterval);
        memoryCheckInterval = null;
    }

    // Force flush remaining logs before shutdown
    await forceFlushAllLogs();

    // Clear buffers and caches
    logBuffer.clear();
    rateLimitState.clear();
    settingsCache.clear();
    lastFlushTime.clear();
    lastActivityTime.clear();

    if (discClient) {
        if (voiceStateHandler) {
            discClient.removeListener("voiceStateUpdate", voiceStateHandler);
        }
        if (guildMemberUpdateHandler) {
            discClient.removeListener("guildMemberUpdate", guildMemberUpdateHandler);
        }
        if (userUpdateHandler) {
            discClient.removeListener("userUpdate", userUpdateHandler);
        }
        if (presenceUpdateHandler) {
            discClient.removeListener("presenceUpdate", presenceUpdateHandler);
        }
    }

    DISCORD_EVENTED = false;
    voiceStateHandler = null;
    guildMemberUpdateHandler = null;
    userUpdateHandler = null;
    presenceUpdateHandler = null;
};

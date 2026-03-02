const { PermissionsBitField } = require("discord.js");

/**
 * Ensures msg.member and the bot's own GuildMember are cached.
 * Mutates msg.member in-place if it was missing.
 * @param {import("discord.js").Message} msg
 * @param {import("discord.js").Client} client
 */
async function ensureMembersInCache(msg, client) {
    if (msg.guild && !msg.guild.members.cache.has(msg.author.id) && !msg.webhookId) {
        msg.member = await msg.guild.members.fetch(msg.author);
    }
    if (msg.guild && !msg.guild.members.cache.has(client.user.id)) {
        await msg.guild.members.fetch(client.user.id);
    }
}

/**
 * Parses the piped argument format "targets | reason" used by moderation commands.
 * @param {string} argsJoined - The full joined args string
 * @param {string} verb - e.g. "Banned", "Kicked", "Unbanned"
 * @param {string} authorTag - msg.author.tag
 * @returns {{ targets: string, reason: string }}
 */
function parseModArgs(argsJoined, verb, authorTag) {
    if (argsJoined.includes("|")) {
        const parts = argsJoined.split("|");
        return {
            targets: parts[0].trim(),
            reason: (parts[1].trim() + " / " + verb + " by " + authorTag).trim()
        };
    }
    return {
        targets: argsJoined.trim(),
        reason: verb + " by " + authorTag
    };
}

/**
 * Validates a Discord snowflake ID (17–19 digit numeric string).
 * @param {string} id
 * @returns {boolean}
 */
function isValidSnowflake(id) {
    return /^\d{17,19}$/.test(id);
}

/**
 * Fetches all banned user IDs from a guild using paginated API calls.
 * @param {import("discord.js").Guild} guild
 * @param {function} [onProgress] - Optional callback(totalFetched) for progress reporting
 * @returns {Promise<string[]>} Array of user IDs
 */
async function fetchAllBannedUserIds(guild, onProgress) {
    const allIds = [];
    let lastId = null;
    const batchSize = 1000;

    while (true) {
        const opts = { limit: batchSize };
        if (lastId) opts.after = lastId;
        const bans = await guild.bans.fetch(opts);
        if (bans.size === 0) break;

        const batchIds = Array.from(bans.values()).map(b => b.user.id);
        allIds.push(...batchIds);
        lastId = batchIds[batchIds.length - 1];

        if (onProgress) onProgress(allIds.length);
        if (bans.size < batchSize) break;
    }

    return allIds;
}

/**
 * Fetches all guild members and returns a filtered collection of non-bot members.
 * @param {import("discord.js").Guild} guild
 * @returns {Promise<import("discord.js").Collection<string, import("discord.js").GuildMember>>}
 */
async function fetchNonBotMembers(guild) {
    await guild.members.fetch();
    return guild.members.cache.filter(m => !m.user.bot);
}

/**
 * Resolves a target GuildMember from a mention, checking role hierarchy.
 * Falls back to msg.member if no valid mention or hierarchy check fails.
 * @param {import("discord.js").Message} msg
 * @param {object} yuno - Yuno instance (yuno.commandMan._isUserMaster)
 * @returns {import("discord.js").GuildMember}
 */
function resolveTargetMember(msg, yuno) {
    if (msg.mentions.users.size) {
        const target = msg.mentions.users.first();
        const targetMember = msg.guild.members.cache.get(target.id);
        if (targetMember && (yuno.commandMan._isUserMaster(msg.author.id) || msg.member.roles.highest.comparePositionTo(targetMember.roles.highest) > 0)) {
            return targetMember;
        }
    }
    return msg.member;
}

module.exports = {
    ensureMembersInCache,
    parseModArgs,
    isValidSnowflake,
    fetchAllBannedUserIds,
    fetchNonBotMembers,
    resolveTargetMember
};

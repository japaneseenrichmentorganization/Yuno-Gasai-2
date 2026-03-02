/**
 * Looks up a guild for a terminal command and checks bot permissions.
 * Logs errors to console and returns null on failure.
 * @param {object} yuno - Yuno instance (yuno.dC is the Discord client)
 * @param {string} serverId - Guild ID string
 * @param {string} [requiredPermission="BanMembers"] - Permission flag name
 * @returns {import("discord.js").Guild|null}
 */
function resolveGuildForTerminal(yuno, serverId, requiredPermission = "BanMembers") {
    if (!/^\d{17,19}$/.test(serverId)) {
        console.log("Error: Invalid server ID format.");
        return null;
    }
    const guild = yuno.dC.guilds.cache.get(serverId);
    if (!guild) {
        console.log(`Error: Server not found: ${serverId}`);
        console.log("Use 'servers' command to see available servers.");
        return null;
    }
    if (requiredPermission) {
        const botMember = guild.members.cache.get(yuno.dC.user.id);
        if (!botMember?.permissions.has(requiredPermission)) {
            console.log(`Error: Bot does not have ${requiredPermission} permission in this server.`);
            return null;
        }
    }
    return guild;
}

module.exports = { resolveGuildForTerminal };

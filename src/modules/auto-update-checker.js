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

"use strict";


const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

module.exports.modulename = "auto-update-checker";

let yuno = null,
    checkInterval = null,
    notifyDiscord = false,
    intervalHours = 6,
    errorChannel = null,
    errorGuild = null;

const SAFE_BRANCH_RE = /^[a-zA-Z0-9][a-zA-Z0-9\/_.-]*$/;

async function runGitCommand(args, cwd) {
    try {
        const { stdout, stderr } = await execFileAsync("git", args, { cwd, timeout: 60000 });
        return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (e) {
        return { success: false, error: e.message, stdout: e.stdout?.trim(), stderr: e.stderr?.trim() };
    }
}

/**
 * Check for updates from git remote
 */
async function checkForUpdates() {
    const cwd = process.cwd();

    const fetchResult = await runGitCommand(["fetch", "origin"], cwd);
    if (!fetchResult.success) {
        return { hasUpdates: false, error: `Failed to fetch: ${fetchResult.error}` };
    }

    const branchResult = await runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    if (!branchResult.success) {
        return { hasUpdates: false, error: `Failed to get branch: ${branchResult.error}` };
    }
    const branch = branchResult.stdout;

    if (!SAFE_BRANCH_RE.test(branch) || branch.includes("..")) {
        return { hasUpdates: false, error: "Unexpected branch name format" };
    }

    const localResult = await runGitCommand(["rev-parse", "HEAD"], cwd);
    const remoteResult = await runGitCommand(["rev-parse", `origin/${branch}`], cwd);

    if (!localResult.success || !remoteResult.success) {
        return { hasUpdates: false, error: "Failed to compare versions" };
    }

    const localCommit = localResult.stdout;
    const remoteCommit = remoteResult.stdout;

    if (localCommit === remoteCommit) {
        return { hasUpdates: false, branch, localCommit: localCommit.substring(0, 7) };
    }

    const countResult = await runGitCommand(["rev-list", `HEAD..origin/${branch}`, "--count"], cwd);
    const commitsBehind = parseInt(countResult.stdout, 10) || 0;

    const logResult = await runGitCommand(["log", `HEAD..origin/${branch}`, "--oneline", "--max-count=5"], cwd);

    return {
        hasUpdates: true,
        branch,
        localCommit: localCommit.substring(0, 7),
        remoteCommit: remoteCommit.substring(0, 7),
        commitsBehind,
        commits: logResult.stdout
    };
}

/**
 * Notify about available updates
 */
async function notifyUpdates(result) {
    if (result.error) {
        yuno.prompt.error(`Auto-update check failed: ${result.error}`);
        return;
    }

    if (!result.hasUpdates) {
        yuno.prompt.info(`Auto-update: Up to date (${result.branch}@${result.localCommit})`);
        return;
    }

    // Always log to console
    yuno.prompt.warning(`=== Updates Available ===`);
    yuno.prompt.warning(`Branch: ${result.branch}`);
    yuno.prompt.warning(`Local: ${result.localCommit} -> Remote: ${result.remoteCommit}`);
    yuno.prompt.warning(`Behind by: ${result.commitsBehind} commit(s)`);
    if (result.commits) {
        yuno.prompt.warning(`Recent changes:\n${result.commits}`);
    }
    yuno.prompt.warning(`Run 'auto-update full' to update and hot-reload.`);

    // Notify Discord if enabled
    if (notifyDiscord && errorChannel) {
        try {
            let message = `**Updates Available for Yuno!**\n\n`;
            message += `**Branch:** ${result.branch}\n`;
            message += `**Current:** ${result.localCommit}\n`;
            message += `**Latest:** ${result.remoteCommit}\n`;
            message += `**Behind by:** ${result.commitsBehind} commit(s)\n\n`;

            if (result.commits) {
                message += `**Recent changes:**\n\`\`\`\n${result.commits}\n\`\`\`\n`;
            }

            message += `Use \`.auto-update full\` to update.`;

            await errorChannel.send(message);
        } catch (e) {
            yuno.prompt.error(`Failed to send update notification to Discord: ${e.message}`);
        }
    }
}

/**
 * Run the update check
 */
async function runCheck() {
    try {
        const result = await checkForUpdates();
        await notifyUpdates(result);
    } catch (e) {
        yuno.prompt.error(`Auto-update check error: ${e.message}`);
    }
}

/**
 * Start the scheduled interval
 */
function startSchedule() {
    if (checkInterval) {
        clearInterval(checkInterval);
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    checkInterval = setInterval(runCheck, intervalMs);

    yuno.prompt.info(`Auto-update checker: Scheduled every ${intervalHours} hour(s)`);
}

/**
 * Resolve the error channel for notifications
 */
async function resolveErrorChannel() {
    if (!errorGuild || !yuno.dC) return;

    const guild = yuno.dC.guilds.cache.get(errorGuild.guild);
    if (!guild) return;

    try {
        await guild.channels.fetch();
    } catch (e) {
        return;
    }

    // Try by ID first, then by name
    const channelId = errorGuild.channel;
    if (/^\d+$/.test(channelId)) {
        errorChannel = guild.channels.cache.get(channelId);
    }

    if (!errorChannel) {
        errorChannel = guild.channels.cache.find(ch => ch.name === channelId);
    }
}

module.exports.init = async function(Yuno, hotReloaded) {
    yuno = Yuno;

    if (hotReloaded) {
        // Re-resolve channel and restart schedule on hot-reload
        await resolveErrorChannel();
        startSchedule();
    } else {
        Yuno.on("discord-connected", async () => {
            await resolveErrorChannel();

            // Check on startup
            yuno.prompt.info("Auto-update checker: Checking for updates on startup...");
            await runCheck();

            // Start scheduled checks
            startSchedule();
        });
    }
}

module.exports.configLoaded = function(Yuno, config) {
    // Get notification settings
    notifyDiscord = config.get("autoupdate.notify-discord") === true;
    intervalHours = config.get("autoupdate.interval-hours") || 6;

    // Get error channel config for notifications
    const errConfig = config.get("errors.dropon");
    if (errConfig && typeof errConfig === "object" && errConfig.guild && errConfig.channel) {
        errorGuild = errConfig;
    }

    // Clamp interval to reasonable values (1-24 hours)
    intervalHours = Math.max(1, Math.min(24, intervalHours));
}

/**
 * Enable/disable Discord notifications (called from command)
 */
module.exports.setNotifyDiscord = function(enabled) {
    notifyDiscord = enabled;
    return notifyDiscord;
}

/**
 * Get current notification status
 */
module.exports.getNotifyDiscord = function() {
    return notifyDiscord;
}

/**
 * Set check interval in hours (called from command)
 */
module.exports.setIntervalHours = function(hours) {
    intervalHours = Math.max(1, Math.min(24, hours));
    startSchedule();
    return intervalHours;
}

/**
 * Get current interval
 */
module.exports.getIntervalHours = function() {
    return intervalHours;
}

/**
 * Force an immediate check (called from command)
 */
module.exports.forceCheck = async function() {
    await runCheck();
}

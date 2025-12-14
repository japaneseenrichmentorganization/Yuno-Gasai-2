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

const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

/**
 * Execute a shell command and return stdout
 */
async function runCommand(cmd, cwd) {
    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 60000 });
        return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (e) {
        return { success: false, error: e.message, stdout: e.stdout?.trim(), stderr: e.stderr?.trim() };
    }
}

/**
 * Check for updates from git remote
 */
async function checkForUpdates(cwd) {
    // Fetch latest from remote
    const fetchResult = await runCommand("git fetch origin", cwd);
    if (!fetchResult.success) {
        return { hasUpdates: false, error: `Failed to fetch: ${fetchResult.error}` };
    }

    // Get current branch
    const branchResult = await runCommand("git rev-parse --abbrev-ref HEAD", cwd);
    if (!branchResult.success) {
        return { hasUpdates: false, error: `Failed to get branch: ${branchResult.error}` };
    }
    const branch = branchResult.stdout;

    // Compare local and remote
    const localResult = await runCommand("git rev-parse HEAD", cwd);
    const remoteResult = await runCommand(`git rev-parse origin/${branch}`, cwd);

    if (!localResult.success || !remoteResult.success) {
        return { hasUpdates: false, error: "Failed to compare versions" };
    }

    const localCommit = localResult.stdout;
    const remoteCommit = remoteResult.stdout;

    if (localCommit === remoteCommit) {
        return { hasUpdates: false, branch, localCommit: localCommit.substring(0, 7) };
    }

    // Get commit count difference
    const countResult = await runCommand(`git rev-list HEAD..origin/${branch} --count`, cwd);
    const commitsBehind = parseInt(countResult.stdout, 10) || 0;

    // Get commit messages for the updates
    const logResult = await runCommand(`git log HEAD..origin/${branch} --oneline --max-count=10`, cwd);

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
 * Pull updates from git
 */
async function pullUpdates(cwd) {
    // Stash any local changes first
    await runCommand("git stash", cwd);

    // Pull the updates
    const pullResult = await runCommand("git pull --ff-only", cwd);

    if (!pullResult.success) {
        // Try to restore stashed changes
        await runCommand("git stash pop", cwd);
        return { success: false, error: pullResult.error || pullResult.stderr };
    }

    // Pop stashed changes if any
    await runCommand("git stash pop", cwd);

    return { success: true, output: pullResult.stdout };
}

module.exports.run = async function(yuno, author, args, msg) {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || subcommand === "check") {
        const statusMsg = await msg.channel.send(":hourglass: Checking for updates...");

        const result = await checkForUpdates(process.cwd());

        if (result.error) {
            return statusMsg.edit(`:negative_squared_cross_mark: ${result.error}`);
        }

        if (!result.hasUpdates) {
            return statusMsg.edit(`:white_check_mark: Already up to date! (${result.branch}@${result.localCommit})`);
        }

        let response = `:arrow_down: **Updates available!**\n\n`;
        response += `**Branch:** ${result.branch}\n`;
        response += `**Local:** ${result.localCommit}\n`;
        response += `**Remote:** ${result.remoteCommit}\n`;
        response += `**Behind by:** ${result.commitsBehind} commit(s)\n\n`;

        if (result.commits) {
            response += `**Recent changes:**\n\`\`\`\n${result.commits}\n\`\`\`\n`;
        }

        response += `\nUse \`.auto-update pull\` to download and apply updates.`;

        return statusMsg.edit(response);
    }

    if (subcommand === "pull" || subcommand === "update") {
        const statusMsg = await msg.channel.send(":hourglass: Pulling updates from git...");

        // First check if there are updates
        const checkResult = await checkForUpdates(process.cwd());

        if (checkResult.error) {
            return statusMsg.edit(`:negative_squared_cross_mark: ${checkResult.error}`);
        }

        if (!checkResult.hasUpdates) {
            return statusMsg.edit(`:white_check_mark: Already up to date! No pull needed.`);
        }

        // Pull the updates
        const pullResult = await pullUpdates(process.cwd());

        if (!pullResult.success) {
            return statusMsg.edit(`:negative_squared_cross_mark: Failed to pull updates: ${pullResult.error}`);
        }

        await statusMsg.edit(`:white_check_mark: Updates downloaded!\n\`\`\`\n${pullResult.output}\n\`\`\`\n\nUse \`.auto-update reload\` to apply changes via hot-reload.`);
        return;
    }

    if (subcommand === "reload" || subcommand === "hot-reload") {
        const statusMsg = await msg.channel.send(":hourglass: Initiating hot-reload...");

        try {
            await yuno.hotreload();
            return statusMsg.edit(":white_check_mark: Hot-reload complete! All modules have been refreshed.");
        } catch (e) {
            return statusMsg.edit(`:negative_squared_cross_mark: Hot-reload failed: ${e.message}`);
        }
    }

    if (subcommand === "full" || subcommand === "auto") {
        const statusMsg = await msg.channel.send(":hourglass: Starting full auto-update process...");

        // Check for updates
        await statusMsg.edit(":hourglass: Step 1/3: Checking for updates...");
        const checkResult = await checkForUpdates(process.cwd());

        if (checkResult.error) {
            return statusMsg.edit(`:negative_squared_cross_mark: ${checkResult.error}`);
        }

        if (!checkResult.hasUpdates) {
            return statusMsg.edit(`:white_check_mark: Already up to date! (${checkResult.branch}@${checkResult.localCommit})`);
        }

        // Pull updates
        await statusMsg.edit(`:hourglass: Step 2/3: Pulling ${checkResult.commitsBehind} commit(s)...`);
        const pullResult = await pullUpdates(process.cwd());

        if (!pullResult.success) {
            return statusMsg.edit(`:negative_squared_cross_mark: Failed to pull updates: ${pullResult.error}`);
        }

        // Hot-reload
        await statusMsg.edit(":hourglass: Step 3/3: Applying hot-reload...");

        try {
            await yuno.hotreload();

            let response = `:white_check_mark: **Auto-update complete!**\n\n`;
            response += `**Updated:** ${checkResult.localCommit} -> ${checkResult.remoteCommit}\n`;
            response += `**Commits applied:** ${checkResult.commitsBehind}\n`;
            response += `**Hot-reload:** Success\n\n`;

            if (checkResult.commits) {
                response += `**Changes:**\n\`\`\`\n${checkResult.commits}\n\`\`\``;
            }

            return statusMsg.edit(response);
        } catch (e) {
            return statusMsg.edit(`:warning: Updates downloaded but hot-reload failed: ${e.message}\n\nA full restart may be required.`);
        }
    }

    // Show help
    return msg.channel.send(`:information_source: **Auto-Update Command**

**Usage:**
\`.auto-update check\` - Check if updates are available
\`.auto-update pull\` - Download updates from git
\`.auto-update reload\` - Apply changes via hot-reload
\`.auto-update full\` - Check, pull, and reload automatically

**Examples:**
\`.auto-update check\` - See if there are new commits
\`.auto-update full\` - One-command update process`);
}

module.exports.runTerminal = async function(yuno, args) {
    const subcommand = args[0]?.toLowerCase();

    if (!subcommand || subcommand === "check") {
        console.log("Checking for updates...");

        const result = await checkForUpdates(process.cwd());

        if (result.error) {
            console.log(`Error: ${result.error}`);
            return;
        }

        if (!result.hasUpdates) {
            console.log(`Already up to date! (${result.branch}@${result.localCommit})`);
            return;
        }

        console.log("\n=== Updates Available ===");
        console.log(`Branch: ${result.branch}`);
        console.log(`Local:  ${result.localCommit}`);
        console.log(`Remote: ${result.remoteCommit}`);
        console.log(`Behind: ${result.commitsBehind} commit(s)`);

        if (result.commits) {
            console.log("\nRecent changes:");
            console.log(result.commits);
        }

        console.log("\nUse 'auto-update pull' to download updates.");
        return;
    }

    if (subcommand === "pull" || subcommand === "update") {
        console.log("Pulling updates from git...");

        const checkResult = await checkForUpdates(process.cwd());

        if (checkResult.error) {
            console.log(`Error: ${checkResult.error}`);
            return;
        }

        if (!checkResult.hasUpdates) {
            console.log("Already up to date! No pull needed.");
            return;
        }

        const pullResult = await pullUpdates(process.cwd());

        if (!pullResult.success) {
            console.log(`Failed to pull: ${pullResult.error}`);
            return;
        }

        console.log("Updates downloaded!");
        console.log(pullResult.output);
        console.log("\nUse 'auto-update reload' to apply changes.");
        return;
    }

    if (subcommand === "reload" || subcommand === "hot-reload") {
        console.log("Initiating hot-reload...");

        try {
            await yuno.hotreload();
            console.log("Hot-reload complete!");
        } catch (e) {
            console.log(`Hot-reload failed: ${e.message}`);
        }
        return;
    }

    if (subcommand === "full" || subcommand === "auto") {
        console.log("Starting full auto-update process...\n");

        // Check for updates
        console.log("Step 1/3: Checking for updates...");
        const checkResult = await checkForUpdates(process.cwd());

        if (checkResult.error) {
            console.log(`Error: ${checkResult.error}`);
            return;
        }

        if (!checkResult.hasUpdates) {
            console.log(`Already up to date! (${checkResult.branch}@${checkResult.localCommit})`);
            return;
        }

        console.log(`Found ${checkResult.commitsBehind} new commit(s)`);

        // Pull updates
        console.log("\nStep 2/3: Pulling updates...");
        const pullResult = await pullUpdates(process.cwd());

        if (!pullResult.success) {
            console.log(`Failed to pull: ${pullResult.error}`);
            return;
        }

        console.log(pullResult.output);

        // Hot-reload
        console.log("\nStep 3/3: Applying hot-reload...");

        try {
            await yuno.hotreload();
            console.log("\n=== Auto-Update Complete ===");
            console.log(`Updated: ${checkResult.localCommit} -> ${checkResult.remoteCommit}`);
            console.log(`Commits applied: ${checkResult.commitsBehind}`);
        } catch (e) {
            console.log(`Hot-reload failed: ${e.message}`);
            console.log("A full restart may be required.");
        }
        return;
    }

    // Show help
    console.log("Auto-Update Command");
    console.log("");
    console.log("Usage:");
    console.log("  auto-update check    - Check if updates are available");
    console.log("  auto-update pull     - Download updates from git");
    console.log("  auto-update reload   - Apply changes via hot-reload");
    console.log("  auto-update full     - Check, pull, and reload automatically");
    console.log("");
    console.log("Examples:");
    console.log("  auto-update check");
    console.log("  auto-update full");
}

module.exports.about = {
    "command": "auto-update",
    "description": "Check for updates, pull from git, and hot-reload the bot.",
    "usage": "auto-update [check|pull|reload|full]",
    "examples": [
        "auto-update check",
        "auto-update pull",
        "auto-update reload",
        "auto-update full"
    ],
    "discord": true,
    "terminal": true,
    "list": true,
    "listTerminal": true,
    "onlyMasterUsers": true,
    "aliases": ["update", "git-update", "upgrade"]
}

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

const { EmbedBuilder } = require("discord.js");

// Track delay usage per guild/channel: { "guildId-channelName": { count: 0, resetTime: timestamp } }
const delayUsage = new Map();

// Default configuration
const DEFAULT_DELAY_MINUTES = 5;
const MAX_DELAYS = 3;

module.exports.run = async function(yuno, author, args, msg) {
    const channel = msg.channel;
    const guildId = msg.guild.id;
    const channelName = channel.name.toLowerCase();

    // Check if this channel has an auto-clean set up
    const clean = await yuno.dbCommands.getClean(yuno.database, guildId, channelName);

    if (clean === null) {
        return msg.channel.send(":negative_squared_cross_mark: This channel doesn't have auto-clean set up.");
    }

    // Get guild-specific settings or use defaults
    const guildSettings = await yuno.dbCommands.getGuild(yuno.database, guildId);
    const delayMinutes = guildSettings?.delayMinutes || DEFAULT_DELAY_MINUTES;
    const maxDelays = guildSettings?.maxDelays || MAX_DELAYS;

    // Create unique key for this guild/channel combo
    const usageKey = `${guildId}-${channelName}`;

    // Get or initialize usage tracking for this channel
    let usage = delayUsage.get(usageKey);

    // Reset usage if the clean cycle has reset (remainingTime is back to full)
    if (!usage || clean.remainingTime >= clean.timeFEachClean * 60 - 1) {
        usage = { count: 0, cycleStart: Date.now() };
        delayUsage.set(usageKey, usage);
    }

    // Check if max delays reached
    if (usage.count >= maxDelays) {
        const embed = new EmbedBuilder()
            .setColor("#ff0000")
            .setTitle("Delay Limit Reached")
            .setDescription(`This channel has already been delayed ${maxDelays} time(s) this cleaning cycle.\nThe delay limit will reset after the next clean.`);
        return msg.channel.send({ embeds: [embed] });
    }

    // Apply the delay
    const newRemainingTime = clean.remainingTime + delayMinutes;
    await yuno.dbCommands.setClean(
        yuno.database,
        guildId,
        channelName,
        clean.timeFEachClean,
        clean.timeBeforeClean,
        newRemainingTime
    );

    // Update usage count
    usage.count++;
    delayUsage.set(usageKey, usage);

    const delaysRemaining = maxDelays - usage.count;

    const embed = new EmbedBuilder()
        .setColor("#ff51ff")
        .setTitle("Cleaning Delayed")
        .setDescription(`The auto-clean has been delayed by **${delayMinutes} minutes**.`)
        .addFields(
            { name: "New Time Until Clean", value: `${yuno.UTIL.formatDuration(newRemainingTime * 60)}`, inline: true },
            { name: "Delays Remaining", value: `${delaysRemaining}/${maxDelays}`, inline: true }
        )
        .setFooter({ text: delaysRemaining === 0 ? "No more delays available this cycle" : `${delaysRemaining} delay(s) remaining this cycle` });

    return msg.channel.send({ embeds: [embed] });
}

module.exports.about = {
    "command": "delay",
    "description": "Delay the auto-clean for this channel. Can be used when the cleaning warning appears. Default delay is 5 minutes, with a maximum of 3 delays per cleaning cycle.",
    "usage": "delay",
    "examples": ["delay"],
    "discord": true,
    "terminal": false,
    "list": true,
    "listTerminal": false,
    "aliases": ["wait", "hold"],
    "requiredPermissions": []
}

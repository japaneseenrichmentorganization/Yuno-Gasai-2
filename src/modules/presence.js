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

const { ActivityType } = require('discord.js');

module.exports.modulename = "presence";

let presenceData = null;

let discordConnected = async function(Yuno) {
    if (presenceData !== null) {
        try {
            // Convert old v13 presence format to v14 if needed
            let v14Presence = convertToV14Presence(presenceData);
            await Yuno.dC.user.setPresence(v14Presence);
            Yuno.prompt.success("Bot presence set successfully");
        } catch (e) {
            Yuno.prompt.error("Failed to set presence: " + e.message);
        }
    }
};

/**
 * Converts Discord.js v13 presence format to v14
 * @param {Object} oldPresence The presence data (v13 or v14 format)
 * @returns {Object} v14 compatible presence
 */
function convertToV14Presence(oldPresence) {
    let newPresence = {
        status: oldPresence.status || 'online',
        activities: []
    };

    // Handle activities
    if (oldPresence.activities && Array.isArray(oldPresence.activities)) {
        newPresence.activities = oldPresence.activities.map(activity => {
            let newActivity = {
                name: activity.name || 'Yuno Gasai',
                type: activity.type
            };

            // Convert string types to ActivityType enum if needed
            if (typeof activity.type === 'string') {
                const typeMap = {
                    'PLAYING': ActivityType.Playing,
                    'STREAMING': ActivityType.Streaming,
                    'LISTENING': ActivityType.Listening,
                    'WATCHING': ActivityType.Watching,
                    'COMPETING': ActivityType.Competing
                };
                newActivity.type = typeMap[activity.type.toUpperCase()] || ActivityType.Playing;
            } else if (typeof activity.type === 'number') {
                // Already a number, use as-is
                newActivity.type = activity.type;
            } else {
                // Default to Playing
                newActivity.type = ActivityType.Playing;
            }

            // Add optional fields
            if (activity.url) newActivity.url = activity.url;
            if (activity.state) newActivity.state = activity.state;

            return newActivity;
        });
    } else if (oldPresence.activity) {
        // Single activity (old v13 format)
        let activity = {
            name: oldPresence.activity.name || 'Yuno Gasai',
            type: oldPresence.activity.type || ActivityType.Playing
        };

        // Convert string types
        if (typeof activity.type === 'string') {
            const typeMap = {
                'PLAYING': ActivityType.Playing,
                'STREAMING': ActivityType.Streaming,
                'LISTENING': ActivityType.Listening,
                'WATCHING': ActivityType.Watching,
                'COMPETING': ActivityType.Competing
            };
            activity.type = typeMap[activity.type.toUpperCase()] || ActivityType.Playing;
        }

        if (oldPresence.activity.url) activity.url = oldPresence.activity.url;
        if (oldPresence.activity.state) activity.state = oldPresence.activity.state;

        newPresence.activities = [activity];
    }

    return newPresence;
}

module.exports.init = function(Yuno, hotReloaded) {
    if (hotReloaded)
        discordConnected(Yuno);
    else
        Yuno.on("discord-connected", discordConnected)
}

module.exports.configLoaded = async function(Yuno, config) {
    let presenceData_ = await config.get("discord.presence");

    if (typeof presenceData_ === "object")
        presenceData = presenceData_; 
}

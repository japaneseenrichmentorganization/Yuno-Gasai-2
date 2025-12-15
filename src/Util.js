/**
 * HTML entity decode map for common entities
 * Native replacement for 'he' library
 */
const HTML_ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&hellip;': '\u2026',
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
    '&deg;': '\u00B0',
    '&plusmn;': '\u00B1',
    '&frac12;': '\u00BD',
    '&frac14;': '\u00BC',
    '&frac34;': '\u00BE',
    '&times;': '\u00D7',
    '&divide;': '\u00F7',
    '&euro;': '\u20AC',
    '&pound;': '\u00A3',
    '&yen;': '\u00A5',
    '&cent;': '\u00A2'
};

module.exports = {
    /**
     * Decode HTML entities in a string
     * Native replacement for the 'he' library
     * @param {string} str - String with HTML entities
     * @returns {string} Decoded string
     */
    "decodeHTML": function(str) {
        if (!str || typeof str !== 'string') return str;

        // First, handle named entities
        let result = str.replace(/&[a-zA-Z]+;/g, (entity) => {
            return HTML_ENTITIES[entity] || entity;
        });

        // Then handle numeric entities (&#123; or &#x7B;)
        result = result.replace(/&#(\d+);/g, (_, code) => {
            return String.fromCharCode(parseInt(code, 10));
        });

        result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
            return String.fromCharCode(parseInt(code, 16));
        });

        return result;
    },

    /**
     * Returns the avatar url from the user
     * @param {User} user
     * @return {String} The url.
     */
    "getAvatarURL": function(user) {
        return user.displayAvatarURL({extension: 'png', size: 256});
    },

    /**
     * Cleans a channel
     * @param {TextChannel} channel
     * @async
     * @return {TextChannel} The new and empty channel.
     */
    "clean": async function(channel) {
        const nsfw = channel.nsfw;
        const pos = channel.position;
        const oldId = channel.id;

        // Clone the channel
        const n = await channel.clone({
            "reason": "Cleaning by Yuno."
        });

        // Try to delete the old channel, but don't fail if it doesn't work
        // The new channel is already created and functional
        try {
            await channel.delete();
        } catch (deleteErr) {
            console.log(`[AutoClean] Warning: Failed to delete old channel ${oldId}: ${deleteErr.message} (new channel ${n.id} is active)`);
            // Don't throw - the new channel is ready to use
        }

        // Restore position
        try {
            await n.setPosition(pos);
        } catch (posErr) {
            console.log(`[AutoClean] Warning: Failed to restore position: ${posErr.message}`);
        }

        // Restore NSFW/age-restricted setting using setNSFW method (Discord.js v14)
        // This ensures both NSFW and age-restricted flags are properly carried over
        if (nsfw) {
            try {
                await n.setNSFW(true, "Restoring NSFW setting after channel clean");
            } catch (nsfwErr) {
                console.log(`[AutoClean] Warning: Failed to restore NSFW setting: ${nsfwErr.message}`);
            }
        }

        return n;
    },


    /**
     * Format duration in a nice and human-readable format.
     * @param {Number} seconds
     * @return {String}
     */
    "formatDuration": function(seconds) {
        const h = Math.floor(seconds / 3600);
        const min = Math.floor((seconds - (h * 3600)) / 60);
        const sec = seconds - (h * 3600) - (min * 60);
        let r = "";

        if (h > 0)
            r += String(h).padStart(2, '0') + "h ";

        if (min > 0)
            r += String(min).padStart(2, '0') + "min ";

        if (sec > 0 || r === "")
            r += String(sec).padStart(2, '0') + "s";

        return r;
    },

    /**
     * Returns if the given string is an URL
     * @param {String} url
     * @return {boolean}
     */
    "checkIfUrl": function(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    },

    /**
     * Give a more simple and easy to read synopsis from an anime
     * @param {String}
     * @return {url} 
     */
    "cleanSynopsis": function(str, id, type) {
        if (str.length > 2048) {
            str = str.slice(0, 1950).split('.');
            str.pop();
            str = `${str.join('.')}.\n\n[[ Read More ]](https://myanimelist.net/${type}/${id})\n\n`;
        }
        str = str
            .replace(/\n\n/g, '\n')
            .replace(/\[.*\]/g, '')
            .replace(/\(Source: .*\)/g, '');

        return str;
    }
}

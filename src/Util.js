module.exports = {
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
        let nsfw = channel.nsfw,
            pos = channel.position;

        // Clone the channel
        let n = await channel.clone({
            "reason": "Cleaning by Yuno."
        });

        // Delete the old channel
        await channel.delete();

        // Restore position
        await n.setPosition(pos);

        // Restore NSFW/age-restricted setting using setNSFW method (Discord.js v14)
        // This ensures both NSFW and age-restricted flags are properly carried over
        if (nsfw) {
            await n.setNSFW(true, "Restoring NSFW setting after channel clean");
        }

        return n;
    },


    /**
     * Format duration in a nice and human-readable format.
     * @param {Number} seconds
     * @return {String}
     */
    "formatDuration": function(seconds) {
        let h = Math.floor(seconds / 3600),
            min = Math.floor((seconds - (h * 3600)) / 60),
            sec = seconds - (h * 3600) - (min * 60),
            r = "";

        if (h > 0)
            r += ("00" + h).slice(-2) + "h "

        if (min > 0)
            r += ("00" + min).slice(-2) + "min "

        if (sec > 0)
            r += ("00" + sec).slice(-2) + "s"

        return r;
    },

    /**
     * Returns if the given string is an URL
     * @param {String} url
     * @return {boolean}
     */
    "checkIfUrl": function(url) {
        return (
            /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/
        ).test(url)
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

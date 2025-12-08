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

/**
 * Simple LRU (Least Recently Used) Cache implementation
 * @param {number} maxSize Maximum number of entries in the cache
 * @param {number} ttl Time-to-live in milliseconds (optional, 0 = no expiry)
 * @constructor
 */
function LRUCache(maxSize, ttl) {
    this.maxSize = maxSize || 100;
    this.ttl = ttl || 0;
    this.cache = new Map();
}

/**
 * Get a value from the cache
 * @param {string} key
 * @returns {any|undefined}
 */
LRUCache.prototype.get = function(key) {
    const entry = this.cache.get(key);

    if (!entry) {
        return undefined;
    }

    // Check if expired
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
};

/**
 * Set a value in the cache
 * @param {string} key
 * @param {any} value
 */
LRUCache.prototype.set = function(key, value) {
    // Delete if exists (to update position)
    if (this.cache.has(key)) {
        this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
        value: value,
        timestamp: Date.now()
    });
};

/**
 * Check if a key exists in the cache
 * @param {string} key
 * @returns {boolean}
 */
LRUCache.prototype.has = function(key) {
    const entry = this.cache.get(key);

    if (!entry) {
        return false;
    }

    // Check if expired
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        return false;
    }

    return true;
};

/**
 * Delete a key from the cache
 * @param {string} key
 */
LRUCache.prototype.delete = function(key) {
    this.cache.delete(key);
};

/**
 * Clear all entries from the cache
 */
LRUCache.prototype.clear = function() {
    this.cache.clear();
};

/**
 * Get the current size of the cache
 * @returns {number}
 */
LRUCache.prototype.size = function() {
    return this.cache.size;
};

/**
 * Invalidate all entries matching a prefix
 * @param {string} prefix
 */
LRUCache.prototype.invalidatePrefix = function(prefix) {
    for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
            this.cache.delete(key);
        }
    }
};

module.exports = LRUCache;

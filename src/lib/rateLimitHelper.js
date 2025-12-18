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
 * Rate limit helper for Discord API operations
 * Provides dynamic delay calculation based on rate limit events
 */

// Rate limit tracking state
const rateLimitState = {
    lastHit: 0,
    retryAfter: 0,
    consecutiveHits: 0,
    listeners: new Set()
};

/**
 * Calculate dynamic delay based on rate limit state
 * @param {Object} client - Discord client
 * @returns {number} Delay in milliseconds
 */
function getRateLimitDelay(client) {
    try {
        const now = Date.now();

        // If we recently hit a rate limit, wait the retry time
        if (rateLimitState.retryAfter > now) {
            return rateLimitState.retryAfter - now;
        }

        // Check if Discord.js REST manager has global rate limit info
        if (client?.rest?.globalRemaining !== undefined && client.rest.globalRemaining <= 1) {
            const resetTime = client.rest.globalReset || 0;
            if (resetTime > now) {
                return resetTime - now;
            }
        }

        // Exponential backoff if we're hitting limits frequently
        if (rateLimitState.consecutiveHits > 0) {
            const timeSinceLastHit = now - rateLimitState.lastHit;
            // Reset consecutive hits if it's been more than 30 seconds
            if (timeSinceLastHit > 30000) {
                rateLimitState.consecutiveHits = 0;
                return 10;
            }
            // Exponential backoff: 50ms * 2^hits, max 5 seconds
            return Math.min(50 * Math.pow(2, rateLimitState.consecutiveHits), 5000);
        }

        // No rate limit issues - minimal delay
        return 10;
    } catch {
        return 50; // Fallback delay
    }
}

/**
 * Wait for the appropriate rate limit delay
 * @param {Object} client - Discord client
 * @returns {Promise<void>}
 */
async function waitForRateLimit(client) {
    const delay = getRateLimitDelay(client);
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

/**
 * Register rate limit listener on client
 * @param {Object} client - Discord client
 * @returns {Function} Cleanup function to remove listener
 */
function setupRateLimitListener(client) {
    // Create a unique handler for this registration
    const handler = (info) => {
        rateLimitState.lastHit = Date.now();
        rateLimitState.retryAfter = Date.now() + info.timeToReset;
        rateLimitState.consecutiveHits++;
        console.log(`[RateLimit] Limited on ${info.route}, waiting ${info.timeToReset}ms`);
    };

    // Only add listener if not already tracking this handler
    if (!rateLimitState.listeners.has(handler)) {
        client.rest.on("rateLimited", handler);
        rateLimitState.listeners.add(handler);
    }

    // Return cleanup function
    return () => {
        client.rest.off("rateLimited", handler);
        rateLimitState.listeners.delete(handler);

        // Only reset state if no more listeners
        if (rateLimitState.listeners.size === 0) {
            rateLimitState.lastHit = 0;
            rateLimitState.retryAfter = 0;
            rateLimitState.consecutiveHits = 0;
        }
    };
}

/**
 * Execute a function with rate limit handling
 * Automatically waits and retries on rate limits
 * @param {Object} client - Discord client
 * @param {Function} fn - Async function to execute
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<*>} Result of the function
 */
async function withRateLimitHandling(client, fn, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Wait for any active rate limit before attempting
            await waitForRateLimit(client);
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if this is a rate limit error
            if (error.status === 429 || error.code === 429) {
                const retryAfter = error.retryAfter || 1000;
                console.log(`[RateLimit] Hit rate limit, waiting ${retryAfter}ms before retry ${attempt + 1}/${maxRetries}`);
                rateLimitState.lastHit = Date.now();
                rateLimitState.retryAfter = Date.now() + retryAfter;
                rateLimitState.consecutiveHits++;

                await new Promise(resolve => setTimeout(resolve, retryAfter));
                continue;
            }

            // Not a rate limit error, throw immediately
            throw error;
        }
    }

    throw lastError;
}

/**
 * Reset rate limit state (useful for testing or after long idle periods)
 */
function resetRateLimitState() {
    rateLimitState.lastHit = 0;
    rateLimitState.retryAfter = 0;
    rateLimitState.consecutiveHits = 0;
}

module.exports = {
    getRateLimitDelay,
    waitForRateLimit,
    setupRateLimitListener,
    withRateLimitHandling,
    resetRateLimitState
};

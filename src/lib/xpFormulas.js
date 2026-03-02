/**
 * XP needed to level up from `level` to `level + 1`.
 * This is the authoritative formula for the entire codebase.
 * @param {number} level - Current level (0-based)
 * @returns {number}
 */
function xpNeededForLevel(level) {
    return 5 * Math.pow(level, 2) + 50 * level + 100;
}

/**
 * Cumulative XP needed to reach `targetLevel` from level 0.
 * @param {number} targetLevel
 * @returns {number}
 */
function totalXPForLevel(targetLevel) {
    let total = 0;
    for (let i = 1; i <= targetLevel; i++) {
        total += xpNeededForLevel(i);
    }
    return total;
}

module.exports = { xpNeededForLevel, totalXPForLevel };

/**
 * Parses a string argument into a boolean toggle.
 * Accepts: enable/disable, true/false, yes/no, on/off, 1/0 (case-insensitive, prefix match for enable/disable/true/false).
 * Returns true, false, or null if the string is not recognized.
 * @param {string} str
 * @returns {boolean|null}
 */
function parseToggle(str) {
    if (!str || typeof str !== "string") return null;
    const lower = str.toLowerCase();
    if (lower.startsWith("enab") || lower.startsWith("tru") || lower === "1" || lower === "yes" || lower === "on")
        return true;
    if (lower.startsWith("disab") || lower.startsWith("fa") || lower === "0" || lower === "no" || lower === "off")
        return false;
    return null;
}

module.exports = { parseToggle };

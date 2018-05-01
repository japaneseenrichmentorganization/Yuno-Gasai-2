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

let instance = null;

/**
 * The interval manager singleton. It manages all the intervals and still gets their reference on hot-reload.
 * @param {Object} [intervals] This is for hot-reload. Never give intervals argument, unless you know what you're doing.
 * @deprecated Use IntervalManager.init() to create an instance of IntervalManager. Do not use new IntervalManager().
 * @prop {Object} 
 * @constructor
 */
let IntervalManager = function(intervals) {
    this.intervals = typeof intervals === "object" ? intervals : {};
}

/**
 * Inits the singleton
 * @param {Object} [intervals]
 * @return {IntervalManager} The instance.
 */
IntervalManager.init = function(intervals) {
    if (instance === null)
        instance = new IntervalManager(intervals);
    return instance;
}


/**
 * Saves the settings, to export them to a new instance (e.g. hot-reload)
 * The new IntervalManager instance can be reconstructed with `IntervalManager.init(oldInstance.backup());`
 * @return {Object}
 */
IntervalManager.prototype.backup = function() {
    return this.intervals;
}

/**
 * Appends a new interval into the IntervalManager
 * @param {String} id A desired id for the timeout/interval
 * @param {number} timeoutId The result of setTimeout/setInterval
 * @param {function} [func] The function
 * @param {number} [delay]
 * @param {boolean} [isTimeout] true if the timeoutId refers to a timeout
 * @param {boolean} [force]
 * @deprecated Use IntervalManager.prototype.setTimeout/setInterval for 
 * @returns {null|undefined} Returns null when the id is already taken.
 */
IntervalManager.prototype.add = function(id, timeoutId, func, delay, args, isTimeout, force) {
    if (!this.intervals.hasOwnProperty(id) || force === true)
        return this.intervals[id] = {
            "id": timeoutId,
            "setAt": Date.now(),
            "delay": typeof delay === "number" ? delay : null,
            "args": args ? args : null,
            "func": typeof func === "function" ? func : null,
            "isTimeout": typeof isTimeout === "boolean" ? isTimeout : null
        };
    else
        return null;
}

IntervalManager.prototype.get = function(id) {
    if (this._has(id))
        return this.intervals[id]
    else
        return null;
}

/**
 * Returns true if the 
 * @param {String} id 
 */
IntervalManager.prototype._has = function(id) {
    return Object.keys(this.intervals).includes(id);
}

let _getValueFromIntervals = function(id, prop){
    if (this._has(id))
        return this.intervals[id][prop]
    else
        return null;
}

/**
 * Returns the interval/timeout id
 * @param {String} id
 * @return {number|null}
 */
IntervalManager.prototype.getId = function(id) {
    return _getValueFromIntervals.bind(this)(id, "id");
}

/**
 * Returns the timestamp from where the interval/timeout has been defined
 * @param {String} id
 * @return {number|null}
 */
IntervalManager.prototype.getWhenTheTimeoutHasBeenSet = function(id) {
    return _getValueFromIntervals(id, "setAt");
}

/**
 * Returns the delay of a timeout/interval id
 * @param {String} id
 * @return {number|null}
 */
IntervalManager.prototype.getDelay = function(id) {
    return _getValueFromIntervals(id, "delay");
}

/**
 * Clears a timeout/interval
 * @param {String} id
 */
IntervalManager.prototype.clear = function(id) {
    let ref = this.get(id);
    if (ref.isTimeout === null || ref.isTimeout === true)
        clearTimeout(this.getId(id)); 
    if (ref.isTimeout === null || ref.isTimeout === false)
        clearInterval(this.getId(id));
}

/**
 * Sets a timeout
 * @param {String} id
 * @param {function} func
 * @param {number} delay
 * @param {arguments} args The args given to the function
 */
IntervalManager.prototype.setTimeout = function(id, func, delay, ...args) {
    this.add(id, setTimeout(func, delay, args), func, delay, args, true)
}

/**
 * Sets an interval
 * @param {String} id
 * @param {function} func
 * @param {number} delay
 * @param {arguments} args The args given to the function
 */
IntervalManager.prototype.setInterval = function(id, func, delay, ...args) {
    this.add(id, setInterval(func, delay, args), func, delay, args, false)
}

/**
 * Updates the delay of a timeout/interval
 * @param {String} id
 * @param {number} delay The new delay.
 */
IntervalManager.prototype.updateDelay = function(id, delay) {
    let ref = this.get(id);
    if (ref === null)
        return;

    this.clear(id);
    this.add(id, setTimeout(ref.func, delay, ref.args), ref.func, delay, args, ref.isTimeout, true);
}

/**
 * Gives the remaining time for a timeout
 * @param {String} id
 * @param {number} [delay] If the delay hasn't been given earlier.
 * @return {number|null} Null if the timeout hasn't been found
 */
IntervalManager.prototype.getRemainingTime = function(id, delay) {
    let ref = this.get(id);

    if (typeof delay !== "number")
        delay = ref.delay;

    if (delay === null)
        return;

    let elapsedTime = Date.now() - ref.setAt;

    return delay - elapsedTime;
}

module.exports = IntervalManager;
/*global setTimeout, define, require, module */
var factory = function(
    _,
    $lang
) {

    "use strict";

    var TaskManager = {
        scheduleTask: function(fn, timeout) {
            fn = fn || $lang.noop;
            // "nextTick" - min clamped to 3ms in most browsers, but no harm in goin lower
            timeout = timeout || 1;
            if (typeof setTimeout !== "undefined") {
                return setTimeout(fn, timeout);
            } else {
                if (typeof module !== "undefined" &&
                    module.exports && typeof require !== "undefined") {
                    // Try the Moz way
                    var t = require("sdk/timers");
                    if (t) {
                        return t.setTimeout(fn, timeout);
                    } else {
                        throw new Error("Don't know who to delegate task to!");
                    }
                } else {
                    throw new Error("Don't know who to delegate task to!");
                }
            }
        },
        cancelTask: function(timeoutId) {
            if (typeof setTimeout !== "undefined") {
                return clearTimeout(timeoutId);
            } else {
                if (typeof module !== "undefined" &&
                    module.exports && typeof require !== "undefined") {
                    // Try the Moz way
                    var t = require("sdk/timers");
                    if (t) {
                        return t.clearTimeout(timeoutId);
                    } else {
                        throw new Error("Don't know who to delegate cancel to!");
                    }
                } else {
                    throw new Error("Don't know who to delegate cancel to!");
                }
            }
        }
    };

    return TaskManager;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore", "bit/commons/lang"));
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/lang"], factory);
}

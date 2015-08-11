var factory = function (
    _,
    $lang,
    Flow
) {
    "use strict";
    var CountdownLatch = function () {
        this.initialize.apply(this, arguments);
    };

    _.extend(CountdownLatch.prototype, {
        initialize: function (steps, completionCallback) {
            this._steps = steps || 0;
            this._completionCallback = completionCallback || $lang.noop;
            _.bindAll(this, "_completionCallback", "_triggerCompletion");
            if(isNaN(this._steps) || this._steps < 0) {
                // Going by the getOrError() philosophy to ensure that 
                // 'new CountdownLatch()' does not succeed.
                throw new Error("CountdownLatch: Number of steps are invalid.");
            }
            this._current = 0;
            this._complete = false;
            this._error = null;
            if(this._steps === 0) {
                Flow.getInstance().nextTick(this._triggerCompletion);
                return;
            }
        },
        step: function (steps) {
            if (this._complete || this._steps === 0) {
                return;
            }
            this._current += steps || 1;
            if (this._current >= this._steps) {
                this._triggerCompletion();
            }
        },
        error: function (err) {
            if (this._complete || this._steps === 0) {
                return;
            }
            this._error = err;
            this._triggerCompletion();
        },
        _triggerCompletion: function () {
            if (this._complete) {
                return;
            }
            this._complete = true;
            if (this._error) {
                Flow.getInstance().nextTick($lang.partiallyApply(this._completionCallback, this._error));
            } else {
                Flow.getInstance().nextTick(this._completionCallback());
            }
        }
    });

    return CountdownLatch;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/lang"),
        require("bit/commons/flow")
    );
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/lang", "bit/commons/flow"], factory);
}
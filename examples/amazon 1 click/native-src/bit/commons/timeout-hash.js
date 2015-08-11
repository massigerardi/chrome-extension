/*global define, require, module */
var factory = function (_, $options, $taskManager) {

    "use strict";

    var EXPIRY_CHECK_INTERVAL = 850; // milliseconds
                                     // TODO: perf adjustments

    var TimeoutHashElement = function () {
        this.initialize.apply(this, arguments);
    };

    _.extend(TimeoutHashElement.prototype, {
        initialize: function (opts) {
            opts = $options.fromObject(opts);
            this._owner = opts.getOrError("owner");
            // Key is useful so this elt can ask its owner for removal
            // without having to do an expensive by-value lookup.
            this._key = opts.getOrError("key");
            this._timeout = opts.getOrError("timeout");
            this._lastAccess = null;
            this._expiryRequested = false;
            this._disposed = false;
            this.touch();
            _.bindAll(this, "_checkExpired");
            this._scheduleExpiryCheck();
        },

        setValue: function (newValue) {
            this.touch();
            this._value = newValue;
        },

        value: function () {
            this.touch();
            return this._value;
        },

        touchlessValue: function () {
            return this._value;
        },

        touch: function () {
            this._lastAccess = Date.now();
        },

        dispose: function () {
            this._disposed = true;
            this._value = null;
            this._owner = null;
            this._key = null;
        },

        isExpired: function () {
            return this._expiryRequested || (Date.now() - this._lastAccess > this._timeout);
        },

        _requestExpiry: function () {
            this._expiryRequested = true;

            // Prevents the case where we've been disposed, but
            // slipped through the cracks and are trying to
            // request expiry again. Ignorable, but hash
            // can't do anything useful without at
            // least the key
            if (this._key) {
                this._owner._requestExpiry(this._key, this);
            }
        },

        _scheduleExpiryCheck: function () {
            $taskManager.scheduleTask(this._checkExpired, EXPIRY_CHECK_INTERVAL);
        },

        _checkExpired: function () {
            if (this._disposed) {
                return;
            } else if (this.isExpired()) {
                this._requestExpiry();
            } else {
                $taskManager.scheduleTask(this._checkExpired, EXPIRY_CHECK_INTERVAL);
            }
        }

    });

    var TimeoutHash = function () {
        this.initialize.apply(this, arguments);
    };
    _.extend(TimeoutHash.prototype, {
        initialize: function (opts) {
            opts = $options.fromObject(opts);
            this._timeout = opts.getOrElse("timeout", 5000);
            this._onTimeout = opts.getOrElse("onTimeout", function () {});
            this._hash = {};
            this._disposed = false;
        },

        dispose: function() {
            if (this._disposed) {
                return;
            }

            if (this._hash) {
                _.each(this._hash, function(elt) {
                    elt.dispose();
                });
                this._hash = null;
            }

            this._disposed = true;
        },

        _checkNotDisposed: function() {
            if (this._disposed) {
                throw new Error("Tried to modify disposed TimeoutHash");
            }
        },

        put: function (key, value, timeout) {
            this._checkNotDisposed();

            var tElt = this._hash[key];
            if (!tElt) {
                tElt = new TimeoutHashElement({
                    owner: this,
                    key: key,
                    timeout: timeout || this._timeout
                });
                this._hash[key] = tElt;
            }
            tElt.setValue(value);
        },

        get: function (key) {
            this._checkNotDisposed();

            var tElt = this._hash[key];
            if (!tElt) {
                return;
            } else {
                return tElt.value();
            }
        },

        getAndRemove: function (key) {
            this._checkNotDisposed();

            var tElt = this._hash[key],
                val;
            if (!tElt) {
                return;
            } else {
                val = tElt.value();
                this.remove(key);
                return val;
            }
        },

        remove: function (key) {
            this._checkNotDisposed();
            var timeoutHashElt = this._hash[key];
            if (timeoutHashElt) {
                delete this._hash[key];
                timeoutHashElt.dispose();
            }
        },

        _requestExpiry: function (key, timeoutHashElt) {
            var value = timeoutHashElt.touchlessValue();
            delete this._hash[key];
            timeoutHashElt.dispose();
            this._onTimeout(key, value);
        }
    });

    return TimeoutHash;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/commons/task-manager")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/commons/task-manager"
    ], factory);
}

var factory = function(
    _,
    Promise,
    $lang,
    $options,
    $uuid,
    Flow,
    SimpleStorage
) {

    "use strict";

    /**
     * TokenVendor
     *
     * This module is responsible for managing (generate, reset and validate) tokens. It
     * stores the tokens using the SimpleStorage module.
     *
     * You can create a TokenVendor as follows:
     * var tokenVdr = new TokenVendor({
     *      storage: nativeStorage
     * });
     *
     */
    var TokenVendor = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(TokenVendor.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            var storage = opts.getOrError("storage");
            this._storage = new SimpleStorage(storage);
        },

        /**
         * Given an identifier, provides a token unique to the identifier.
         * This token does not change between requests.
         *
         * TokenVendor.persistentToken(identifier, function(err, token) {
         *      // Check err and do something cool with token.
         * });
         */
        persistentToken: function(identifier, cb) {
            var storageKey = this._getStorageKey(identifier);
            this._storage.get(storageKey, _.bind(function(err, token) {
                if (!token) {
                    token = $uuid.v4();
                    this._storage.set(storageKey, token, function() {
                        Flow.getInstance().nextTick($lang.partiallyApply(cb, null, token));
                    });
                } else {
                    Flow.getInstance().nextTick($lang.partiallyApply(cb, null, token));
                }
            }, this));
        },

        /**
         * Given an identifier, clears the corresponding token.
         *
         * TokenVendor.resetToken(identifier, function(err) {
         *      // Check err and do something cool.
         * });
         */
        resetToken: function(identifier, cb) {
            var storageKey = this._getStorageKey(identifier);
            this._storage.set(storageKey, null, function() {
                Flow.getInstance().nextTick($lang.partiallyApply(cb, null));
            });
        },

        /**
         * Verifies if the hash of token corresponding to the identifer
         * falls below the knobValue.
         *   If knobValue is 0, return false.
         *   If reducedValue < knobValue, return true.
         *   Else return false.
         */
        verifyToken: function(identifier, knobValue, cb) {
            this.persistentToken(identifier, function(err, token) {
                if (knobValue < 1) {
                    Flow.getInstance().nextTick($lang.partiallyApply(cb, null, false));
                    return;
                }
                var reducedToken = parseInt(token.substring(0, 8), 16) % 100;
                if (reducedToken <= knobValue) {
                    Flow.getInstance().nextTick($lang.partiallyApply(cb, null, true));
                } else {
                    Flow.getInstance().nextTick($lang.partiallyApply(cb, null, false));
                }
            });
        },

        /**
         * Returns the storage key for the given identifier
         */
        _getStorageKey: function(identifier) {
            return "TokenVendor-" + identifier;
        }
    });

    Promise.promisifyAll(TokenVendor.prototype);

    return TokenVendor;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/lang"),
        require("bit/commons/options"),
        require("bit/commons/uuid"),
        require("bit/commons/flow"),
        require("bit/ext/core/storage/simple-storage")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/lang",
        "bit/commons/options",
        "bit/commons/uuid",
        "bit/commons/flow",
        "bit/ext/core/storage/simple-storage"
    ], factory);
}
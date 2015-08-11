var factory = function(
    _,
    Promise,
    StateGuard
) {

    /**
     * Implements an async interface to an in-memory store.
     *
     * While it does so superflously, the point is for consumers
     * to standardize on an async interface, in the event
     * an async remote store needs to be used later on.
     */
    var AsyncInMemoryStore = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(AsyncInMemoryStore.prototype, {
        initialize: function() {
            this._storage = {};
            this._guard = new StateGuard("disposed");
        },

        get: Promise.method(function(key) {
            this._guard.deny("disposed");
            return this._storage[key];
        }),

        put: Promise.method(function(key, value) {
            this._guard.deny("disposed");
            this._storage[key] = value;
        }),

        keys: Promise.method(function() {
            this._guard.deny("disposed");
            return _.keys(this._storage);
        }),

        remove: Promise.method(function(key) {
            this._guard.deny("disposed");
            var val = this._storage[key];
            if (typeof val !== "undefined") {
                delete this._storage[key];
            }
            return val;
        }),

        exists: Promise.method(function(key) {
            return (typeof this._storage[key] !== "undefined");
        }),

        dispose: function() {
            if (this._guard.applied("disposed")) {
                return;
            }
            this._storage = {};
            this._guard.apply("disposed");
        }
    });

    return AsyncInMemoryStore;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/state-guard")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/state-guard"
    ], factory);
}

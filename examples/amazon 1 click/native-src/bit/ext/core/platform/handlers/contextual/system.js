var factory = function(
    _,
    $options,
    $lang,
    FilteringDispatcher
) {

    "use strict";

    var SystemHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(SystemHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._manager = opts.getOrError("manager");
            this._dispatcher = new FilteringDispatcher({
                namespace: "Contextual",
                delegate: this
            });            
            this._registryCtx = null;
        },

        // We're going to assume that we're only ever
        // registered with a single registry. If that's ever
        // not the case, keep track of multiple registries here...
        wasRegistered: function(registryCtx) {
            this._registryCtx = registryCtx;
        },

        // ... and here.
        wasDeregistered: function(registryCtx) {
            this._registryCtx = null;
        },

        /**
         *  Messages coming in via #handle are dispatched
         *  using the FilteringDispatcher. Contextual.RestartHost
         *  gets dispatched to #onMsgCreateSandbox, etc.
         *
         */
        handle: function(ctx, api, argsObj, cb) {
            // Only dispatch if we have a registryCtx.
            if (this._registryCtx) {
                this._dispatcher.dispatch(ctx, api, argsObj, cb);
            }
        },

        /**
         *  onMsgRestartHost - responder to Contextual.RestartHost message
         */
        onMsgRestartHost: function(ctx, args, cb) {
            this._manager.cycle();
        },

        /**
         *  onMsgHostPing - responder to Contextual.HostIsAlive message
         */
        onMsgHostPing: function(ctx, args, cb) {
            this._manager.hostPing();
        }

    });

    return SystemHandler;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/commons/lang"),
        require("bit/ext/core/platform/handlers/util/filtering-dispatcher")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/commons/lang",
        "bit/ext/core/platform/handlers/util/filtering-dispatcher"
    ], factory);
}
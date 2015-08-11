var factory = function(
    _,
    $options,
    $lang,
    FilteringDispatcher
) {

    "use strict";

    var StyleHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(StyleHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._peerController = opts.getOrError("peerController");
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
         *  using the FilteringDispatcher. Contextual.ApplyStyle
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
         *  onMsgApplyStyle - responder to Contextual.ApplyStyle message
         */
        onMsgApplyStyle: function(ctx, args, cb) {
            var externalId = args.externalId,
                styleSpec = args.styleSpec;

            this._peerController.applyStyle(externalId, styleSpec, function(err, styleHandle) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }
                cb(null, styleHandle);
            });

        },
        /**
         * onMsgResetStyle - responder to Contextual.ResetStyle message
         */
        onMsgResetStyle: function(ctx, args, cb) {
            var externalId = args.externalId,
                handle = args.handle;

            this._peerController.resetStyle(externalId, handle, cb);
        }
    });

    return StyleHandler;
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
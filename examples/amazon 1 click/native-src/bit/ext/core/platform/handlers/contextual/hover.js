var factory = function(
    _,
    $options,
    $lang,
    FilteringDispatcher
) {

    var HoverHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(HoverHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._peerController = opts.getOrError("peerController");
            this._dispatcher = new FilteringDispatcher({
                namespace: "Contextual",
                delegate: this
            });
            this._platformMessageBus = opts.getOrError("platformMessageBus");
            _.bindAll(this, "_filterAndNotify");
            this._platformMessageBus.subscribe(this._filterAndNotify);
            this._registryCtx = null;
        },

        _filterAndNotify: function(msg) {
            if (!this._registryCtx ||
                !msg || msg.mType !== "platformEvent" ||
                msg.eventName !== "Contextual.ExternalMessage") {
                return;
            }

            // Of the ExternalMessage types, we only care about UBPHoverA2WL for now:
            // Example of msg format:
            // {
            //     mType: "platformEvent",
            //     eventName: "Contextual.ExternalMessage",
            //     args: {
            //         externalId: 123,
            //         data: {
            //             mType: "UBPHoverA2WL",
            //             data: {
            //                 page: {
            //                     url: 'http://www.google.com',
            //                     width: 1600
            //                 },
            //                 image: {
            //                     src: 'http://www.google.com/images/logo.png',
            //                     height: 95,
            //                     width: 269
            //                 }
            //             }
            //         }
            //     }
            // }

            // Unwrap, re-wrap as a registry message
            if (msg.args.externalId && msg.args.data.mType === "UBPHoverA2WL") {
                this._registryCtx.notify("Contextual.HoverA2WL", {
                    externalId: msg.args.externalId,
                    page: msg.args.data.data.page,
                    image: msg.args.data.data.image,
                });
            }
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
         *  using the FilteringDispatcher. Contextual.HoverInject
         *  gets dispatched to #onMsgHoverInject, etc.
         *
         */
        handle: function(ctx, api, argsObj, cb) {
            // Only dispatch if we have a registryCtx.
            if (this._registryCtx) {
                this._dispatcher.dispatch(ctx, api, argsObj, cb);
            }
        },

        /**
         *  onMsgHoverInject - responder to Contextual.HoverInject message
         */
        onMsgHoverInject: function(ctx, args, cb) {
            var externalId = args.externalId,
                config = args.config;

            this._peerController.injectScript(externalId, config, function(err, notificationHandle) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }
                cb(null, notificationHandle);
            });
        }
    });

    return HoverHandler;
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

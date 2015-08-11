var factory = function(
    _,
    $options,
    $lang,
    FilteringDispatcher
) {

    var ContentHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ContentHandler.prototype, {
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


            // Of the ExternalMessage types, we only care about the following for now:
            // sandboxMessage

            // Example of msg format:
            // {
            //     mType: "platformEvent",
            //     eventName: "Contextual.ExternalMessage",
            //     args: {
            //         externalId: 123,
            //         data: {
            //             mType: "sandboxMessage",
            //             handle: "Notif-123",
            //             data: {}
            //         }
            //     }
            // }

            // Unwrap, re-wrap as a registry message
            if (msg.args.externalId && msg.args.data.mType === "UBPSandboxMessage") {
                this._registryCtx.notify("Contextual.SandboxMessage", {
                    externalId: msg.args.externalId,
                    handle: msg.args.data.handle,
                    data: msg.args.data.data
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
         *  using the FilteringDispatcher. Contextual.CreateSandbox
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
         *  onMsgCreateSandbox - responder to Contextual.CreateSandbox message
         */
        onMsgCreateSandbox: function(ctx, args, cb) {
            var externalId = args.externalId,
                spec = args.sandboxSpecification;

            this._peerController.createSandbox(externalId, spec, function(err, notificationHandle) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }
                cb(null, notificationHandle);
            });

        },
        /**
         * onMsgModifySandbox - responder to Contextual.ModifySandbox
         */
        onMsgModifySandbox: function(ctx, args, cb) {
            var externalId = args.externalId,
                handle = args.handle,
                spec = args.sandboxSpecification;

            this._peerController.modifySandbox(externalId, handle, spec, cb);
        },
        /**
         * onMsgDestroySandbox - responder to Contextual.DestroySandbox
         */
        onMsgDestroySandbox: function(ctx, args, cb) {
            var externalId = args.externalId,
                handle = args.handle;
            this._peerController.destroySandbox(externalId, handle, cb);
        }
    });


    return ContentHandler;

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



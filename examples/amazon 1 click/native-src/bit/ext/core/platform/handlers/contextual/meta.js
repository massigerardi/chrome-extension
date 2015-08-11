var factory = function(
    _,
    $options,
    FilteringDispatcher
) {

    "use strict";

    var MetaHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(MetaHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._peerController = opts.getOrError("peerController");
            this._dispatcher = new FilteringDispatcher({
                namespace: "Contextual",
                delegate: this
            });

            this._registryCtx = null;
        },
        wasRegistered: function(registryCtx) {
            this._registryCtx = registryCtx;
        },
        wasDeregistered: function() {
            this._registryCtx = null;
        },
        handle: function(ctx, api, argsObj, cb) {
            if(this._registryCtx) {
                this._dispatcher.dispatch(ctx, api, argsObj, cb);
            }
        },
        onMsgGetPageLocationData: function(ctx, args, cb) {
            var externalId = args.externalId;
            this._peerController.getPageLocationData(externalId, cb);
        },
        onMsgGetPerformanceTimingData: function(ctx, args, cb) {
            var externalId = args.externalId;
            this._peerController.getPerformanceTimingData(externalId, cb);
        },
        onMsgGetPageDimensionData: function(ctx, args, cb) {
            var externalId = args.externalId;
            this._peerController.getPageDimensionData(externalId, cb);
        }
    });

    return MetaHandler;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/ext/core/platform/handlers/util/filtering-dispatcher")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/ext/core/platform/handlers/util/filtering-dispatcher"
    ], factory);
}

var factory = function(
    _,
    ContextualPeerController
) {
    var MetaPeerController = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(MetaPeerController.prototype, ContextualPeerController.prototype, {
        initialize: function(opts) {
            ContextualPeerController.prototype.initialize.apply(this, arguments);
        },
        getPageLocationData: function(externalId, cb) {
            this.sendMessage(externalId, {
                mType: "UBPMetaGetPageLocationData"
            }, cb);
        },
        getPerformanceTimingData: function(externalId, cb) {
            this.sendMessage(externalId, {
                mType: "UBPMetaGetPerformanceTimingData"
            }, cb);
        },
        getPageDimensionData: function(externalId, cb) {
            this.sendMessage(externalId, {
                mType: "UBPMetaGetPageDimensionData"
            }, cb);
        }
    });

    return MetaPeerController;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/ext/core/platform/contextual-peer-controller")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/ext/core/platform/contextual-peer-controller"
    ], factory);
}

var factory = function(
    _,
    ContextualPeerController
) {

    var HoverPeerController = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(HoverPeerController.prototype, ContextualPeerController.prototype, {
        initialize: function(opts) {
            // Parent initializer, since we're overriding
            ContextualPeerController.prototype.initialize.apply(this, arguments);
        },

        /**
         * injectScript
         *
         * @param {object} externalId - Opaque window/tab ID. Provided by
         *                              runtime when a new tab is initially open.
         *
         * @param {object} config     - Configuration data, see hover-library.js
         *
         * @param {function} cb       - Callback. Expected format:
         *                              function(err, handle) {}
         *                              `handle` must be used to address this
         *                              event and remove it when needed.
         */
        injectScript: function(externalId, config, cb) {
            this.sendMessage(externalId, {
                mType: "UBPHoverInject",
                config: config
            }, cb);
        }
    });

    return HoverPeerController;
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

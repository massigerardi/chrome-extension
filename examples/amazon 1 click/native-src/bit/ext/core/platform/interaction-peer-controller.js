var factory = function(
    _,
    $options,
    ContextualPeerController
) {
    var InteractionPeerController = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(InteractionPeerController.prototype, ContextualPeerController.prototype, {
        initialize: function(opts) {
            ContextualPeerController.prototype.initialize.apply(this, arguments);
            opts = $options.fromObject(opts);
        },

        /**
         * registerPageBodyClick
         *
         * @param {object} externalId - Opaque window/tab ID. Provided by
         *                              runtime when a new tab is initially open.
         *
         * @param {function} cb       - Callback. Expected format:
         *                              function(err, handle) {}
         *                              `handle` must be used to address this
         *                              event and remove it when needed.
         */
        registerPageBodyClick: function(externalId, cb) {
            this.sendMessage(externalId, {
                mType: "UBPInteractionRegisterPageBodyClick"
            }, cb);
        },

        /**
         * deregisterMultipleEvents
         *
         * @param {object} externalId - Opaque window/tab ID. Provided by
         *                              runtime when a new tab is initially open.
         *
         * @param {object} handle     - Handle of the events to be deregistered.
         *
         * @param {function} cb       - Callback.
         */
        deregisterMultipleEvents: function(externalId, handle, cb) {
            this.sendMessage(externalId, {
                mType: "UBPInteractionDeregisterMultipleEvents",
                handle: handle
            }, cb);
        }
    });

    return InteractionPeerController;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/ext/core/platform/contextual-peer-controller")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/ext/core/platform/contextual-peer-controller"
    ], factory);
}
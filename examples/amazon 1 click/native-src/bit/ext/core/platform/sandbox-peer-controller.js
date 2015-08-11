var factory = function(
    _,
    $options,
    ContextualPeerController
) {
    var SandboxPeerController = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(SandboxPeerController.prototype,
             ContextualPeerController.prototype,
    {
        initialize: function(opts) {
            ContextualPeerController.prototype.initialize.apply(this, arguments);
            opts = $options.fromObject(opts);
        },
        /**
         * createNotification
         *
         * @param {object} externalId - Opaque window/tab ID. Provided by
         *                              runtime when a new tab is initially open.
         *
         * @param {object} notifOpts  - Options to be passed to the notifiction library.
         *                             @see embedded-notification-library.js for supported options
         *
         * @param {function} cb       - Callback. Expected format:
         *                                  function(err, notificationHandle) {}
         *                              `notificationHandle` must be used to address this
         *                              notification via the MessageIframe API.
         */
        createSandbox: function(externalId, sandboxSpec, cb) {
            this.sendMessage(externalId, {
                mType: "UBPSandboxCreateSandbox",
                sandboxSpecification: sandboxSpec
            }, cb);
        },

        modifySandbox: function(externalId, handle, sandboxSpec, cb) {
            this.sendMessage(externalId, {
                mType: "UBPSandboxModifySandbox",
                handle: handle,
                sandboxSpecification: sandboxSpec
            }, cb);
        },

        destroySandbox: function(externalId, handle, cb) {
            this.sendMessage(externalId, {
                mType: "UBPSandboxDestroySandbox",
                handle: handle
            }, cb);
        },

        addWhitelistedOrigin: function(externalId, origin, cb) {
            this.sendMessage(externalId, {
                mType: "UBPSandboxAddWhitelistedOrigin",
                origin: origin
            }, cb);
        }

    });

    return SandboxPeerController;
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

var factory = function(
    _,
    $options,
    ContextualPeerController
) {

    "use strict";

    var StylePeerController = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(StylePeerController.prototype, ContextualPeerController.prototype, {
        initialize: function(opts) {
            ContextualPeerController.prototype.initialize.apply(this, arguments);
            opts = $options.fromObject(opts);
        },

        /**
         * applyStyle
         *
         * @param {object} externalId - Opaque window/tab ID. Provided by
         *                              runtime when a new tab is initially open.
         *
         * @param {object} styleSpec  - See style-library for format.
         *
         * @param {function} cb       - Callback. Expected format:
         *                              function(err, styleHandle) {}
         *
         */
        applyStyle: function(externalId, styleSpec, cb) {
            this.sendMessage(externalId, {
                mType: "UBPStyleApplyStyle",
                styleSpec: styleSpec
            }, cb);
        },

        /**
         * resetStyle
         *
         * @param {object} externalId - Opaque window/tab ID. Provided by
         *                              runtime when a new tab is initially open.
         *
         * @param {object} handle     - Handle of the style to be reset.
         *
         * @param {function} cb       - Callback. Expected format:
         *                              function() {}
         *
         */
        resetStyle: function(externalId, handle, cb) {
            this.sendMessage(externalId, {
                mType: "UBPStyleResetStyle",
                handle: handle
            }, cb);
        }

    });

    return StylePeerController;
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
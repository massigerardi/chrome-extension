var factory = function(
    _,
    ContextualPeerController
) {

    var ScraperPeerController = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ScraperPeerController.prototype, ContextualPeerController.prototype, {
        initialize: function(opts) {
            // Parent initializer, since we're overriding
            ContextualPeerController.prototype.initialize.apply(this, arguments);
        },

        /**
         * scrapeContent
         *
         * @param {object} externalId - Opaque window/tab ID. Provided by
         *                              runtime when a new tab is initially open.
         *
         * @param {object} specification - Scraper specification
         *
         * @param {function} cb       - Callback. Expected format:
         *                              function(err, handle) {}
         *                              `handle` must be used to address this
         *                              event and remove it when needed.
         */
        scrapeContent: function(externalId, specification, cb) {
            this.sendMessage(externalId, {
                mType: "UBPScraperScrape",
                scraperSpecification: specification
            }, cb);
        }
    });

    return ScraperPeerController;
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
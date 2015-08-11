var factory = function(
    _,
    $options,
    $lang,
    FilteringDispatcher
) {

    /**
     * Platform API Handler
     *
     * API: "Contextual.ScrapeContent"
     * API Params:
     *     {any} externalId                   - opaque identifier for the tab. This is
     *                                          provided to the caller by the
     *                                          Contextual.PageTurn notification.
     *     {ScraperSpec} scraperSpecification - describes the content we desire to scrape.
     */

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
         *  using the FilteringDispatcher. Contextual.ScrapeContent
         *  gets dispatched to #onMsgScrapeContent, etc.
         *
         */
        handle: function(ctx, api, argsObj, cb) {
            // Only dispatch if we have a registryCtx.
            if (this._registryCtx) {
                this._dispatcher.dispatch(ctx, api, argsObj, cb);
            }
        },

        /**
         *  onMsgScrapeContent - responder to Contextual.ScrapeContent message
         */
        onMsgScrapeContent: function(ctx, args, cb) {
            var externalId = args.externalId,
                specification = args.scraperSpecification;

            this._peerController.scrapeContent(externalId, specification, function(err, content) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }
                cb(null, content);
            });
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
/**
 *  A "contextual peer" is a script that runs in the context of a page, e.g., the detail page of walmart.com.
 *  These peer scripts typically run in a different execution sandbox, with a different lifecycle.
 *  The job of the ContextualPeerController is to manage the preparation and invocation of functionality offered
 *  by these peers.
 *
 *  For example, in order to scrape the contents of a page, two scripts must be loaded: one is a "scraper library" -
 *  the pure-JS, runtime-agnostic code that does the actual work of scraping the page when requested. The second is
 *  the "driver", which does the work of using runtime-specific mechanisms to field requests to scrape the page,
 *  invokes the scraper library, and again uses the runtime-specific mechanisms to return the response to the caller.
 *
 *  This "library and driver" model is used for all contextual peer functionality, as it provides reuse of the core library
 *  across runtimes.
 *
 *  The job of the ContextualPeerController, then, is to ensure that the library and driver have been loaded, and ultimately
 *  ferrying the request between the caller and the library. Generally, there is one peer controller per library.
 *
 *  In most cases, you'll probably "sub-class" ContextualPeerController and provide a more semantic interface
 *  to the functionality you're peered with. See ScraperPeerController for an example.
 *
 * The right way to setup the "library and driver" model is:
 *      new ContextualPeerController({
 *          contentScripts: ["libraryFile", "driverFile"],
 *          executeScript: function() {},
 *          sendMessage: function() {}
 *      });
 */

DEFAULT_EXECUTE_SCRIPT = function(externalId, scriptFile, cb) {
    cb(new Error("Default executeScript is a dud - please provide one to the ContextualPeerController"));
};

DEFAULT_SEND_MESSAGE = function(externalId, msg, cb) {
    cb(new Error("Default sendMessage is a dud - please provide one to the ContextualPeerController"));
};

var factory = function(
    _,
    $options,
    Flow,
    $lang,
    CountdownLatch,
    ReadyGate
) {
    var ContextualPeerController = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ContextualPeerController.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);

            this._contentScripts = opts.getOrError("contentScripts");
            this._executeScript = opts.getOrElse("executeScript", DEFAULT_EXECUTE_SCRIPT);
            this._sendMessage = opts.getOrElse("sendMessage", DEFAULT_SEND_MESSAGE);

            this._prepareGates = {};
        },
        _getPreparedGate: function(externalId) {
            if (!this._prepareGates[externalId]) {
                this._prepareGates[externalId] = new ReadyGate();
                this._prepareGates[externalId].gated(_.bind(function() {
                    this._prepare(externalId, this._prepareGates[externalId].handler());
                }, this));
            }
            return this._prepareGates[externalId];
        },
        _prepare: function(externalId, cb) {
            var latch = new CountdownLatch(this._contentScripts.length, _.bind(function(err) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }
                cb();
            }, this));

            _.map(this._contentScripts, _.bind(function(contentScript) {
                this._executeScript(externalId, contentScript, function(err) {
                    if (err) {
                        latch.error(err);
                        return;
                    }
                    latch.step();
                });
            }, this));
        },
        sendMessage: function(externalId, msg, cb) {
            var gate = this._getPreparedGate(externalId);
            gate.onReady(_.bind(function(err) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }
                this._sendMessage(externalId, msg, cb);
            }, this));
        },
        resetState: function(externalId) {
            if (this._prepareGates[externalId]) {
                delete this._prepareGates[externalId];
            }
        }
    });

    return ContextualPeerController;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/commons/flow"),
        require("bit/commons/lang"),
        require("bit/commons/countdown-latch"),
        require("bit/commons/ready-gate")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/commons/flow",
        "bit/commons/lang",
        "bit/commons/countdown-latch",
        "bit/commons/ready-gate"
    ], factory);
}
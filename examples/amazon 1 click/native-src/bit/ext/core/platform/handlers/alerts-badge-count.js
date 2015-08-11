var factory = function(
    _,
    Promise,
    $options,
    $lang,
    FilteringDispatcher,
    AlertsBadgeController
    ) {
    // Let's callers peer into extension configuration

    var AlertsBadgeCountHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(AlertsBadgeCountHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._dispatcher = new FilteringDispatcher({
                namespace: "AlertsBadge",
                delegate: this
            });

            this._runtime = opts.getOrError("runtime");
            this._simpleStorage = opts.getOrError("simpleStorage");
            this._alertsBadgeController = new AlertsBadgeController({
                "runtime" : this._runtime,
                "simpleStorage" : this._simpleStorage
            });
        },
        handle: function(ctx, api, argsObj, cb) {
            this._dispatcher.dispatch(ctx, api, argsObj, cb);
        },
        onMsgSetCount: function(ctx, args, cb) {
            if (args && args.count) this._alertsBadgeController.setAlertsBadgeCount(args.count);
            cb();
        },
        onMsgGetCount: function (ctx, args, cb) {
            Promise.bind(this)
            .then(function () {
                return this._alertsBadgeController.getAlertsBadgeCount();
            })
            .then(function (count) {
                cb(null,count);
            });

        }
    });

    return AlertsBadgeCountHandler;
};



if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/lang"),
        require("bit/ext/core/platform/handlers/util/filtering-dispatcher"),
        require("bit/ext/core/components/alerts-badge-controller")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/lang",
        "bit/ext/core/platform/handlers/util/filtering-dispatcher",
        "bit/ext/core/components/alerts-badge-controller"
    ], factory);
}



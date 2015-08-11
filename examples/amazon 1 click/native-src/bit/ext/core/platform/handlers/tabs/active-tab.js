var factory = function(
    _,
    $options,
    $lang
    ) {
    // Let's callers peer into extension configuration

    var ActiveTabHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ActiveTabHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);

            this._runtime = opts.getOrError("runtime");
        },
        handle: function(ctx, api, argsObj, cb) {
            this._runtime.getActiveTabId(cb);
        },
        onMsgGetActiveTabId: function(ctx, args, cb) {
            this._runtime.getActiveTab(cb);
        }
    });

    return ActiveTabHandler;
};



if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/commons/lang")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/commons/lang"
    ], factory);
}



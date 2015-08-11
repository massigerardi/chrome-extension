var factory = function(
    _,
    $options,
    $lang,
    FilteringDispatcher
) {
    // Let's callers peer into extension configuration

    var UserSettingsHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(UserSettingsHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);

            this._delegate = opts.getOrError("delegate");
            this._dispatcher = new FilteringDispatcher({
                namespace: "UserSettings",
                delegate: this
            });
        },
        handle: function(ctx, api, argsObj, cb) {
            this._dispatcher.dispatch(ctx, api, argsObj, cb);
        },
        // Returns only information necessary for remote endpoint to
        // determine attribution data. Does not include ref or tag values
        onMsgOpenSettings: function(ctx, args, cb) {
            this._delegate.openSettings(args, function(err) {
                cb(err);
            });
        }
    });

    return UserSettingsHandler;
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



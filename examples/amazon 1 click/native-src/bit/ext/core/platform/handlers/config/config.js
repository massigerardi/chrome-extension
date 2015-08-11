var factory = function(
    _,
    $options,
    $lang,
    FilteringDispatcher
) {
    // Let's callers peer into extension configuration
    var LOCALES_KEY = "locales";

    var ConfigHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ConfigHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            // No peer controller!
            this._configurationManager = opts.getOrError("configurationManager");
            this._dispatcher = new FilteringDispatcher({
                namespace: "Config",
                delegate: this
            });
        },
        handle: function(ctx, api, argsObj, cb) {
            this._dispatcher.dispatch(ctx, api, argsObj, cb);
        },
        // Returns only information necessary for remote endpoint to
        // determine attribution data. Does not include ref or tag values
        onMsgGet: function(ctx, args, cb) {
            var key = args.key;
            if (!key) {
                cb(new Error("Valid key is required"));
                return;
            }
            this._configurationManager.get(key, cb);
        },
        onMsgGetLocaleSpecificConfig: function(ctx, args, cb) {
            var locale = args.locale,
                subKey = args.key;

            if (!locale || !subKey) {
                cb(new Error("Locale and key are required"));
                return;
            }

            this._configurationManager.get(LOCALES_KEY, function(err, config) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }

                if (!config[locale]) {
                    // DNE
                    cb();
                    return;
                }

                cb(null, config[locale][subKey]);
            });
        }
    });

    return ConfigHandler;
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



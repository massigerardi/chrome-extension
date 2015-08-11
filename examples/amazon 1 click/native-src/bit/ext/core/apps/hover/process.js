var factory = function(
    _,
    Promise,
    $options,
    QueryStringMap,
    HoverSpawner,
    ConfigurationManager
) {
    // Remote process hosting the Hover Add to Wish List feature
    var HoverProcess = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(HoverProcess.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);

            this._localeDelegate = opts.getOrError("localeDelegate");
            this._sandboxDelegate = opts.getOrError("sandboxDelegate");
            this._transportStyle = opts.getOrError("transportStyle");
            this._transportStrategyOptions = opts.getOrError("transportStrategyOptions");
            this._config = opts.getOrError("config");
            this._platformCode = opts.getOrError("platformCode");
            this._tokenVendor = opts.getOrError("tokenVendor");
            this._processManager = opts.getOrError("processManager");
            this._platformService = opts.getOrError("platformService");

            this._spawner = new HoverSpawner({
                sandboxDelegate: this._sandboxDelegate,
                transportStyle: this._transportStyle,
                transportStrategyOptions: this._transportStrategyOptions
            });

            this._configMgr = new ConfigurationManager({
                config: this._config
            });
        },

        // Start the Hover process
        start: Promise.method(function() {
            this._configMgr.start();
            return this._startProcess();
        }),

        _getLocale: function() {
            return new Promise(_.bind(function(resolve, reject) {
                this._localeDelegate.getLocale(function(result) {
                    resolve(result);
                });
            }, this));
        },

        _startProcess: function() {
            return Promise.bind({
                app: this
            }).then(function() {
                // Step 1: Get the locale
                return this.app._getLocale();
            }).then(function(locale) {
                // Step 2: Get the configuration for the locale
                this.currentLocale = locale;
                return this.app._configMgr.getAsync("locales");
            }).then(function(locales) {
                return locales[this.currentLocale];
            }).then(function(config) {
                // Step 3: Validate the locale's config
                this.config = config;
                if (!config ||
                    !config.knobValue ||
                    !config.knobValue[this.app._platformCode] ||
                    !config.sandboxUrl ||
                    !config.hoverHostUrl ||
                    !config.hoverConfigUrl
                    ) {
                    throw new Error("Hover: Missing configuration values.");
                }
            }).then(function() {
                // Step 4: Check the dial up weblab
                return this.app._tokenVendor.verifyTokenAsync("Hover",
                    this.config.knobValue[this.app._platformCode]);
            }).then(function(isActive) {
                // Step 5:  Spawn hover
                if(!isActive) {
                    throw new Error("Hover: Not available for this installation.");
                }
            }).then(function() {
                var qs = new QueryStringMap({
                    queryParams: {
                        configUrl: this.config.hoverConfigUrl,
                        sandboxUrl: this.config.sandboxUrl
                    }
                }).toQueryString();

                return this.app._processManager.spawn(this.app._spawner, {
                    url: this.config.hoverHostUrl + qs
                });
            }).then(function(pid) {
                // Step 6: Connect to platform service
                // Make sure we still have an exchange
                var exchange = pid.exchange();
                if (exchange) {
                    return this.app._platformService.clientConnectExchangeAsync("RemotePlatform:RemoteProcessDelegate:Hover", exchange);
                } else {
                    throw new Error("Cannot connect process to PlatformService - no MessageExchange available: ", pid.id());
                }
            }).catch(function(e) {
                return Promise.resolve(null);
            });
        }
    });

    return HoverProcess;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/query-string-map"),
        require("bit/ext/core/apps/hover/spawner"),
        require("bit/ext/core/components/configuration-manager")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/query-string-map",
        "bit/ext/core/apps/hover/spawner",
        "bit/ext/core/components/configuration-manager"
    ], factory);
}

var factory = function(
    _,
    Promise,
    $lang,
    $options,
    QueryStringMap,
    PlatformService,
    ProcessManager,
    ConfigurationManager,

    // Apps
    TitanSpawner,

    // Special-case handler for ProductCompassManager
    SystemHandler
) {

    /**
     * The purpose of the OneButtonApp is to provide a runtime-agnostic, testable,
     * logical representation of the 1Button application. Runtime-specific
     * dependencies are provided at instantiation time.
     */
    var OneButtonApp = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(OneButtonApp.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._platformServiceBootstrapper = opts.getOrError("platformServiceBootstrapper");
            this._sandboxDelegate = opts.getOrError("sandboxDelegate");
            this._localeDelegate = opts.getOrError("localeDelegate");
            this._transportStyle = opts.getOrError("transportStyle");
            this._transportStrategyOptions = opts.getOrError("transportStrategyOptions");
            this._productCompassManager = opts.getOrError("productCompassManager");
            this._platformCode = opts.getOrError("platformCode");
            this._tokenVendor = opts.getOrError("tokenVendor");
            this._featureConfigs = opts.getOrError("featureConfigs");
            this._simpleStorage = opts.getOrError("simpleStorageDelegate");
            this._pinger = opts.getOrError("pinger");
            this._guidManager = opts.getOrError("guidManager");
            this._runtime = opts.getOrError("runtime");

            this._platformService = null;
            this._processManager = null;
        },

        /**
         * Starts the OneButtonApp
         *
         * "Starting" consists of bootstrapping and starting the PlatformService,
         * bootstrapping and starting the ProcessManager, starting any initial
         * "apps", and finally, taking care of the (currently) special-case
         * of wiring up the ProductCompassManager to the PlatformService.
         */
        start: function(cb) {
            return Promise.bind(this)
                .then(function() {
                    return this._bootstrapPlatformService();
                })
                .then(function() {
                    return this._startPlatformService();
                })
                // start PComp first
                .then(function() {
                    return this._registerProductCompassSystemHandler();
                })
                .then(function() {
                    // In the interest of keeping things "simple",
                    // ProductCompassManager is managed independently
                    // for now. The intent is to convert it to
                    // a "process" at some point.
                    return this._wireProductCompassManager();
                })
                .then(function() {
                    return this._productCompassManager.cycle();
                })
                // now start other apps
                .then(function() {
                    return this._bootstrapProcessManager();
                })
                .then(function() {
                    return this._startProcessManager();
                })
                .then(function() {
                    return this._startInitialProcesses();
                })
                .catch(function (err) {
                    console.log("Error caught during OneButtonApp#start(): " + err);
                })
                .nodeify(cb);
        },

        /**
         * Stops the OneButtonApp
         *
         * "Stopping" consists of doing the corresponding teardown of items
         * required to "Start", but in reverse order.
         */
        stop: function(cb) {
            return Promise.bind(this)
                .then(function() {
                    return this._unwireProductCompassManager();
                })
                .then(function() {
                    return this._unregisterProductCompassSystemHandler();
                })
                .then(function() {
                    return this._stopPlatformService()
                })
                .then(function() {
                    return this._stopProcessManager();
                })
                .nodeify(cb);
        },

        _bootstrapPlatformService: Promise.method(function() {
            return Promise.bind(this)
                .then(function() {
                    return this._platformServiceBootstrapper.bootstrap();
                }).then(function(service) {
                    this._platformService = service;
                });
        }),

        _startPlatformService: Promise.method(function() {
            return this._platformService.start();
        }),

        _stopPlatformService: Promise.method(function() {
            return this._platformService.stop();
        }),

        _bootstrapProcessManager: Promise.method(function() {
            // TODO: Config?
            this._processManager = new ProcessManager();
        }),

        _startProcessManager: Promise.method(function() {
            return this._processManager.start();
        }),

        _stopProcessManager: Promise.method(function() {
            return this._processManager.stop();
        }),

        _startInitialProcesses: Promise.method(function() {
            return Promise.settle([
                this._startTitan()
                // other processes here
            ]);
        }),

        _startTitan: Promise.method(function() {
            var getLocale = Promise.promisify(_.bind(function(cb) {
                this._localeDelegate.getLocale(function(result) {
                    cb(null, result);
                });
            }, this));
            // TODO: Get list of initial processes to start
            // (from config)
            var titanSpawner = new TitanSpawner({
                sandboxDelegate: this._sandboxDelegate,
                transportStyle: this._transportStyle,
                transportStrategyOptions: this._transportStrategyOptions
            });

            // TODO: Make the second paramt to spawn() an app config, pulled
            // from an app config vendor.

            // TODO: The dcEndpoint parameter will go away after integration.
            // Instead, each stage will know which dcEndpoint to point to.
            var titanConfigMgr = new ConfigurationManager({
                config: this._featureConfigs["titan"]
            });
            titanConfigMgr.start();
            return Promise.bind({
                // Local context for this Promise chain
                app: this
            }).then(function() {
                // Step 1: Get the locale
                return getLocale();
            }).then(function(locale) {
                // Step 2: Get the configuration for the locale
                this.currentLocale = locale;
                return titanConfigMgr.getAsync("locales");
            }).then(function(locales) {
                return locales[this.currentLocale];
            }).then(function(config) {
                // Step 3: Validate the config file
                if (!config ||
                    !config.knobValue ||
                    !config.knobValue[this.app._platformCode] ||
                    !config.dcEndpointUrl ||
                    !config.titanHostUrl
                ) {
                    throw new Error("Titan: Missing configuration values. Mandatory values: knobValue, dcEndpointUrl, titanHostUrl.");
                }

                this.config = config;
            }).then(function() {
                // Step 4: Check the dial up weblab
                return this.app._tokenVendor.verifyTokenAsync("Titan", 
                    this.config.knobValue[this.app._platformCode]);
            }).then(function(isActive) {
                // Step 5:  Spawn titan
                if(!isActive) {
                    throw new Error("Titan: Not available for this installation.");
                }
                var qs = new QueryStringMap({
                    queryParams: {
                        dcEndpoint: this.config.dcEndpointUrl
                    }
                }).toQueryString();

                return this.app._processManager.spawn(titanSpawner, {
                    url: this.config.titanHostUrl + qs
                });
            }).then(function(pid) {
                // Step 6: Connect to platform service
                // Make sure we still have an exchange
                var exchange = pid.exchange();
                if (exchange) {
                    return this.app._platformService.clientConnectExchangeAsync("RemotePlatform:RemoteProcessDelegate:Titan", exchange);
                } else {
                    throw new Error("Cannot connect process to PlatformService - no MessageExchange available: " + pid.id());
                }
            }).catch(function(e) {
                return Promise.resolve(null);
            });
        }),

        _registerProductCompassSystemHandler: function(cb) {
            // For some reason, we decided to add a Platform API to
            // explicitly cycle the ProductCompassManager. Hopefully
            // once the ProductCompassManager is ported to be a
            // RemoteProcess, this can hopefully go away.
            return Promise.bind(this)
                .then(function() {
                    this._systemHandler = new SystemHandler({
                        manager: this._productCompassManager
                    });
                    var registry = Promise.promisifyAll(this._platformService.registry());
                    return Promise.all([
                        registry.registerAsync("Contextual.HostPing", this._systemHandler),
                        registry.registerAsync("Contextual.RestartHost", this._systemHandler)
                    ]);
                }).nodeify(cb);
        },

        _unregisterProductCompassSystemHandler: function(cb) {
            var registry = Promise.promisifyAll(this._platformService.registry());
            return Promise.all([
                registry.deregisterAsync("Contextual.HostPing"),
                registry.deregisterAsync("Contextual.RestartHost")
            ]).nodeify(cb);
        },

        // TODO: This needs rethinking. It's a race as to when the
        // transport will actually be bound to an underlying frame. Unlike
        // processes which have externally-enforced handshake/heartbeat semantics,
        // this dude is in charge of all that internally
        _wireProductCompassManager: Promise.method(function() {
            var exchange = this._productCompassManager.exchange();
            return this._platformService.clientConnectExchangeAsync("RemotePlatform:RemoteProcessDelegate:PComp", exchange);
        }),

        _unwireProductCompassManager: Promise.method(function() {
            return this._platformService.clientDisconnectAsync("RemotePlatform:RemoteProcessDelegate:PComp");
        }),


    });

    return OneButtonApp;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/lang"),
        require("bit/commons/options"),
        require("bit/commons/query-string-map"),
        require("bit/ext/core/platform/platform-service"),
        require("bit/os/process-manager"),
        require("bit/ext/core/components/configuration-manager"),
        require("bit/ext/core/apps/titan/spawner"),
        require("bit/ext/core/platform/handlers/contextual/system")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/lang",
        "bit/commons/options",
        "bit/commons/query-string-map",
        "bit/ext/core/platform/platform-service",
        "bit/os/process-manager",
        "bit/ext/core/components/configuration-manager",
        "bit/ext/core/apps/titan/spawner",
        "bit/ext/core/platform/handlers/contextual/system"
    ], factory);
}

var factory = function(
    _,
    Promise,
    $lang,
    $options,
    $taskManager,
    Flow,
    Events,
    S3Client,
    XHRClient,
    SDKRequestClient
) {

    "use strict";

    /**
     * ConfigurationManager
     *
     * This module merges the local and remote configuration (stored in S3). It makes
     * this configuration available through the ConfigurationManager.get() API.
     *
     * In the current use case, the remote configuration is stored as a publicly available
     * JSON object in S3. The ConfigurationManager._pullRemoteConfig() logic should move out
     * of this module and should be generalized in case we need to fetch configuration from
     * remote locations other than a publicly available S3 object.
     *
     * You can create a ConfigurationManager as follows:
     * var configMgr = new ConfigurationManager({
     *      config: {
     *          remoteConfigObjectUrl: "http://s3/object",
     *          ...
     *      }
     * });
     *
     * NOTE: Remote values have higher precedence than values provided above.
     */
    var ConfigurationManager = function() {
        this.initialize.apply(this, arguments);
    };

    var CONSTANTS = {
        CONFIG_REFRESH_INTERVAL: 30 * 60 * 1000 // 30 minutes
    };

    _.extend(ConfigurationManager.prototype, Events, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._localConfig = opts.getOrError("config");
            this._remoteConfig = {};
            this._config = _.extend({},this._localConfig);
            this._isReady = false;
            this._error = null;
            _.bindAll(this, "_pullRemoteConfig", "_schedulePullRemoteConfig");
            this._pullRemoteConfigOnce = _.once(this._pullRemoteConfig);
            this._pullTimeout = null;
            this._stopRequested = false;
        },

        start: function() {
            this._stopRequested = false;
            //previous implementation meant start() spawned a new timeout each call.. 
            if (this._pullTimeout !== null) return;
            this._pullTimeout = $taskManager.scheduleTask(this._schedulePullRemoteConfig, CONSTANTS.CONFIG_REFRESH_INTERVAL);
        },
        stop: function() {
            if (this._pullTimeout !== null) {
                $taskManager.cancelTask(this._pullTimeout);
                this._pullTimeout = null;
            }
            this._stopRequested = true;
        },

        /**
         * Get the value from the configuration manager. It can be used as follows:
         *
         * get("foo", function(err, value) {
         *      // Check err and do something cool with value.
         * });
         */
        get: function(key, cb) {
            if (this._isReady) {
                if ($lang.cbOnErr(cb, this._error)) {
                    return;
                }
                Flow.getInstance().nextTick($lang.partiallyApply(cb, null, this._config[key] ));
            } else {
                var configReadyFunction = _.bind(function() {
                    this._isReady = true;
                    this.get(key, cb);
                    Flow.getInstance().nextTick(_.bind(function (){
                        this.off("configReady",configReadyFunction);
                    },this));
                }, this);
                this.on("configReady", configReadyFunction);
                this._pullRemoteConfigOnce();
            }
        },

        _schedulePullRemoteConfig: function() {
            if (this._stopRequested) {
                return;
            }

            this._pullRemoteConfig();
            this._pullTimeout = $taskManager.scheduleTask(this._schedulePullRemoteConfig, CONSTANTS.CONFIG_REFRESH_INTERVAL);
        },

        _pullRemoteConfig: function() {
            if (!this._config.remoteConfigObjectUrl) {
                this.notify("configReady");
            } else {
                var s3Client = new S3Client({
                    networkClient: (typeof XMLHttpRequest === "undefined" ? new SDKRequestClient() : new XHRClient())
                });
                s3Client.getObject(this._config.remoteConfigObjectUrl, "json",
                    _.bind(function(err, obj) {
                        if (err) {
                            this._error = err;
                        } else {
                            //check if this remote config is different than the last.
                            if (! _.isEqual(this._remoteConfig,obj) ) {
                                this._remoteConfig = obj;
                                //remote values have priority
                                this._config = _.extend({}, this._localConfig, this._remoteConfig);
                                this.notify("configChanged");
                            }
                            this._error = null;
                        }
                        this.notify("configReady");
                    }, this));
            }
        }
    });

    Promise.promisifyAll(ConfigurationManager.prototype);

    return ConfigurationManager;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/lang"),
        require("bit/commons/options"),
        require("bit/commons/task-manager"),
        require("bit/commons/flow"),
        require("bit/commons/events"),
        require("bit/clients/s3-client"),
        require("bit/clients/network/xhr-client"),
        require("bit/clients/network/sdk-request-client")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/lang",
        "bit/commons/options",
        "bit/commons/task-manager",
        "bit/commons/flow",
        "bit/commons/events",
        "bit/clients/s3-client",
        "bit/clients/network/xhr-client",
        "bit/clients/network/sdk-request-client"
    ], factory);
}

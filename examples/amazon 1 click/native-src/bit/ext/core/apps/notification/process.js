var factory = function(
    _,
    $options,
    Promise,
    Events,
    QueryStringMap,
    TaskManager,
    NotificationSpawner,
    ConfigurationManager
    )
{

/**
 * This file defines the Notifications process as used by the One-button-app framework.
 * It is horribly bloated, and has to internally manage starting/restarting itself
 * as well as process data received frome external sources.
 * That being said, the code is modularized fairly well, and future refactor is not only
 * possible but planned: see? ---> TODO: Refactor process.js and add ut's.
 *
 * Here I'll give a high-level description of how process.js works; ideally this should make
 * reading the code 10x easier.
 *
 * First of all, the process has two states: stable and transition. The state refers to the ability of the
 * process to be able to restart in case of the SIGINT (not a real one of course: a mocked one using a boolean variable for the flag
 * and a function called "interruptSignal" to deliver the signal). "stable" means it's currently not restarting the process,
 * and is thus able to respond to the signal immediately. "transition" means that upon exiting its current
 * state (i.e. once the process is done starting/restarting), it will check if the interrupt signal flag
 * is set to true, and initiate a restart if it is.

    Below is the workflow for the first start.


                                                                                                yes -> start process ---------------------
                                                                                                /                                         \
  One-button-app -> notificationProcess.start() -> this.start() -> this._startProcess() -> enabled? (determined via knobs,settings,config) -> one time setup -> transition into "stable"
                                                                                                \                                          /
                                                                                               no -> go directly to one time setup -------


    Upon entering the "stable" state, it checks if the interruptFlag is set: if yes-> this._restartProcess() and reset flag
                                                                                    no -> do nothing.

    SIGINTS are caused by following events:
        user settings changes that pertain to notif process (locale and alertList)
        config changes
        health check errors

    SIGINTS currently restart the process, causing it to re-read all the values mentioned above (thus forcing it to use
    the most up-to-date values).
 */

    var STATES = {
        // Here we define states that the process can be; needed for dealing with external events.
        // A "stable" state means that we are ready to consume the interrupt signals.
        // "transition" state means we have until we've transitioned into a stable state
        // before processing the interrupt signal.
        STABLE: "stable",
        TRANSITION: "transition"
    };
    var PMET_URI = "/gp/ubp/oneButton/notifications/ping";
                    //1s  1m  1h  6h
    var SIX_HOURS = 1000 *60 *60 *6;

    var notificationEnabledKey = "options.notificationEnabled";

    function StartupError(message) {
      this.name = 'StartupError';
      this.message = message || 'Either Config Manager has a lastError set, or the spawn function failed. We will retry after some delay';
    }
    StartupError.prototype = new Error();
    StartupError.prototype.constructor = StartupError;

    var NotificationProcess = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(NotificationProcess.prototype, Events ,{
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            //Initialize all the passed in references/dependencies
            this._platformCode = opts.getOrError("platformCode");
            this._localeDelegate = opts.getOrError("localeDelegate");
            this._sandboxDelegate = opts.getOrError("sandboxDelegate");
            this._transportStyle = opts.getOrError("transportStyle");
            this._transportStrategyOptions = opts.getOrError("transportStrategyOptions");
            this._config = opts.getOrError("config");
            this._tokenVendor = opts.getOrError("tokenVendor");
            this._processManager = opts.getOrError("processManager");
            this._platformService = opts.getOrError("platformService");
            this._simpleStorage = opts.getOrError("simpleStorage");
            this._pinger = opts.getOrError("pinger");
            this._guidManager = opts.getOrError("guidManager");
            this._extensionVersion = opts.getOrError("extensionVersion");
            //Initialize internal variables that will be initialized the first
            //time the process is created
            this._pid = null;//pid is null when we don't have a process up and running.
            this._interruptFlag = false; //interruptFlag; analogous to a C/C++ SIGINT.
            this._currentState = STATES.TRANSITION; //used for tracking whether or not we can process an interuptSignal at that moment.
                                                    //the process is considered "in transition" when either starting or restarting. 
            this._retryStartupTimeoutId = null;

            //configurable values
            this._autoRestartInterval = SIX_HOURS;
            this._retryStartupInterval = 1000 * 60 * 2; //two minutes.
            //create spawner
            this._spawner = new NotificationSpawner({
                sandboxDelegate: this._sandboxDelegate,
                transportStyle: this._transportStyle,
                transportStrategyOptions: this._transportStrategyOptions
            });
            //create configMgr
            this._configMgr = new ConfigurationManager({
                config: this._config
            });
            //bind any methods that are passed as handlers 
            _.bindAll(this,"_onStorageChange","_interruptSignal","_onStateChange","_registerListenerForConfigChanged",
                "_autoRestart", "_initializeAutoRestarter");
            //Register our method to the simpleStorage OnChange Events.
            this.on("stateChange",this._onStateChange); //register the stateChange handler which is how we control the state; only the onStateChange
                                                        //sets the internal boolean used.
            this._simpleStorage.bindOnChange(this._onStorageChange); //listen for the onStorageChange events for knowing when locale or settings change
            this._registerListenerForConfigChangedOnce = _.once(this._registerListenerForConfigChanged); //we call this at the end of _startProcess
                                                                                                         //we don't listen inintially since the first
                                                                                                         //time config is loaded the onchange event fires
                                                                                                         //thus meaning we'd needlessly restart.
            this._initializeAutoRestarterOnce = _.once(this._initializeAutoRestarter);
        },

        start: Promise.method(function (opts) {//start method should not be called twice...could result in some nasty bugs (multiple rogue iframes)
            this._configMgr.start();
            return this._startProcess();
        }),

        _autoRestart: function () {
            this._interruptSignal();
            TaskManager.scheduleTask(this._autoRestart,this._autoRestartInterval);
        },

        _initializeAutoRestarter: function () {
            TaskManager.scheduleTask(this._autoRestart,this._autoRestartInterval);
        },

        _overrideConfigurableValues: function (config) {
            if (config.autoRestartInterval !== undefined) {
                this._autoRestartInterval = parseInt(config.autoRestartInterval);
            }

            if (config.retryStartupInterval !== undefined) {
                this._retryStartupInterval = parseInt(config.retryStartupInterval);
            }
        },

        _retryStartup : function () {
            if (this._retryStartupTimeoutId) return; //return if we already have a pending startup
            this._retryStartupTimeoutId = TaskManager.scheduleTask(this._interruptSignal,this._retryStartupInterval);
        },

        _startProcess : function () {
            return Promise.bind({
                // Local context for this Promise chain
                app: this,
                params : {}
            })
            .then(function () {
                // Step 1: Get the locale
                return this.app._getLocale();
            })
            .then(function (locale) {
                this.params.currentLocale = locale;
                //Step 2: Determine if the user has enabled deal notifications for the locale.
                return this.app._dealNotificationsEnabled(locale);
            })
            .then(function (dealNotificationsEnabled) {
                //Step 3:
                //and if deal notifications are enabled, continue.
                //else throw an error to skip down all the way down to
                //the catch+finally blocks (this use of errors for control flow is already present elsewhere in
                //in this method as well as other process start chains in the 1BA)
                if (dealNotificationsEnabled) {
                    return Promise.resolve(null);
                } else {
                    throw new Error("Deal Notifications are disabled by the user");
                }
            })
            .then(function(){
                // Step 4: Get the configuration for the locale
                return Promise.bind(this)
                .then(function () {
                    return this.app._configMgr.getAsync("locales");
                })
                .catch(function (err) {
                    // If the above link in the chain fails, then that means we need to attempt to restart the process at a
                    //late time or else the process will never get started. This is due to the config manager having its last error
                    //set to true. We also nudge the config-manager to pull again.
                    this.app._configMgr._pullRemoteConfig();
                    throw new StartupError();
                });
            })
            .then(function (locales) {
                // Step 5: Return the current locale's config
                return locales[this.params.currentLocale];
            })
            .then(function (config) {
                this.params.config = config;
                try {
                    this.app._overrideConfigurableValues(config);
                } catch(err){/* Don't let the override stop us from starting the proces...calls parseInt */}
                // Step 6: Validate the config file
                if (!this.params.config || !this.params.config.knobValue || !this.params.config.knobValue[this.app._platformCode] || !this.params.config.notificationHost || !this.params.config.notificationHost.url) {
                    throw new Error("Notification: Missing configuration values. Mandatory values: knobValue, dcEndpointUrl, notificationHost.url.");
                }
            })
            .then(function () {
                // Step 7: Check the knobvalue (e.g. "weblab")
                return this.app._tokenVendor.verifyTokenAsync("Notification",
                    this.params.config.knobValue[this.app._platformCode]);
            })
            .then(function (isActive) {
                //Step 8: Start (spawn) the process if weblab is dialed up
                if (!isActive) {
                    throw new Error("Notification: Not available for this installation.");
                }
            })
            .then(function () {
                //NOTE : If you're here in the chain, that means you're attempting to start the notifications remote process.
                //       all steps prior were to verify/validate that we can/should be starting it.
                //Step 9: Get the ubp_root (e.g. domain for current locale) as well as the remote attribution parameters.
                return Promise.all([
                    this.app._simpleStorage.getAsync('options.ubp_root'),
                    this.app._localeDelegate._attributionManager.getRemoteAttributionParametersAsync(),       // get other params like programCode etc. Eg. {partner: "amazon", programCode: "org", app: "1BA", platform: "CR", tagbase: "abba-chrome"}
                    this.app._localeDelegate._attributionManager.getAttributionParametersAsync({featureCode : "notif"}), // get ref and tag params eg. {tag: "bit-org-1ba-cr-us-20", ref_: "bit_bit_org_1ba-cr_cfu_us"}
                                                                                                                    // TODO update the feature code to a more relevant one
                    this.app._tokenVendor.persistentTokenAsync('Notification'), // we can reach this point only if there is a token for Notification
                    this.app._guidManager.getGUIDAsync(),
                    this.app._simpleStorage.setAsync(notificationEnabledKey,"true") //optimistically set this to true; if we end up not being able to start will get reset in catch block
                ]);
            })
            .then(function (additionalParams) {
                //Step 10: Generate the queryString to be appended to iframe to communicate information to the notification host.
                //  also send a ping to PMET saying that the platform (e.g. the client-side) is starting the remote process.
                //  there is a complementary ping on the remote side of type "started". These pings should be about equal if everything
                //  is honkey dorey.

                this.app._sendPing("starting");// increments a counter on PMET telling it that we've tried to start the notifications remote process.

                var qs = new QueryStringMap({
                    queryParams: _.extend({}, this.params.config.notificationHost["queryStringParameters"] || {},
                        {
                            "platformCode" : this.app._platformCode,
                            "locale" : this.params.currentLocale,
                            "ubpRoot": additionalParams[0],
                            "attributionParams": JSON.stringify(additionalParams[1]),
                            "refAndTagAttributionParams" : JSON.stringify(additionalParams[2]),
                            "token": additionalParams[3],
                            "guid" : additionalParams[4],
                            "extensionVersion" : this.app._extensionVersion
                        }
                    )
                }).toQueryString();

                //Step 11: spawn it!
                return Promise.bind(this)
                .then(function () {
                    return this.app._processManager.spawn(this.app._spawner, {
                        url: this.params.config.notificationHost.url + qs
                    });
                })
                .catch(function (err) {
                    throw new StartupError();
                });
            })
            .then(function (pid) {
                //Step 12: Once we get the pid, we need to restart on the healthchecker error.
                this.app._pid = pid;
                this.app._restartOnHealthCheckError();

                // Step 13 (14 if you're superstitious, but then there are two Step 14's): Connect to platform service
                // Make sure we still have an exchange
                this.params.exchange = this.app._pid.exchange();
                if (this.params.exchange) {
                    return this.app._platformService.clientConnectExchangeAsync("RemotePlatform:RemoteProcessDelegate:Notification", this.params.exchange);
                } else {
                    throw new Error("Cannot connect process to PlatformService - no MessageExchange available: " + this.app._pid.id());
                }
            })
            .then(function () {
                //Step 14: Tell the remote process that the exchange is wired properly and is now able to receive messages.
                this.params.exchange.send({
                    mType: "platformNotification",
                    eventName: "Exchange.Ready",
                    args: {}
                });
                //If we succeed all the way to this step, then the remote process is enabled and running!
                //This storage value is used by the server-side for determining if the notifications process is running;
                //similar to the PCOMP storage value.
                return this.app._simpleStorage.setAsync(notificationEnabledKey,"true");

            })
            .catch(function (e) {
                //Step x: If we ever throw, then it means we either had an actual error (i.e. error while starting the process)
                // or we simply wanted to break out of the chain because notifications are not enabled.
                if (e.name === "StartupError") {
                    this.app._retryStartup();
                }
                console.error(e); //useful for when you're doing notif. process debugging/testing.

                //if we're here then that means the process is either failing or disabled by the user.
                return this.app._simpleStorage.setAsync(notificationEnabledKey, "false");

            })
            .finally(function () {
                this.app._initializeAutoRestarterOnce();
                //Step x+1 or 16: Set the state back to stable, and register the config changed the first time start is called.
                this.app._registerListenerForConfigChangedOnce();
                this.app.notify("stateChange",STATES.STABLE);
            });
        },

        _restartProcess: function () {
            /*
            This restarts the process. Consists of two things: teardown (the beginning of this promise chain) and startup (calls _startProcess).
            */
            return Promise.bind(this)
            .then(function () {
                //Step 1: Inform the process we're shutting it down so it can do some useful teardown if necessary.
                if (this._pid) {
                    //Only need to send shutdowns/tell PMET we're shutting down the process if we had a process in the first place.
                    this._sendPing("shuttingDown");
                    //informs the notifications remote process that we're shutting it down
                    this._pid.exchange().send({
                        mType: "platformNotification",
                        eventName: "Process.Shutdown",
                        args: {}
                    });
                }
            })
            //Give some time for the notification process to do some teardown
            //.delay(200)
            .then(function () {
                //Step 2:
                //disconnect the exchange used for the platform API's.
                return this._platformService.clientDisconnectAsync("RemotePlatform:RemoteProcessDelegate:Notification");
            })
            .catch(function (e) {
                //client most likely never connected in the first place...catching is easiest solution
                return ;
            })
            .then(function () {
                //Step 3: Kill the process and remove all event listeners on the old pid. Also sets this._pid to null.
                if (this._pid) {
                    this._pid.off();//deregisters any handlers on the pid events; i.e. deregisters the healthchecker error handlers
                    var pid = this._pid;
                    this._pid = null;
                    return this._processManager.executeShutdownProcess(pid.id());
                }
            })
            .catch(function (e) {
                //Putting catch here, since any errors in startProcess get swallowed
                //console.log(e);
                return Promise.resolve(null);
            })
            .then(function () {
                //Step 4: start the process again.
                return this._startProcess();
            });
        },

        /*
        This responds to when we call this.notify("stateChange", state).
        Manages the internal _currentState var, and checks the interruptFlag
        when entering the stable state.
        */
        _onStateChange: function (state) {
            this._currentState = state;
            if (state === STATES.STABLE) {
                if (this._interruptFlag) {
                    this._interruptSignal();
                    this._interruptFlag = false;
                }
            }
            //else, we're transitioning into a transition state,
            //meaning that all we need to do is set the current state.
        },
        /*
        Simulates the SIGINT. Takes care of transitioning the process into a transition state
        so that it is synchronous. There should only ever be two calls to this.notify("stateChange"):
        one is here, the other is in _startProcess().
        */
        _interruptSignal: function () {
            if (this._retryStartupTimeoutId) {
                try {
                    TaskManager.cancelTask(this._retryStartupTimeoutId);
                } catch (err) {/* Since TaskManager is non-standard just make sure it doesn't throw for non-scheduled ID */}
                this._retryStartupTimeoutId = null;
            }
            if (this._currentState === STATES.STABLE) {
                this.notify("stateChange",STATES.TRANSITION);
                this._restartProcess();
            } else {
                this._interruptFlag = true;
            }
        },
        /*
        Dispatch a SIGINT if any storage values we care about have changed.
        */
        _onStorageChange: function (namespace,key) {
            if (namespace === "options") {
                switch (key) {
                    case "ubp_root":
                    case    "alertList":
                    case "US_alertList":
                    case "DE_alertList":
                    case "UK_alertList":
                    case "CA_alertList":
                    case "FR_alertList":
                    case "JP_alertList":
                    case "CN_alertList":
                    case "IT_alertList":
                    case "ES_alertList":
                        console.log('Interrupt signal for key =========>  ', key);
                        this._interruptSignal();
                        break;
                    default:
                        break;
                }
            }
        },
        /*
        Dispatch a SIGINT if the healthchecker fails.
        */
        _restartOnHealthCheckError: function () {
            this._pid.on("error", _.bind(function(err) {
                if(err === "healthCheck") {
                    this._interruptSignal();
                }
            },this));
        },
        /*
        Dispatch a SIGINT if the config changes.
        */
        _registerListenerForConfigChanged: function () {
            this._configMgr.on("configChanged",this._interruptSignal);
        },

        /*
        Helpers for getting/parsing config values given by the platform
        */
        _getLocale: function () {
            return new Promise(_.bind(function (resolve,reject) {
                this._localeDelegate.getLocale(function (result) {
                    resolve(result);
                });
            },this));
        },

        _dealNotificationsEnabled: function (locale) {
            var dealsString = "deals";
            var key = locale.toUpperCase() + "_alertList";
            return Promise.bind(this)
                .then(function () {
                    return this._simpleStorage.getAsync({
                        namespace: "options",
                        key: key
                    });
                })
                .then(function (alertList) {
                    if (typeof alertList === "undefined") {
                        // if locale specific alertList not present get alertList
                        return Promise.bind(this)
                            .then(function(){
                                return this._simpleStorage.getAsync({
                                    namespace: "options",
                                    key: "alertList"
                                });
                            })
                            .then(function(alertList){
                                alertList = alertList || "";
                                return alertList.split(",");  //alertList is a bunch of comma-separated values representing enabled alerts.
                            });

                    } else {
                        alertList = JSON.parse(alertList);
                        return alertList[1];
                    }
                })
                .then(function (alertListArray) {
                    var dealsEnabledIndex = _.indexOf(alertListArray, "deals");//returns -1 if there's no dealsString
                    return dealsEnabledIndex > -1;
                });
        },
        //Ping helper
        _sendPing: function (type) {
            if (type === "starting" || type === "shuttingDown") {
                this._pinger.otherPingAsync(PMET_URI,false,{"type":type});
            }
        }

    });


    return NotificationProcess;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bluebird"),
        require("bit/commons/events"),
        require("bit/commons/query-string-map"),
        require("bit/commons/task-manager"),
        require("bit/ext/core/apps/notification/spawner"),
        require("bit/ext/core/components/configuration-manager")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bluebird",
        "bit/commons/events",
        "bit/commons/query-string-map",
        "bit/commons/task-manager",
        "bit/ext/core/apps/notification/spawner",
        "bit/ext/core/components/configuration-manager"
    ], factory);
}


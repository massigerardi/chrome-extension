define([
    "underscore",
    "bluebird",
    "attribution-config",
    "extension-config",
    "bit/commons/options",
    "bit/commons/uri",
    "bit/ext/chromelike/config",
    "bit/ext/chromelike/components/update-event-interceptor",
    "bit/ext/chromelike/components/session-state-tracker",
    "bit/ext/core/components/attribution-manager",
    "bit/ext/chromelike/components/campaign-attribution-agent",
    "bit/commons/ready-gate",
    "bit/ext/core/util/ajax",
    "bit/ext/chromelike/storage/native-storage",
    "bit/ext/core/storage/simple-storage",
    "bit/ext/chromelike/components/application-state",
    "bit/commons/lang",
    "bit/commons/flow",
    "bit/commons/navigator",
    // Special little snowflake
    "bit/ext/chromelike/runtime",
    "bit/ext/core/one-button-app",
    "bit/os/internals/sandbox/iframe-remote-process-sandbox-delegate",
    "bit/ext/chromelike/platform/platform-service-bootstrapper",
    "bit/messaging/message-bus",
    "bit/ext/chromelike/components/product-compass-manager",
    "bit/ext/core/components/configuration-manager",
    "bit/ext/core/components/token-vendor",
    "bit/ext/core/config/main-local-config",
    "bit/ext/core/config/product-compass-local-config",
    "bit/ext/core/config/titan-local-config",
    "bit/ext/core/config/hover-local-config",
    "bit/ext/core/config/mode-local-config",
    "bit/ext/core/util/smile-mode",
    "bit/ext/core/components/mode-manager",
    "bit/ext/chromelike/extensions/mode/smile-mode-extension",
    "bit/ext/core/components/ping-manager",
    "bit/ext/core/components/guid-manager",
    "bit/clients/network/xhr-client",
    "bit/ext/core/components/addon-uninstaller",
    "bit/ext/core/components/uninstall-wishlist",
    "bit/ext/core/config/notification-local-config",
    "bit/ext/core/components/alerts-badge-controller"
], function(
    _,
    Promise,
    $attributionConfig,
    $extensionConfig,
    $options,
    $uri,
    $config,
    $updateEventInterceptor,
    SessionStateTracker,
    AttributionManager,
    CampaignAttributionAgent,
    ReadyGate,
    $ajax,
    $nativeStorage,
    SimpleStorage,
    ApplicationStateManager,
    $lang,
    Flow,
    Navigator,
    // Special little snowflake
    ChromeRuntime,
    OneButtonApp,
    IframeRemoteProcessSandboxDelegate,
    PlatformServiceBootstrapper,
    MessageBus,
    ProductCompassManager,
    ConfigurationManager,
    TokenVendor,
    MainLocalConfig,
    ProductCompassConfig,
    TitanConfig,
    HoverConfig,
    ModeLocalConfig,
    SmileMode,
    ModeManager,
    SmileModeExtension,
    Ping,
    GUIDManager,
    XHRClient,
    Uninstaller,
    UninstallWishListFunctions,
    NotificationConfig,
    AlertsBadgeController
) {
    var debug = $config.isDebug();
    var root_locked = false;
    var SIX_HOURS = 21600000;
    var DEFAULT_TAGBASE = $attributionConfig.getTagbase();
    var storage = chrome.storage.local;
    var tagbase = DEFAULT_TAGBASE; // initializing tagbase with default value
    var thirdPartyId = localStorage.getItem("com.amazon.bit.chrome.thirdpartyid") || null;
    var panelPort;
    var cc_suffix_map = {
        'us' : '20',
        'ca' : '20',
        'uk' : '21',
        'gb' : '21',
        'fr' : '21',
        'de' : '21',
        'es' : '21',
        'it' : '21',
        'jp' : '22',
        'cn' : '23'
    };

    $simpleStorage = new SimpleStorage($nativeStorage);
    $runtime = new ChromeRuntime();
    var alertsBadgeController = new AlertsBadgeController({
        runtime : $runtime,
        simpleStorage : $simpleStorage
    });
    alertsBadgeController.start();//start exists b/c FF needs to first "create" the button. Chrome doesn't have this issue
    var applicationState = new ApplicationStateManager();

    var PLATFORM_BUS = new MessageBus();
    var PING_BUS     = new MessageBus();
    var UNINSTALL_BUS = new MessageBus();

    var configMgr = new ConfigurationManager({
        config: MainLocalConfig
    });
    configMgr.start();

    var guidManager = new GUIDManager({
        simpleStorage : $simpleStorage
    });


    var Logger = {
        log: function(message) {
            if (debug) {
                console.log(message);
            }
        }
    };


    Logger.log("Update event intercepter was triggered: " + $updateEventInterceptor.wasTriggered());
    Logger.log("Was updated: " + $updateEventInterceptor.wasUpdated() );
    Logger.log("Show upgrade prompt: " + $updateEventInterceptor.wasTriggered());


    var HelperKlass = function() {
        this.initialize.apply(this, arguments);
    }

    _.extend(HelperKlass.prototype, {
        initialize: function() {

            var campaignAttrAgent = new CampaignAttributionAgent({
                endpoint: $config.getCampaignSatelliteEndpoint()
            });

            var tagbaseDelegate = function(cb) {
                cb = cb || $lang.noop;

                campaignAttrAgent.getTagbaseDelegate()(function(err, localStorageTagbase) {

                    if(err) {
                        cb(err);
                        return;
                    }

                    if(localStorageTagbase) {
                        Flow.getInstance().nextTick($lang.partiallyApply(cb, null, localStorageTagbase));
                    }
                    else {
                        // use the tagbase calculated locally in main.js
                        Flow.getInstance().nextTick($lang.partiallyApply(cb, null, tagbase));
                    }
                });
            };

            this._attributionManager = new AttributionManager({
                app: "1BA",
                platform: $attributionConfig.getAttributionPlatfom(),
                tagbaseDelegate: tagbaseDelegate,
                storage: $simpleStorage,
                campaignCodeDelegate: campaignAttrAgent.getCampaignCodeDelegate(),
                associateIdDelegate: campaignAttrAgent.getAssociateIdDelegate(),
                bitModeDelegate: campaignAttrAgent.getBitModeDelegate(),
                localeDelegate: this.getLocale
            });

            this._attributionManagerGate = new ReadyGate();
            this._attributionManagerGate.gated(_.bind(function(){
                this._attributionManager.start(this._attributionManagerGate.handler());
            }, this));

        },
        attributionManager: function() {
            return this._attributionManager;
        },
        getRemoteAttributionParameters: function(cb) {
            this._attributionManagerGate.onReady(_.bind(function() {
                this._attributionManager.getRemoteAttributionParameters(cb);
            }, this));
        },
        getAlertTypeFromAlertID: function(alertId) {
             /* Alert Types are 4 Char string - DOTD, PCOMP, SASS etc.
              * AlertID is an 8 char string:
              *     alertId - alertType (4 Chars) + random number(4 digits)
              *
              * Type = DOTD, alertId could be DOTD1245, DOTD9837 etc.
              * Type = SASS (Search Assist), alert Id could be SASS1882 etc
              */
              return  alertId.substring(0,4);
        },
        toQueryString: function(params) {
            var key,
                pairs = [];
            for (key in params) {
                if (params.hasOwnProperty(key)) {
                    pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
                }
            }
            if (pairs.length === 0) {
                return "";
            } else {
                return pairs.join("&");
            }
        },
        _getParams: function(additionalParams) {

            var key,
            // Default params
            params = {
                version: $runtime.getExtensionVersion(),
                now: Date.now()
            };

            if (thirdPartyId) {
                params["thirdpartyid"] = thirdPartyId;
            }

            for (key in additionalParams) {
                if (additionalParams.hasOwnProperty(key)) {
                    params[key] = (typeof additionalParams[key] === 'object') ? JSON.stringify(additionalParams[key]) : additionalParams[key];
                }
            }

            return params;
        },
        getAttributionContextAsync: function(){
            return Promise.bind(this)
            .then(function(){
                return this._attributionManagerGate.onReadyAsync();
            })
            .then(function(){
                return this._attributionManager.getAttributionContextAsync();
            })
            .then(function(attributionContext){
                // attributionContext will look like :
                    //Object: {
                    //          bitMode: "smile",
                    //          associateId:<someID>
                    //          tagSafeProductCode: "1ba-ff",
                    //          partnerRefCode: "bit",
                    //          app: "1BA",
                    //          namespace: "bit",
                    //          refSafeProductCode: "1ba-ff",
                    //          campaignCode: <someCampaignCode>,
                    //          partnerTagCode: "bit",
                    //          programCode: "org",
                    //          platform: "FF",
                    //   }
                return attributionContext;
            })
            .catch(function (err) {
                Logger.log("Couldn't get attribution info " + err);
                throw new Error("Couldn't get attribution info " + err);
            });
        },
        requestForJSONAsync : function (url) {
            return new Promise(_.bind(function(fulfill,reject) {
                var xhrClient = new XHRClient();
                var requestConfig = {
                    http_method : "GET",
                    success : fulfill,
                    error : reject,
                    responseType : "json"
                };
                xhrClient.request(url,requestConfig);
            },this));
        },
        //This opens first run page
        openFirstRunPage: function(){
            Helper.getTaggedRoot('fr', function(first_run_url) {
                chrome.tabs.create({ 'url' : first_run_url });
            }, '/gp/ubp/misc/firstrunpage.html');
        },

        getRoot: function(callback, relative, additionalParams) {
            additionalParams = additionalParams || {};
            relative = relative || '';
            var self = this;

            Promise.bind(this)
            .then(function(){
                return guidManager.getGUIDAsync();
            })
            .then(function(guid){
                additionalParams = _.extend({}, additionalParams, {'guid': guid});
                this._attributionManagerGate.onReady(_.bind(function(err) {
                    if (err) {
                        Logger.log("Couldn't get attribution info " + err);
                        return;
                    }
                    this._attributionManager.getRefAttributionParameter(function(err, refParams) {
                        if (err) {
                            Logger.log("Couldn't get attribution info " + err);
                            return;
                        }
                        var finalParams = _.extend({}, additionalParams, refParams);
                        self._attributionManager.getRemoteAttributionParameters(function(err, params) {
                            finalParams = _.extend({}, finalParams, params);
                            storage.get('options.ubp_root', function(options_root) {
                                var root = options_root['options.ubp_root'] + relative +
                                "?" + self.toQueryString(self._getParams(finalParams));
                                Logger.log('Root url: ' + root);
                                callback(root);
                            });
                        });
                    });
                }, this));
            });
        },

        //getRootAsync is a promisified version of getRoot.
        //It is responsible for taking a relative path and some query parameters, and returning a
        //promise that resolves to a full URL endpoint with our attribution tagging there as well.
        //Does not include the 'tag' query param (use getTaggedRoot for that). 
        getRootAsync: function(relative, additionalParams) {
            var finalParams,
                feature = "def";

            additionalParams = additionalParams || {};
            relative = relative || '';
            if (additionalParams["feature"]) {
                feature = additionalParams.feature;
                delete additionalParams.feature;
            }

            return Promise.bind(this)
            .then(function(){
                return guidManager.getGUIDAsync();
            })
            .then(function(guid){
                _.extend(additionalParams, {'guid': guid});
                return this._attributionManagerGate.onReadyAsync();
            })
            .then(function() {
                return this._attributionManager.getRefAttributionParameterAsync({featureCode : feature});
            })
            .then(function (refParams) {
                finalParams = _.extend(additionalParams, refParams);

                return this._attributionManager.getRemoteAttributionParametersAsync();
            })
            .then(function (remoteParams) {
                _.extend(finalParams, remoteParams);

                return $simpleStorage.getAsync('options.ubp_root');
            })
            .then(function (optionsRoot) {
                var root = optionsRoot + relative + "?" + this.toQueryString(this._getParams(finalParams));
                Logger.log('Root url: ' + root);
                return root;
            })
            .catch(function (error) {
                Logger.log("Couldn't get attribution info " + err);
                throw new Error("Couldn't get attribution info " + err);
            });
        },

        getTaggedRoot: function(app, callback, relative, additionalParams) {
            additionalParams = additionalParams || {};
            relative = relative || '';
            var self = this;

            Promise.bind(this)
            .then(function(){
                return guidManager.getGUIDAsync();
            })
            .then(function(guid){
                additionalParams = _.extend({}, additionalParams, {'guid': guid});
                    this._attributionManagerGate.onReady(_.bind(function(err) {
                        if (err) {
                            Logger.log("Couldn't get attribution info " + err);
                            return;
                        }
                        this._attributionManager.getParams({
                            featureCode: app
                        }, function(err, params) {
                            var finalParams = _.extend({}, additionalParams, params);
                            storage.get('options.ubp_root', function(options_root) {
                                var root = options_root['options.ubp_root'] + relative +
                                "?" + self.toQueryString(self._getParams(finalParams)) + $extensionConfig.getSupportedParams();
                                Logger.log('Tagged url: ' + root);
                                callback(root);
                            });
                    });
                }, this));
            });
        },

        getPingEndpointAsync: function(relative, includeTag) {
            return Promise.bind({
                helper:this,
                params:{}
            })
            .then(function () {
                //guidManager is a global object for getting the toolbar id.
                return guidManager.getGUIDAsync();
            })
            .then(function (guid) {
                this.params["guid"] = guid;
            })
            .then(function () {
                // Check if AttributionManager is ready
                return this.helper._attributionManagerGate.onReadyAsync();
            })
            .then(function () {
                //modeMgr is global object
                return modeMgr.getModeStatusAsync({});
            })
            .then(function (modes) {
                Logger.log("Modes");
                Logger.log(modes);
                var enabledModesArray = [];
                _.each(modes,function (isEnabled,mode) {
                    //modes is object of {mode:isEnabled} pairs where 
                    //isEnabled is a string: "true" or "false"
                    if (isEnabled === "true") enabledModesArray.push(mode);
                });
                enabledModesArray.sort(); //sorts in ascending alpha order.
                this.params["bitMode"] = enabledModesArray.join("-");
                if(!this.params["bitMode"]){
                    this.params["bitMode"] = "noMode";
                }
            })
            .then(function () {
                // Get the attribution parameters
                return this.helper._attributionManager.getParamsAsync({
                    featureCode: "cfu"
                });
            })
            .then(function (attrParams) {
                // Collect all the parameters
                _.extend(this.params, attrParams);

                // Remove the tag if it is not asked for.
                if (includeTag !== true) {
                    delete this.params.tag;
                }

                // Prepare the URL and invoke the callback
                return $simpleStorage.getAsync('options.ubp_root');
            })
            .then(function(data) {
                var url = data + relative + "?"
                          + this.helper.toQueryString(this.helper._getParams(this.params));
                return url;
            });
        },
        getGatewayUrl: function(callback, view, additionalParams) {
            var params = {};
            var app = "gw";
            if (view) {
                params["view"] = view;
                app = view === "firstrun" ? "fr" : "gw";
            }
            _.extend(params,additionalParams);
            storage.get('options.gateway_page_url', function(options_gateway) {
                var relative = options_gateway["options.gateway_page_url"];

                Helper.getTaggedRoot(app, function(root) {
                    Logger.log("Gateway URL: " + root);
                    callback(root);

                }, relative, params);
            });
        },
        // @param callback - function(locale)
        getLocale: function(callback) {
            var LOCALES = {
                "com"   : "Us",
                "ca"    : "Ca",
                "co.uk" : "Uk",
                "it"    : "It",
                "fr"    : "Fr",
                "es"    : "Es",
                "de"    : "De",
                "cn"    : "Cn",
                "co.jp" : "Jp",
                "jp"    : "Jp",
                "uk"    : "Uk"
            };
            storage.get('options.ubp_root', function(options_root) {
                configMgr.get("localeRegex", function(err, localeRegex) {
                    if(err) {
                        callback('Us');
                    }
                    var matches = $uri.parse(options_root['options.ubp_root']).host.match(new RegExp(localeRegex));
                    if(matches && matches[1] && LOCALES[matches[1]]) {
                        callback(LOCALES[matches[1]]);
                    }
                    else {
                        callback('Us');
                    }
                });
            });
        },
        getLocaleAsync: function(){
            return new Promise( _.bind(function(fulfill, reject){
                this.getLocale(fulfill);
            },this));
        },
        getNotificationUrl: function(callback) {
            storage.get('options.notifications_page_url', function(options_notification) {
                Helper.getTaggedRoot("notif", function(root) {
                    Logger.log("Notification URL: " + root);
                    callback(root);
                }, options_notification['options.notifications_page_url']);
            });
        },
        wishlistHelper: function(data) {
            Logger.log("Navigating to wishlist page");
            Logger.log(data);
            if(panelPort) {
                Helper.getTaggedRoot('ws',function(root) {
                    Logger.log("Wishlist_wishlistComplete relative root: "+root);
                    panelPort.postMessage({
                        UBPMessageType: "UBPMessageResponse",
                        type: "Application_autonavigate",
                        url: root,
                        postJSONData: data,
                        fullChromeApp: true
                    });
                },'/gp/ubp/oneButton/WL/addToWishlist');
            }
        },
        /**
         * Injects JavaScript code into a page. For details, see https://developer.chrome.com/extensions/content_scripts#pi.
         *
         * @param tabId The ID of the tab in which to run the script; defaults to the active tab of the current window.
         * @param details Details of the script to run.
         * @param Called after all the JavaScript has been executed.
         **/
        executeScript: function(tabId, details, callback) {
            /**
             * Make a best effort to work around a Chrome bug by reducing the chances that there are no Windows available.
             *
             * Chrome on some platforms has a bug that causes the extension process to crash if chrome.tabs.executeScript is called
             * with no specific Tab while there are no Windows available.  This can happen if Chrome processes are running in background (Windowless) mode.
             * 
             * See https://code.google.com/p/chromium/issues/detail?id=382923&thanks=382923&ts=1402409930 for more information.
             *
             * After the Chrome bug is fixed - we can consider removing the check for available Windows.
             */
            chrome.windows.getAll(null, function (windows) {
                if (!windows || !windows.length) {
                    Logger.log("Not injecting script because no windows exist");
                    return;
                }
                chrome.tabs.executeScript(tabId, details, callback);
            });
        },
        injectJS: function(options) {
            if (options) {
                var tabId = options.tabId || null; // inject JS to a specific Tab instead of default to the active one
                var execute = function(err, responseText) {
                    if (!err) {
                        Helper.executeScript(tabId, {code: responseText}, function(result){
                            if(result) {
                                Helper.handleResponseCallback(result, options.responseCallback);
                            } else {
                                Helper.handleResponseCallback(false, options.responseCallback);
                            }
                        });
                    }
                };

                var self = this;
                if (options.includeShim) {
                    Logger.log('inject with message shim');
                    Helper.executeScript(tabId, {file: "ubpmessage.js"}, function(result) {
                        /*
                        * The result is an array of results of execution of the script in all the iframes of the page.
                        * To inject script in all the frames of the frames, {allFrames :true} needs to be sent in injectDetails, by default it is set false.
                        * Since we are injecting in only top frame, will check for results[0] for the result.
                        * Result of the script is last evaluated expression.
                        * Would check for result of ubpmessage.js and injectedmessagelistener.js to be true before injecting the main script.
                        * See https://developer.chrome.com/extensions/tabs#method-executeScript
                        */
                        if(result && result[0] === true){
                            Helper.executeScript(tabId, {file: "injectedmessagelistener.js"}, function(args) {
                                if (args && args[0] === true) {
                                    (options.url) ? $ajax.get(options.url, execute) : execute(null, options.string);
                                } else {
                                    Helper.handleShimError(options.shimErrorCallback);
                                    Helper.handleResponseCallback(false, options.responseCallback);
                                }
                            });
                        } else {
                            Helper.handleShimError(options.shimErrorCallback);
                            Helper.handleResponseCallback(false, options.responseCallback);
                        }
                    });
                }
                else {
                    (options.url) ? $ajax.get(options.url, execute) : execute(null, options.string);
                }
            }
        },
        navigateToGateway : function () {
            if(panelPort) {
                Helper.getTaggedRoot('gw',function(root) {
                    panelPort.postMessage({
                        UBPMessageType: "UBPMessageResponse",
                        type: "Application_autonavigate",
                        url: root
                    });
                },'/gp/ubp/oneButton/gateway/render');
            }
        },
        handleResponseCallback: function(result, responseCallback) {
            if (typeof responseCallback === "function") {
                responseCallback(result);
            }
        },
        handleShimError: function(shimCallback) {
            if (!shimCallback) {
                Helper.navigateToGateway();
            } else if (typeof shimCallback === "function") {
                shimCallback();
            } else {
                Logger.log("Unknown action");
            }

        },

        /**
         * Mark all alerts as read (and store back in ext. storage) set badge count to 0 
         */
        markAllAlertsAsRead: function(response,port) {
            Logger.log("Marking all alerts as read");
            storage.get('options.alerts', function(options_alerts) {
                var allAlerts = options_alerts['options.alerts'];
                if(allAlerts) {
                    for(var type in allAlerts)  {
                        if(allAlerts.hasOwnProperty(type)) {
                            for(var i=0;i<allAlerts[type].length;i++) {
                                for(var prop in allAlerts[type][i]) {
                                    if(allAlerts[type][i].hasOwnProperty(prop))  {
                                        allAlerts[type][i][prop]['read'] = 1;
                                    }
                                }
                            }
                        }
                    }

                    // save the marked alerts, set the notifications count to 0 and update the badge
                    storage.set({'options.alerts': allAlerts}, function() {
                        alertsBadgeController.setAlertsBadgeCount(0);
                        response.value = true;
                        port.postMessage(response);
                    });
                }
            });
        },
        loadPanelIframe: function(response, port) {
            guidManager.getGUIDAsync()
            .then(function(guid){
                pinger.ubpEngagementPing({
                    'pageType' : 'UBPEngagement',
                    'subPageType' : 'Gateway',
                    'pageAction' : 'Click',
                    'additionalRequestData' : guid 
                });
            });
            if(Navigator.isOffline()){
                Logger.log("Offline, Show network error page.");
                Navigator.loadOfflineIframe( function(root){
                    response.type = 'Application_reload';
                    response.url = root;
                    Logger.log('Send Application_reload');
                    port.postMessage(response);
                })
                return;
            }
            if (applicationState.shouldShowUpgradePrompt()) {
                Helper.getTaggedRoot('gw', function(root) {
                    response.type = 'Application_reload';
                    response.url = root;
                    response.value = true;
                    port.postMessage(response);
                }, '/gp/ubp/misc/chromeupgraded.html');
            }
            else if (applicationState.shouldShowOemFirstrun()){
                var view = "firstrun";
                Helper.getGatewayUrl(function(root) {
                    response.type = 'Application_reload';
                    response.url = root;
                    response.value = true;
                    Logger.log('Send Application_reload');
                    port.postMessage(response);
                }, view);
            }
            else if (applicationState.getStateProperty('showUninstallWishListPopup')) {
                Helper.getTaggedRoot('uw',function(root) {
                    response.type = 'Application_reload';
                    response.url = root;
                    response.value = true;
                    Logger.log('send Application_reload');
                    port.postMessage(response);
                },'/gp/ubppf/uninstallwl');
            } 
            else {
                Promise.bind({})
                .then(function () {
                    return alertsBadgeController.getAlertsBadgeCount();
                })
                .then(function (alertsBadgeCount) {

                    view = "gateway";

                    // however, if there are any unread notifications, then display the notifications view

                    if(alertsBadgeCount) {
                        /**
                         * Since avalone@ does not like ui for the notifications view,
                         * and since the only existing (6/25/2014) notification is the deal of the day notification,
                         * we show the deals view instead of the notifications view.
                         */
                        alertsBadgeController.setAlertsBadgeCount(0);
                        view = "notifications";

                        // mark all alerts as read
                        Helper.markAllAlertsAsRead(response,port);
                    }
                    Promise.bind({})
                    .then(function () {
                        return $simpleStorage.getAsync("options.notificationEnabled");
                    })
                    .then(function (notificationEnabled) {

                        notificationEnabledQueryParamObject = (notificationEnabled === "true") ? {notificationEnabled : 1} : {};

                        Helper.getGatewayUrl(function(root) {

                            response.type = 'Application_reload';
                            response.url = root;
                            response.value = true;
                            Logger.log('Send Application_reload');
                            port.postMessage(response);
                        }, view, notificationEnabledQueryParamObject);
                    });
                });
            }
        }
    });

    var Helper = new HelperKlass();

    /* ModeManager handles user personalization or branding */
    var modeMgr = new ModeManager({
        configMgr: new  ConfigurationManager({
            config: ModeLocalConfig
        }),
        modes: { "smile" : new SmileMode({extension: new SmileModeExtension()})},
        runtime : new ChromeRuntime(),
        localeDelegate : Helper,
        storage : $simpleStorage
    });

    var pinger = new Ping({
        getPingEndpointDelegate : Helper,
        simpleStorage : $simpleStorage,
        xhrClient : new XHRClient(),
        messageBus : PING_BUS
    });

/*
 This ping is to track the difference between new and old clients using the version number.
*/
//BEGIN
    var skewFactor = 1000 * 60 * 10; //10 minutes
    
    setTimeout(function () {
        pinger.otherPingWithRetriesAsync("/gp/ubp/misc/ping_pages/hourly_ping.html",undefined,3,undefined,false);
    }, Math.floor(Math.random()*skewFactor));//3 retries, so that they don't overlap while endpoint returns 404's

    setInterval(function () {
        setTimeout(function () {
            pinger.otherPingWithRetriesAsync("/gp/ubp/misc/ping_pages/hourly_ping.html",undefined,3,undefined,false);
        }, Math.floor(Math.random()*skewFactor));
    }, 1000 * 60 * 60);
//END

    var MessageHandler = {
        handleMessage: function(message, port) {
            var response = {
                'id': message.id,
                'UBPMessageType': 'UBPMessageResponse'
            };

            switch (message.type) {

                case "Chrome_apptype":
                    response.type = 'Chrome_apptype';
                    storage.get('options.appList', function(options) {
                        var value = options['options.appList'];
                        Logger.log('applist!!' + value);
                        // If site bookmark is the only available app
                        // and they had the dumb button in the past open amazon directly
                        storage.get('hadNonOBExtension', function(hadNonOBExtension) {
                            if (value === 'visitfullsite' && hadNonOBExtension['hadNonOBExtension']) {
                                Helper.getTaggedRoot('logo', function(url) {
                                    response.value = 'bookmark_button';
                                    port.postMessage(response);
                                    chrome.tabs.create({ 'url': url });
                                });
                            }
                            else {
                                storage.get('options.default_gateway_width', function(width_options) {
                                    storage.get('options.default_gateway_height', function(height_options) {
                                        response.width = width_options['options.default_gateway_width'];
                                        response.height = height_options['options.default_gateway_height'];
                                        response.value = false;
                                        port.postMessage(response);
                                    });
                                });
                            }
                        });
                    });
                    break;

                case "Browser_crossDomainXHR":
                    if (!message.options || !message.options.method || !message.options.url) {
                        response.error = true;
                        port.postMessage(response);
                    }
                    else {
                        (function(port, response, message) {
                            var xhr = new XMLHttpRequest();
                            xhr.open(message.options.method, message.options.url, true);
                            xhr.onreadystatechange = function() {
                                if (xhr.readyState == 4) {
                                    response.value = xhr.responseText;
                                    port.postMessage(response);
                                }
                            }
                            if (message.options.method == "POST") {
                                xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                                xhr.setRequestHeader("Content-length", message.options.content.length);
                                xhr.setRequestHeader("Connection", "close");
                                xhr.send(message.options.content);
                            }
                            else {
                                xhr.send();
                            }
                        })(port, response, message);
                    }
                    break;

                case "Browser_openWindow":
                    if (!message.options || !message.options.url) {
                        response.error = true;
                        port.postMessage(response);
                    }
                    else {
                        port.postMessage({type: 'Application_hide'});
                        setTimeout(function() {
                        chrome.tabs.create({ 'url': message.options.url });
                        }, 500);
                    }
                    break;

                case "Mode_enable":
                        if (!message.options || !message.options.mode) {
                            response.error = true;
                            port.postMessage(response);
                        }
                        else {
                            modeMgr.enableAsync(
                                message.options
                            ).then(function(modeValue){
                                    response.value = modeValue;
                                    port.postMessage(response);
                                },function(err){
                                    response.error = err.message ? err.message : "Failed while trying to enable.";
                                    port.postMessage(response);
                            });
                        }
                    break;

                 case "Mode_disable":
                    if (!message.options || !message.options.mode) {
                            response.error = true;
                            port.postMessage(response);
                    }
                    else {
                        modeMgr.disableAsync(
                            message.options
                        ).then(function(modeValue){
                                response.value = modeValue;
                                port.postMessage(response);
                            },function(err){
                                response.error = err.message ? err.message : "Failed while trying to disable.";
                                port.postMessage(response);
                        });
                    }
                    break;

                case "Mode_getModeStatus":
                    modeMgr.getModeStatusAsync(
                            message.options
                        ).then(function(modeValue){
                                response.value = modeValue;
                                port.postMessage(response);
                            },function(err){
                                response.error = err.message ? err.message : "Failed while trying to getModeStatus.";
                                port.postMessage(response);
                        });
                    break;
                case "Mode_isModeEnabled":
                    if (!message.options || !message.options.mode) {
                            response.error = true;
                            port.postMessage(response);
                    }
                    else {
                        modeMgr.isModeEnabledAsync(
                            message.options
                        ).then(function(isModeEnabled){
                                response.value = isModeEnabled;
                                port.postMessage(response);
                            },function(err){
                                response.error = err.message ? err.message : "Failed while trying to get isModeEnabled.";
                                port.postMessage(response);
                        });
                    }
                    break;
                case "Util_getPageUrl":
                    chrome.tabs.getSelected(null, function(tab) {
                        response.value = tab ? tab.url : null;
                        port.postMessage(response);
                    });
                    break;

                case "Options_acceptTermsOfUse":
                    applicationState.setCurrentState("termsOfUsageAccepted");
                    storage.set({'options.acceptedTermsOfUse': true});
                    start();
                    break;

                case "Options_getOption":
                    if (!message.options || !message.options.name) {
                        response.error = true;
                        port.postMessage(response);
                    }
                    else {
                        var optionName = 'options.' + message.options.name;
                        Logger.log("Getting option " + optionName);
                        storage.get(optionName, function(options) {
                            response.value = options[optionName];
                            Logger.log("Get option value");
                            Logger.log(response.value);
                            port.postMessage(response);
                        });
                    }
                    break;

                case "Options_setOption":
                    if (!message.options || !message.options.name || !message.options.value) {
                        response.error = true;
                        port.postMessage(response);
                    }
                    else {
                        // We prefix the options with 'options.' as a key because of race conditions
                        // If we keep just an options key with a json as in the FF extension,
                        // sending two setOptions message will both asynchronously get the options and
                        // then overwrite each other on set.
                        // Ex: set foo to 1 and bar to 2.
                        // Get: {} in the foo set and get {} in the bar set
                        // Set { foo: 1 } followed by Set { bar: 2 }
                        // Next get of options will return { bar: 2 }, foo was overwritten
                        var optionName = 'options.' + message.options.name;
                        Logger.log("Setting option " + optionName + " with value " + message.options.value);
                        var dataObj = {};
                        if(message.options.name !== 'ubp_root' || root_locked == false) {
                            dataObj[optionName] = message.options.value;
                        }

                        storage.get(optionName, function(option){
                            var optionValue = option[optionName];
                            Logger.log("setting option for " +optionName + " " + message.options.value);
                            $simpleStorage.set({namespace:"options",key:message.options.name},message.options.value, function() {
                                response.value = true;
                                port.postMessage(response);
                                if(message.options.name === 'ubp_root') {
                                    // Reload panel
                                    if (panelPort && port != panelPort) {
                                        Helper.getGatewayUrl(function(root) {
                                            response.type = 'Application_reload';
                                            response.url = root;
                                            panelPort.postMessage(response);
                                        });
                                    }

                                    //Reset notification counter
                                    alertsBadgeController.setAlertsBadgeCount(0);
                                    //Clear all alerts
                                    storage.set({'options.alerts': {}});

                                }
                            });
                        });
                    }
                    break;

                case "Notifications_configure":
                    Logger.log("Passing along this message because PCOMP uses it. Should be removed/replaced.");

                    // AmazonUBP.Notifications.configure({}) is called whenever they want to reload
                    // the Background page. We use this event to trigger ProductCompassManager setup.
                    // This addresses the problem of listening to every page that either sets or
                    // changes the alertList (some of which may be irrelevant) and only reloads
                    // the ProductCompassManager when necessary.
                    Helper.getLocale(function(locale) {
                        PLATFORM_BUS.publish({
                            mType: 'Event.ResetBackgroundContext',
                            args: {
                                locale: locale
                            }
                        });
                    });
                    break;

                case "Notifications_getAlerts":
                    if (!message.options) {
                        response.error = true;
                        port.postMessage(response);
                    }
                    else {
                        Logger.log("Getting all alerts " );
                        storage.get('options.alerts', function(options_alerts){
                            response.value = options_alerts['options.alerts'];
                            port.postMessage(response);
                        });
                    }
                    break;

                case "Browser_injectJavaScriptFromURL":
                    Logger.log("Browser_injectJavaScriptFromURL: Injecting script from URL  " + message.options.jsurl);
                    Helper.injectJS({
                        tabId: (port && port.sender && port.sender.tab) ? port.sender.tab.id : null,
                        url: message.options.jsurl,
                        includeShim: message.options.includeShim,
                        responseCallback: function(result) {
                            response.value = result;
                            port.postMessage(response);
                        }

                    });
                    break;

                case "Browser_injectJavaScriptFromString":
                    Logger.log('inject ' + message.options.jsstring);
                    Helper.injectJS({
                        tabId: (port && port.sender && port.sender.tab) ? port.sender.tab.id : null,
                        string: message.options.jsstring,
                        includeShim: message.options.includeShim,
                        shimErrorCallback: message.options.shimErrorCallback,
                        responseCallback: function(result) {
                            response.value = result;
                            port.postMessage(response);
                        }
                    });
                    break;

                case "DebugLogs_log_message":
                    Logger.log('log ' + message.options.log);
                    response.value = true;
                    port.postMessage(response);
                    break;

                case "Panel_resizePanel":
                    Logger.log("Resizing mainPanel to " + message.options.width + "x" + message.options.height);
                    response.type = 'Application_resize';
                    response.width = message.options.width;
                    response.height = message.options.height;
                    response.value = true;
                    port.postMessage(response);
                    break;

                case "Panel_hidePanel":
                    Logger.log("Hiding mainPanel!");
                    port.postMessage({type: 'Application_hide'});
                    break;

                case "Chrome_upgradeContinue":
                    applicationState.setCurrentState("stableState");
                    Helper.getGatewayUrl(function(root) {
                        response.type = 'Application_reload';
                        response.url = root;
                        response.value = true;
                        port.postMessage(response);
                    });
                    break;

                case "Chrome_loadIframe":
                    Logger.log('Loading iframe');
                    pinger.firstClickPing();
                    Helper.loadPanelIframe(response, port);
                    break;

                case "Chrome_optionsload":
                    Helper.getTaggedRoot('set', function(first_run_url) {
                        first_run_url += '&embedded=true';
                        response.type = 'Options_reload';
                        response.url = first_run_url;
                        response.value = true;
                        port.postMessage(response);
                    }, '/gp/ubp/misc/settings/settings.html');
                    break;

                case "Chrome_hadNonOBExtension":
                    storage.get('hadNonOBExtension', function(hadNonOBExtension) {
                        if (hadNonOBExtension['hadNonOBExtension']) {
                            response.value = 'true';
                        }
                        else {
                            response.value = 'false';
                        }
                        port.postMessage(response);
                    });
                    break;
                case "Wishlist_wishlistComplete":
                    if (message.options) {
                        if (message.options.itemData) {
                            Helper.wishlistHelper(message.options.itemData);
                        } else { //sent with no data; either old WL or invalid page for scraping (action to take is the same either way)
                            Helper.navigateToGateway();
                        }
                    }
                    break;
                case "Wishlist_uninstallButtonClicked":
                    UNINSTALL_BUS.publish({
                        mType: 'Event.AddonUninstallConfirmation',
                        args: message.options
                    });
                    break;

                case "Wishlist_uninstallPopupShown":
                    UNINSTALL_BUS.publish({
                        mType: 'Event.UninstallWishListPopupShown',
                        args : message.options
                    });
                    break;

                case "Core_getVersion":
                    Logger.log("Getting extension version");
                    response.value = $runtime.getExtensionVersion();
                    port.postMessage(response);
                    break;

                case "Core_getToolbarId":
                    Logger.log("Getting toolbar id");
                    guidManager.getGUIDAsync()
                    .then(function (guid) {
                        response.value = guid;
                        port.postMessage(response);
                    });
                    break;
                case "PingRequest":
                    PING_BUS.publish({
                        mType : 'Event.PingRequest',
                        args : message.options
                    });
                    break;
                default:
                    // Unknown message
                    response.error = true;
                    port.postMessage(response);
                    break;
            }
        }
    };

    var InitializeDefaultSettings = function() {
        Logger.log('InitializeDefaultSettings');
        var skipPersist = {
            "invalidTagbase": 1,
            "overrideTagbase": 1
        };

        Helper.getRootAsync("/gp/ubp/json/config/setup")
        .then(function(root){
            return root;
        })
        .then(function(root){
            return Helper.requestForJSONAsync(root);
        })
        .catch(function (err){
            if (err) {
                Logger.log("Error in getting OneButtonConfig . Error: " + err.message);
            }
        })
        .then(function(oneButtonConfig){
            var simpleStorageAsync = [];
            for(var key in oneButtonConfig){
                if (skipPersist[key] || (key === 'ubp_root' && !applicationState.shouldUpdateUBPRoot() && root_locked == false) || (key === 'gateway_page_url' && applicationState.shouldShowOemFirstrun())) {
                    continue;
                } else {
                    Logger.log('Setting:');
                    Logger.log('options.' + key + ": " + oneButtonConfig[key]);
                    simpleStorageAsync.push($simpleStorage.setAsync({namespace:"options",key:key},oneButtonConfig[key]));
                }
            }

            if(oneButtonConfig['invalidTagbase'] && oneButtonConfig["overrideTagbase"]) {
                simpleStorageAsync.push($simpleStorage.setAsync('tagbase',tagbase));
            }

            return Promise.all(simpleStorageAsync);
        })
        .then(function(){
            // Use this for testing
            //if(applicationState.shouldUpdateUBPRoot()) {
            //    return $simpleStorage.setAsync('options.ubp_root', $config.getDefaultRoot());
            //}
        })
        .then(function(){
            if(!applicationState.shouldShowOemFirstrun()) {
                startSessionTracker();
            }
        })
        .catch(function(err){
            if (err) {
                //Trying to catch error here so that it ensures first run page opening
                Logger.log("Error before opening first run page . Error: " + err.message);
            }
        })
        .then(function(){
            // When 1BA is getting installed, this block is executed just one time
            // it gets attribution context from attribution manager and enables mode
            // and finally opens first run page
            if(applicationState.shouldUpdateUBPRoot() && !applicationState.shouldShowOemFirstrun()) {
                return Promise.bind(this)
                .then(function(){
                    return Helper.attributionManager().getAttributionContextAsync();
                })
                .then(function(context){
                    if(context && context.bitMode && context.bitMode === "smile"){
                        return modeMgr.enableAsync({mode:"smile"});
                    }
                })
                .finally(function(){
                    Helper.openFirstRunPage();
                });
            }
        })
        .then(function(){
            return Helper.attributionManager().startRedemptionAsync();
        })
        .catch(function(err){
            if (err) {
                //Any arror will be caught here and will ensure "Start ping"
                Logger.log("InitializeDefaultSettings has caught some error . Error: " + err.message);
            }
        })
        .then(function(){
            Logger.log("Starting ping");
            pinger.onStartUpCheck();
        });
    };

    if (debug) {
        storage.clear();
    }


var start = function () {
    Promise.bind()
    .then(function () {
    //check if we've already moved the location of acceptedTermsOfUse
        return $simpleStorage.getAsync('options.movedAcceptedTermsOfUse');
    })
    .then(function(movedAcceptedTerms) {
        //if we have alrady moved it, then just return (do nothing)
        if (movedAcceptedTerms === true) {
            //breaks out of this then block, and goes onto the original start function
            return;
        }
        //else get the old terms of use 
        return $simpleStorage.getAsync('acceptedTermsOfUse')
        .then(function (oldAcceptedTerms){
            if (typeof oldAcceptedTerms !== 'undefined') {
                //if the old terms aren't an undefined value, update the new location with the current value
                return $simpleStorage.setAsync('options.acceptedTermsOfUse',oldAcceptedTerms);
            }
            //if the old accepted terms was just undefined, don't do anything
            return;
        })
        .then(function () {
            //regardless of the value of the old accepted terms of use, save the fact that
            //we have already checked and moved if necessary
            return $simpleStorage.setAsync('options.movedAcceptedTermsOfUse',true);
        });
    })
    .then(function() {
        storage.get('options.ubp_root', function(options) {
            Logger.log(options['options.ubp_root']);
            // in case of non-oem install, isOemInstall and acceptedTermsOfUse would be undefined
            storage.get('isOemInstall', function(isOemInstall) {
                storage.get('options.acceptedTermsOfUse', function(acceptedTermsOfUse) {
                    if (!options['options.ubp_root']) {
                        storage.set({'options.ubp_root': $config.getDefaultRoot() }, function() {
                            storage.set({'options.gateway_page_url': '/gp/ubppf/gateway'}, function() {
                            storage.set({'options.default_gateway_width': 343}, function() {
                            storage.set({'options.default_gateway_height': 352}, function() {

                            if( (isOemInstall['isOemInstall'] || (tagbase === 'opera-preload')) && !acceptedTermsOfUse['options.acceptedTermsOfUse']) {
                                applicationState.setCurrentState("oemInstall");
                                storage.set({'options.gateway_page_url': '/gp/ubppf/firstrun'});
                            } else {
                                $updateEventInterceptor.shouldShowUpgradePrompt() ? applicationState.setCurrentState("upgradeFromBookmark") : applicationState.setCurrentState("organicInstall");
                            }
                            InitializeDefaultSettings();
                            });
                            });
                            });
                        });
                     } else {

                           if( (isOemInstall['isOemInstall'] || (tagbase === 'opera-preload')) && !acceptedTermsOfUse['options.acceptedTermsOfUse'] ) {// ugly, ugly hack for Opera preloads
                                applicationState.setCurrentState("oemInstall");
                                storage.set({'options.gateway_page_url': '/gp/ubppf/firstrun'});
                         } else {
                             applicationState.setCurrentState("stableState");
                         }
                         Logger.log('Extension already set up');
                         InitializeDefaultSettings();
                    }
                });
            });
        });
    });
};
    storage.get('tagbase', function(tagbaseOption) {
        // Only set here if there was actually one stored - that way
        // it continues to default to abba-chrome rather than falling
        // through to the catch-all/overrideTagbase received in the setup
        // config
        tagbase = tagbaseOption['tagbase'] || tagbase;
        start();
    });

    chrome.extension.onConnect.addListener(function(port) {
        if (!port){
            return;
        }
        Logger.log(port.name);
        if (port.name === 'UBPAppsChromePanel') {
            panelPort = port;
            panelPort.onDisconnect.addListener(function() {
                panelPort = false;
            });
        }
        port.onMessage.addListener(function(message) {
            Logger.log('Extension got message');
            Logger.log(message);
            MessageHandler.handleMessage(message, port);
        });
    });

    var startSessionTracker = function() {
        // var sessionTracker = new SessionStateTracker({
        //     port: backgroundPseudoPort,
        //     helper: Helper
        // });
        // chrome.tabs.onUpdated.addListener(sessionTracker.onPageUpdated);
    };



    // =============
    // BEGIN UBPv1.5
    // =============

    (function() {

        Promise.onPossiblyUnhandledRejection(function(reason, promise) {
            console.log("Unhandled rejection", reason, promise);
        });

        // Manages the ProductCompassFrame and its Messaging mechanism
        var productCompassManager = new ProductCompassManager({
            platformMessageBus: PLATFORM_BUS,
            // Helper is used as a localeDelegate since it provides the getLocale()
            // method that is used by ProductCompassManager to fetch the current locale.
            localeDelegate: Helper
        });

        // Teardown and setup again when background page is reset.
        // The intent here is to recycle the ProductCompassManager
        // when either the locale changes or user preferences change.
        // However, since these events may happen at the same time,
        // there might be a race condition that causes 2 cycle invocation
        // in quick succession, which is not desirable.
        // The handshaking that maseb@ is working on will help resolve this
        // in an ideal fashion.
        PLATFORM_BUS.subscribe(function(message) {
            if (message.mType === 'Event.ResetBackgroundContext') {
                productCompassManager.cycle();
            }
        });

        var userSettingsDelegate = {
            openSettings: function(cb) {
                Helper.getTaggedRoot('set', function(url) {
                    url += '&embedded=true';
                    chrome.tabs.create({ 'url' : url });
                    cb();
                }, '/gp/ubp/misc/settings/settings.html')
            }
        };

        // TODO: This is an unfortunate reality.
        // The platformService which consults this
        // configuration manager does so for pcomp-specific
        // items. Ideally, the platform configuration manager
        // would contain only platform configuration.
        var platformConfigMgr = new ConfigurationManager({
            config: ProductCompassConfig
        });

        var platformServiceBootstrapper = new PlatformServiceBootstrapper({
            runtime: $runtime,
            platformMessageBus: PLATFORM_BUS,
            userSettingsDelegate: userSettingsDelegate,
            // Helper's getRemoteAttributionParameters takes care of ensuring that
            // setup has occurred before the actual call to the underlying
            // AttributionManager's getRemoteAttributionParameters is called, thus
            // we use the Helper as the delegate, rather than the manager itself.
            // Hopefully this goes away when we re-write the Helper stuff...
            attributionDelegate: {
                getRemoteAttributionParametersAsync:
                    Promise.promisify(Helper.getRemoteAttributionParameters, Helper)
            },
            modeDelegate: modeMgr,
            configurationManager: platformConfigMgr,
            simpleStorageDelegate: $simpleStorage,
            modeDelegate: modeMgr
        });


        var sandboxDelegate = new IframeRemoteProcessSandboxDelegate({
            inboundPort: window
        });

        var tokenVendor = new TokenVendor({
            storage: $nativeStorage
        });

        var featureConfigs = {
            titan: TitanConfig,
            hover: HoverConfig,
            notification: NotificationConfig
        };

        var oneButtonApp = new OneButtonApp({
            platformServiceBootstrapper: platformServiceBootstrapper,
            sandboxDelegate: sandboxDelegate,
            localeDelegate: Helper,
            transportStyle: "postMessage",
            transportStrategyOptions: {},
            productCompassManager: productCompassManager,
            platformCode: "chrome",
            featureConfigs: featureConfigs,
            tokenVendor: tokenVendor,
            simpleStorageDelegate: $simpleStorage,
            pinger: pinger,
            guidManager: guidManager,
            runtime : $runtime
        });

        oneButtonApp.start(function() {
            Logger.log("All started");
        });

        window.oneButtonApp = oneButtonApp;
        window.productCompassManager = productCompassManager;

    }());

    (function () {
        var uninstallWishListFunctions = new UninstallWishListFunctions({
            applicationState : applicationState,
            simpleStorage : $simpleStorage,
            pingDelegate : pinger
        });

        var chromeUninstaller = new Uninstaller({
            messageBus : UNINSTALL_BUS,
            getRootDelegate : Helper,
            runtime : new ChromeRuntime(),
            extensionSpecificFunctions : {
                wishlist : uninstallWishListFunctions
            },
            networkClient : new XHRClient()
        });

        chromeUninstaller.start();

        window.chromeUninstaller = chromeUninstaller;
    }());

    // ============
    // END UBPv1.5
    // ============
});

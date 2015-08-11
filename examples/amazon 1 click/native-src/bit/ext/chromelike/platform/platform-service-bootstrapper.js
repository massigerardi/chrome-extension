var factory = function(
    _,
    Promise,
    $options,
    $taskManager,
    PlatformService,

    PlatformPageNavHandler,
    PlatformContentHandler,
    PlatformSandboxHandler,
    PlatformStyleHandler,
    PlatformInteractionHandler,
    PlatformMetaHandler,
    PlatformHoverHandler,
    PlatformAttributionHandler,
    PlatformConfigHandler,
    PlatformUserSettingsHandler,
    PlatformActiveTabHandler,
    SimpleStorageHandler,
    NetworkXhrRequestHandler,
    AlertsBadgeCountHandler,
    ScraperPeerController,
    SandboxPeerController,
    StylePeerController,
    InteractionPeerController,
    MetaPeerController,
    HoverPeerController
) {

    var PlatformBootstrapper = function() {
        this.initialize.apply(this, arguments);
    };


    _.extend(PlatformBootstrapper.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._platformMessageBus   = opts.getOrError("platformMessageBus");
            this._userSettingsDelegate = opts.getOrError("userSettingsDelegate");
            this._attributionDelegate  = opts.getOrError("attributionDelegate");
            this._modeDelegate         = opts.getOrError("modeDelegate");
            this._configMgr            = opts.getOrError("configurationManager");
            this._simpleStorageDelegate= opts.getOrError("simpleStorageDelegate");
            this._eventHandlers        = {};
            this._runtime              = opts.getOrError("runtime");
            // Make repeat calls to _setupHandlers idempotent
            this._setupHandlers        = _.once(_.bind(this._setupHandlers, this));
            this._bootstrapped         = false;
        },

        bootstrap: Promise.method(function() {
            var service = new PlatformService();
            return Promise.bind(this)
            .then(function() {
                if (this._bootstrapped) {
                    throw new Error("Cannot bootstrap twice");
                }
                this._bootstrapped = true;
                this._setupHandlers();
                return this._bindHandlers(service);
            })
            .then(function() {
                return service;
            })
        }),

        // _setupHandlers has been bound using underscore.once so that it
        // only executes once even if it is invoked multiple times
        _setupHandlers: function() {


            var CHROME_SEND_MESSAGE = _.bind(this._runtime.sendMessage, this._runtime);
            var CHROME_EXECUTE_SCRIPT = _.bind(this._runtime.executeScript, this._runtime);

            // BEGIN Contextual Page Turn
            var pageTurnEvent = "Contextual.PageTurn";
            var pageTurnHandler = new PlatformPageNavHandler({
                platformMessageBus: this._platformMessageBus
            });

            this._eventHandlers[pageTurnEvent] = pageTurnHandler;
            // END Contextual Page Turn


            // BEGIN Contextual Scraper
            var scraperPeerController = new ScraperPeerController({
                contentScripts: ["native-src/bit/ext/core/platform/contextual-libraries/scraper-library.js",
                                 "native-src/bit/ext/chromelike/platform/contextual-drivers/scraper-driver.js"],
                executeScript: CHROME_EXECUTE_SCRIPT,
                sendMessage: CHROME_SEND_MESSAGE
            });

            var scrapeContentEvent = "Contextual.ScrapeContent";
            var scrapeContentHandler = new PlatformContentHandler({peerController: scraperPeerController});

            this._eventHandlers[scrapeContentEvent] = scrapeContentHandler;
            // END Contextual Scraper


            // BEGIN Contextual Sandbox
            var sandboxPeerController = new SandboxPeerController({
                contentScripts: ["native-src/bit/ext/core/platform/contextual-libraries/sandbox-library.js",
                                 "native-src/bit/ext/chromelike/platform/contextual-drivers/sandbox-driver.js"],
                executeScript: CHROME_EXECUTE_SCRIPT,
                sendMessage: CHROME_SEND_MESSAGE
            });

            var sandboxHandler = new PlatformSandboxHandler({
                platformMessageBus: this._platformMessageBus,
                peerController: sandboxPeerController
            });

            this._eventHandlers["Contextual.CreateSandbox"] = sandboxHandler;
            this._eventHandlers["Contextual.ModifySandbox"] = sandboxHandler;
            this._eventHandlers["Contextual.DestroySandbox"]= sandboxHandler;
            // END Contextual Sandbox

            // BEGIN Contextual Style
            var stylePeerController = new StylePeerController({
                contentScripts: ["native-src/bit/ext/core/platform/contextual-libraries/style-library.js",
                                 "native-src/bit/ext/chromelike/platform/contextual-drivers/style-driver.js"],
                executeScript: CHROME_EXECUTE_SCRIPT,
                sendMessage: CHROME_SEND_MESSAGE
            });

            var styleHandler = new PlatformStyleHandler({
                peerController: stylePeerController
            });

            this._eventHandlers["Contextual.ApplyStyle"] = styleHandler;
            this._eventHandlers["Contextual.ResetStyle"] = styleHandler;
            // END Contextual Style

            // BEGIN Contextual Hover
            var hoverPeerController = new HoverPeerController({
                contentScripts: ["native-src/bit/ext/core/platform/contextual-libraries/hover-library.js",
                                 "native-src/bit/ext/chromelike/platform/contextual-drivers/hover-driver.js"],
                executeScript: CHROME_EXECUTE_SCRIPT,
                sendMessage: CHROME_SEND_MESSAGE
            });

            var hoverHandler = new PlatformHoverHandler({
                peerController: hoverPeerController,
                platformMessageBus: this._platformMessageBus
            });

            this._eventHandlers["Contextual.HoverInject"] = hoverHandler;
            // END Contextual Hover

            // BEGIN Contextual Interaction
            var interactionPeerController = new InteractionPeerController({
                contentScripts: ["native-src/bit/ext/core/platform/contextual-libraries/interaction-library.js",
                                 "native-src/bit/ext/chromelike/platform/contextual-drivers/interaction-driver.js"],
                executeScript: CHROME_EXECUTE_SCRIPT,
                sendMessage: CHROME_SEND_MESSAGE
            });

            var interactionHandler = new PlatformInteractionHandler({
                platformMessageBus: this._platformMessageBus,
                peerController: interactionPeerController
            });

            this._eventHandlers["Contextual.RegisterPageBodyClick"] = interactionHandler;
            this._eventHandlers["Contextual.DeregisterMultipleEvents"] = interactionHandler;
            // END Contextual Interaction
            try {
                // BEGIN Contextual Meta
                var metaPeerController = new MetaPeerController({
                    contentScripts: ["native-src/bit/ext/core/platform/contextual-libraries/meta-library.js",
                                     "native-src/bit/ext/chromelike/platform/contextual-drivers/meta-driver.js"],
                    executeScript: CHROME_EXECUTE_SCRIPT,
                    sendMessage: CHROME_SEND_MESSAGE
                });

                var metaHandler = new PlatformMetaHandler({
                    peerController: metaPeerController
                });

                this._eventHandlers["Contextual.GetPageLocationData"] = metaHandler;
                this._eventHandlers["Contextual.GetPageDimensionData"] = metaHandler;
                this._eventHandlers["Contextual.GetPerformanceTimingData"] = metaHandler;
                // END Contextual Meta

            } catch(e) {
                console.error(e);
            }

            //  BEGIN Attribution
            var attributionHandler = new PlatformAttributionHandler({
                attributionDelegate: this._attributionDelegate,
                modeDelegate: this._modeDelegate
            });

            this._eventHandlers["Attribution.GetRemoteAttributionParameters"] = attributionHandler;
            // END Attribution


            // BEGIN Configuration handler
            var configHandler = new PlatformConfigHandler({
                configurationManager: this._configMgr
            });
            this._eventHandlers["Config.Get"] = configHandler
            this._eventHandlers["Config.GetLocaleSpecificConfig"] = configHandler;
            // END Configuration handler

            // BEGIN User Settings handler
            this._eventHandlers["UserSettings.OpenSettings"] = new PlatformUserSettingsHandler({
                delegate: this._userSettingsDelegate
            });
            // END user settings handler

            // BEGIN ActiveTab handler
            this._eventHandlers["Tabs.GetActiveTabId"] = new PlatformActiveTabHandler({
                runtime: this._runtime
            });
            // END ActiveTab handler

            // BEGIN SimpleStorage handler
            var simpleStorageHandler = new SimpleStorageHandler({
                delegate : this._simpleStorageDelegate,
                platformMessageBus : this._platformMessageBus,
                runtime : this._runtime
            });

            this._eventHandlers["Storage.Get"] = simpleStorageHandler;
            this._eventHandlers["Storage.Set"] = simpleStorageHandler;
            this._eventHandlers["Storage.OnChange"] = simpleStorageHandler;
            this._eventHandlers["Storage.GetAvailableMemory"] = simpleStorageHandler;
            //END SimpleStorage handler
            //BEGIN SimpleStorage OnChange
            //This function provides
            this._simpleStorageDelegate.bindOnChange(_.bind(function(namespace,key){
                var msg = PlatformEventMessage.StorageOnChange(namespace,key);
                this._platformMessageBus.publish(msg);
            },this));
            //END SimpleStorage OnChange

            // BEGIN XHR request handler
            var amazonXhrRequestHandler = new NetworkXhrRequestHandler({
                simpleStorage : this._simpleStorageDelegate
            });
            this._eventHandlers["Network.AmazonXhrRequest"] = amazonXhrRequestHandler;
            this._eventHandlers["Network.AmazonXhrTimeObject"] = amazonXhrRequestHandler;
            // END user XHR request handler
            // BEGIN AlertsBadge handler
            var alertsBadgeCountHandler = new AlertsBadgeCountHandler({
                runtime: this._runtime,
                simpleStorage: this._simpleStorageDelegate
            });
            this._eventHandlers["AlertsBadge.SetCount"] = alertsBadgeCountHandler;
            this._eventHandlers["AlertsBadge.GetCount"] = alertsBadgeCountHandler;
            // END AlertsBadge handler

            this._runtime.bindOnTabUpdated(_.bind(function(tabId, changeInfo, tab) {
                var msg = PlatformEventMessage.ContextualPageTurn(tabId, tab.url, changeInfo.status);
                this._platformMessageBus.publish(msg);
            }, this));

            this._runtime.bindOnMessage(_.bind(function(msg, sender, responseDelegate) {
                // We're going to drop the reponseDelegate for the purposes of this API.
                // Things sent along the bus are inherently 1-way, not request/reply

                // We're also going to drop messages that aren't from tabs. This event is
                // specifically for messages coming from tabs ("external content")

                // Lastly, we only care about mType "UBPExternalEvent", which we turn into
                // an "Contextual.ExternalEvent" internally.
                if (sender && sender.tab && msg && msg.mType === "UBPExternalMessage") {
                    this._platformMessageBus.publish(
                        PlatformEventMessage.ContextualExternalMessage(sender.tab.id, msg.data)
                    );
                }
            }, this));

            this._runtime.bindOnTabUpdated(function(tabId, changeInfo, tab) {
                if (changeInfo.status === "loading") {
                    scraperPeerController.resetState(tabId);
                    sandboxPeerController.resetState(tabId);
                    stylePeerController.resetState(tabId);
                    interactionPeerController.resetState(tabId);
                    metaPeerController.resetState(tabId);
                    hoverPeerController.resetState(tabId);
                }
            });
        },
        _bindHandlers: Promise.method(function(service) {
            var registry = service.registry();
            var register = Promise.promisify(registry.register, registry);
            return Promise.all(_.map(this._eventHandlers, function(handler, handlerName) {
                return register(handlerName, handler);
            }));
        })


    });


    var PlatformEventMessage = {
        ContextualPageTurn: function(externalId, url, status) {
            return {
                mType: "platformEvent",
                eventName: "Contextual.PageTurn",
                args: {
                    externalId: externalId,
                    url: url,
                    // status should be "loading" or "complete"
                    status: status
                }
            };
        },
        ContextualExternalMessage: function(externalId, data) {
            return {
                mType: "platformEvent",
                eventName: "Contextual.ExternalMessage",
                args: {
                    externalId: externalId,
                    data: data
                }
            }
        },
        StorageOnChange: function(namespace,key) {
            return {
                mType: "platformEvent",
                eventName: "Storage.OnChange",
                args: {
                    namespace : namespace,
                    key : key
                }
            };
        }
    };



    return PlatformBootstrapper;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/task-manager"),
        require("bit/ext/core/platform/platform-service"),

        require("bit/ext/core/platform/handlers/contextual/page-nav"),
        require("bit/ext/core/platform/handlers/contextual/content"),
        require("bit/ext/core/platform/handlers/contextual/sandbox"),
        require("bit/ext/core/platform/handlers/contextual/style"),
        require("bit/ext/core/platform/handlers/contextual/interaction"),
        require("bit/ext/core/platform/handlers/contextual/meta"),
        require("bit/ext/core/platform/handlers/contextual/hover"),
        require("bit/ext/core/platform/handlers/attribution/attribution"),
        require("bit/ext/core/platform/handlers/config/config"),
        require("bit/ext/core/platform/handlers/config/user-settings"),
        require("bit/ext/core/platform/handlers/tabs/active-tab"),
        require("bit/ext/core/platform/handlers/storage/simple-storage"),
        require("bit/ext/core/platform/handlers/network/amazon-xhr-request"),
        require("bit/ext/core/platform/handlers/alerts-badge-count"),
        require("bit/ext/core/platform/scraper-peer-controller"),
        require("bit/ext/core/platform/sandbox-peer-controller"),
        require("bit/ext/core/platform/style-peer-controller"),
        require("bit/ext/core/platform/interaction-peer-controller"),
        require("bit/ext/core/platform/meta-peer-controller"),
        require("bit/ext/core/platform/hover-peer-controller")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/task-manager",
        "bit/ext/core/platform/platform-service",
        "bit/ext/core/platform/handlers/contextual/page-nav",
        "bit/ext/core/platform/handlers/contextual/content",
        "bit/ext/core/platform/handlers/contextual/sandbox",
        "bit/ext/core/platform/handlers/contextual/style",
        "bit/ext/core/platform/handlers/contextual/interaction",
        "bit/ext/core/platform/handlers/contextual/meta",
        "bit/ext/core/platform/handlers/contextual/hover",
        "bit/ext/core/platform/handlers/attribution/attribution",
        "bit/ext/core/platform/handlers/config/config",
        "bit/ext/core/platform/handlers/config/user-settings",
        "bit/ext/core/platform/handlers/tabs/active-tab",
        "bit/ext/core/platform/handlers/storage/simple-storage",
        "bit/ext/core/platform/handlers/network/amazon-xhr-request",
        "bit/ext/core/platform/handlers/alerts-badge-count", 
        "bit/ext/core/platform/scraper-peer-controller",
        "bit/ext/core/platform/sandbox-peer-controller",
        "bit/ext/core/platform/style-peer-controller",
        "bit/ext/core/platform/interaction-peer-controller",
        "bit/ext/core/platform/meta-peer-controller",
        "bit/ext/core/platform/hover-peer-controller"
    ], factory);
}

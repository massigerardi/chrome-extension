define([
    "underscore",
    "bluebird",
    "bit/commons/options",
    "bit/commons/flow",
    "bit/commons/task-manager",
    "bit/ext/chromelike/storage/native-storage",
    "bit/ext/core/storage/simple-storage",
    "bit/ext/core/components/token-vendor",
    "bit/ext/chromelike/platform/product-compass-frame",
    "bit/messaging/strategies/post-message-transport-strategy",
    "bit/ext/core/components/configuration-manager",
    "bit/ext/core/config/product-compass-local-config",
    "bit/commons/state-latch",
    "bit/messaging/message-exchange"
], function(
    _,
    Promise,
    $options,
    Flow,
    $taskManager,
    $nativeStorage,
    SimpleStorage,
    TokenVendor,
    ProductCompassFrame,
    PostMessageTransportStrategy,
    ConfigurationManager,
    ProductCompassConfig,
    StateLatch,
    MessageExchange
) {

    "use strict";

    var ProductCompassManager = function() {
        this.initialize.apply(this, arguments);
    };

    // The MessageExchange used by the PlatformService has a
    // 30 second time-out on sendAndReceive messages.
    // The health check period is greater than 30 seconds
    // because we don't want to have multiple terminateSession
    // waiting for a reply. The health check is bounded by a maximum
    // backoff period to prevent entry to an unrecoverable "dead" state.
    // TODO: Move to a remote configuration
    var CONSTANTS = {
        INITIAL_HEALTH_CHECK_PERIOD: 60 * 1000,  // one minute
        BASE_HEALTH_CHECK_PERIOD: 5 * 60 * 1000, // five minutes
        HOST_PING_TIMEOUT: 30 * 1000,            // thirty seconds
        MAXIMUM_BACKOFF_PERIOD: 60 * 60 * 1000   // one hour
    };

    _.extend(ProductCompassManager.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._configMgr = new ConfigurationManager({
                config: ProductCompassConfig
            });
            this._configMgr.start();
            this._localeDelegate = opts.getOrError("localeDelegate");
            this._productCompassFrame = null;
            this._transport = new PostMessageTransportStrategy({
                identity: "ProductCompassManager",
                inboundFilter: function(msg) {
                    return msg.origin === "RemotePlatform:RemoteProcessDelegate:PComp";
                }
            });

            this._exchange = new MessageExchange();
            this._transport.forward(this._exchange.egressChannel());
            this._exchange.listen(this._transport.dispatchChannel());

            _.bindAll(this, "_healthCheck", "teardown");

            // Health check BEGINS
            // This should ideally be present in a separate module
            // that tracks state of all the applications.
            this._isActive = false;
            this._retryAttemptCount = 0;
            $taskManager.scheduleTask(this._healthCheck, CONSTANTS.INITIAL_HEALTH_CHECK_PERIOD);
            // Health check ENDS

            // This semaphore ensures that only one call to the
            // asynchronous methods teardown and setup is active
            // at a time.
            this._productCompassManagerSemaphore = 1;

        },

        hostPing: function() {
            this._hostPingTimestamp = Date.now();
        },

        /**
         * Performs the health check.
         * Uses the following exponential back-off algorithm:
         * http://docs.aws.amazon.com/general/latest/gr/api-retries.html
         */
        _healthCheck: function() {
            if (!this._isActive || !this._hostPingTimestamp || (Date.now() - this._hostPingTimestamp) > CONSTANTS.HOST_PING_TIMEOUT) {
                this.cycle();
                this._retryAttemptCount++;
            } else {
                this._retryAttemptCount = 0;
            }

            var retryDelay = Math.min(Math.pow(2, this._retryAttemptCount) * CONSTANTS.BASE_HEALTH_CHECK_PERIOD, CONSTANTS.MAXIMUM_BACKOFF_PERIOD);
            $taskManager.scheduleTask(this._healthCheck, retryDelay);
        },

        exchange: function() {
            return this._exchange;
        },

        setup: function(options) {
            this._productCompassManagerSemaphore++;
            if (this._productCompassManagerSemaphore > 1) {
                this._productCompassManagerSemaphore = 1;
                return;
            }

            options = $options.fromObject(options);

            var setupParams = {};
            setupParams.locale = options.getOrElse('locale', 'xx');

            var setupLatch = new StateLatch([
                "knobCheck",
                "localeCheck",
                "settingsCheck",
                "scompKnobCheck"
            ], _.bind(function(err) {
                if (err) {
                    return;
                }
                this._productCompassFrame = new ProductCompassFrame({
                    endpoint: setupParams.endpoint,
                    params: {
                        inboundPort: 'window',
                        outboundPort: 'parent',
                        platform: 'Chrome',
                        isSCompEnabled:setupParams.isSCompEnabled
                    },
                    locale: setupParams.locale
                });

                // Wire up ProductCompassFrame
                document.body.appendChild(this._productCompassFrame.getFrame());

                // Bind new frame to existing transport
                this._transport.bind({
                    inboundPort: window,
                    outboundPort: this._productCompassFrame.getPort()
                });


                this._isActive = true;
            }, this));

            var storage = new SimpleStorage($nativeStorage);
            storage.get("options.alertList", function(err, alertList) {
                // This handles the scenario where the alertList was not
                // initialized by the First Run page and is hence 'undefined'.
                if(!alertList) {
                    alertList = "sia";
                }
                if (err || !_.contains(alertList.split(","), "sia")) {
                    setupLatch.error(err || new Error("ProductCompass is disabled in Settings."));
                    return;
                }
                setupLatch.trigger("settingsCheck");
            });

            this._configMgr.get("locales", function(err, locales) {
                // Locale check
                if (err || !locales) {
                    setupLatch.error(err || new Error("Error fetching locale details."));
                    return;
                }
                var localeConfig = locales[setupParams.locale];
                if (!localeConfig || !localeConfig.pcompHost || !localeConfig.knobValue || typeof localeConfig.knobValue.chrome === "undefined") {
                    setupLatch.error(new Error("Unsupported locale."));
                    storage.set("options.IsProductCompassEnabled", "false", function() {});
                    return;
                }

                // Add "sia" to the alertList for existing clients who haven't opened the gateway
                // since the silent update and hence don't have "sia" in the masterAlertList
                storage.get("options.previousAvailableAlerts", function(err, masterAlertList) {
                    if (err) {
                        return;
                    }
                    if (masterAlertList && !_.contains(masterAlertList.split(","), "sia")) {
                        var masterAlerts = masterAlertList.split(",");
                        if(masterAlerts.indexOf("nil") > -1) {
                            masterAlerts.splice(masterAlerts.indexOf("nil"), 1);
                        }
                        masterAlerts.push("sia");
                        masterAlertList = masterAlerts.join(",");
                        storage.set("options.previousAvailableAlerts", masterAlertList, function() {});
                        storage.get("options.alertList", function(err, alertList) {
                            if(err) {
                                return;
                            }
                            if(alertList && !_.contains(alertList.split(","), "sia")) {
                                var alerts = alertList.split(",");
                                if(alerts.indexOf("nil") > -1) {
                                    alerts.splice(alerts.indexOf("nil"), 1);
                                }
                                alerts.push("sia");
                                alertList = alerts.join(",");
                                storage.set("options.alertList", alertList, function() {});
                            }
                        });
                    }
                });

                setupLatch.trigger("localeCheck");
                // Get the endpoint.
                setupParams.endpoint = localeConfig.pcompHost;
                // Weblab check
                var tokenVendor = new TokenVendor({
                    storage: $nativeStorage
                });
                tokenVendor.verifyToken("ProductCompass", localeConfig.knobValue.chrome, function(err, isValid) {
                    if (err || !isValid) {
                        setupLatch.error(err || new Error("ProductCompass is inactive."));
                        storage.set("options.IsProductCompassEnabled", "false", function() {});
                        return;
                    }
                    setupLatch.trigger("knobCheck");
                    storage.set("options.IsProductCompassEnabled", "true", function() {});
                });
		//We use the same token for validating scomp and pcomp knobvalue i.e. if pcomp is disabled, scomp will be disabled.
                tokenVendor.verifyToken("ProductCompass", localeConfig.scompKnobValue.chrome, function(err, isValid) {
                    if (err || !isValid) {
                        setupParams.isSCompEnabled = false;
                    } else {
                    	setupParams.isSCompEnabled = true;
                    }
                    setupLatch.trigger("scompKnobCheck");
                });
            });
        },

        // The callback 'cb' will always be invoked as cb() i.e.,
        // no errors or arguments will be passed to this callback.
        teardown: function(cb) {
            this._productCompassManagerSemaphore--;
            if (this._productCompassManagerSemaphore < 0) {
                this._productCompassManagerSemaphore = 0;
                return;
            }

            var tearDownLatch = new StateLatch([
                "terminateSessions"
            ], _.bind(function(err) {

                // Unbind the transport from the frame and window
                if(this._transport) {
                    this._transport.unbind();
                }

                // Remove frame from DOM
                var frame = this.productCompassFrame && this._productCompassFrame.getFrame();
                if(frame && frame.parentNode) {
                    frame.parentNode.removeChild(frame);
                }
                this._productCompassFrame = null;
                this._isActive = false;
                cb();
            }, this));

            // This should use a separate exchange that has the semantics of
            // PlatformService being a client of PCompHost.
            try {
                if(!this._productCompassFrame) {
                    tearDownLatch.trigger("terminateSessions");
                    return;
                }

                this._exchange.sendAndReceive({
                    mType: "platformRequest",
                    eventName: "Contextual.TerminateSessions"
                }, function(err) {
                    // Error or not, we tear down
                    if(err) {
                        tearDownLatch.error(err);
                        return;
                    }
                    tearDownLatch.trigger("terminateSessions");
                });

            } catch(err) {
                tearDownLatch.error(err);
            }
        },

        cycle: function() {
            // This promise workflow collects parameters in each
            // workflow step, that are required to re-setup the
            // ProductCompassManager
            Promise.bind({
                productCompassManager: this,
                setupParams: {}
            })
            .then(function() {
                // First teardown existing components
                return this.productCompassManager.teardownAsync();
            })
            .then(function(params) {
                // Figure out the locale
                return new Promise(_.bind(function(resolvedCb, rejectedCb) {
                    this._localeDelegate.getLocale(resolvedCb);
                }, this.productCompassManager));
            })
            .then(function(locale) {
                // Save the locale
                this.setupParams.locale = locale;
            })
            .then(function() {
                // Re-setup ProductCompassManager
                return this.productCompassManager.setup(this.setupParams);
            })
            .then(function() {
                // All done (placeholder step)
                return Promise.resolve();
            });
        }
    });

    Promise.promisifyAll(ProductCompassManager.prototype);

    return ProductCompassManager;
});

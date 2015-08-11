var factory = function(
    _,
    Promise,
    Flow,
    $lang,
    $ajax,
    $options,
    StateLatch,
    PromotionManager
) {
    "use strict";

    var CACHED_CONTEXT_KEY = "options.attribution_context";
    var CACHED_CONTEXT_VERSION = 1;
    // 6 hour timeout on cached context
    var CACHED_CONTEXT_TTL = 6 * 60 * 60 * 1000;

    // 30 seconds, testing
    // var CACHED_CONTEXT_TTL = 30 * 1000;

    var CC_SUFFIX_MAP = {
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

    var objectToParams = function(obj) {
        return _.collect(obj, function(val, key) {
            return encodeURIComponent(key) + "=" + (typeof val === "undefined" || val === null ? "" : encodeURIComponent(val));
        }).join("&");
    }

    // Used for client-server comm. Private class.
    var AttributionClient = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(AttributionClient.prototype, {
        Endpoints: {
            AttributionInfo: "/gp/ubp/json/RATT/attributionInfo"
        },

        initialize: function(storage) {
            this._storage = storage;
        },
        // Should return:
        // {
        //     namespace: "...",
        //     partner: "...", // same as provided
        //     partnerCode: "...",
        //     app: "...", // same as provided
        //     platform: "...", // same as provided
        //     productCode: "..."
        // }
        getAttributionInformation: function(opts, cb) {
            opts = $options.fromObject(opts);

            var tagbase      = opts.getOrError("tagbase"),
                platform     = opts.getOrError("platform"),
                app          = opts.getOrError("app"),
                campaignCode = opts.getOrElse("campaignCode", null),
                associateId  = opts.getOrElse("associateId",null),
                bitMode      = opts.getOrElse("bitMode",null);

            cb = cb || $lang.noop;

            // TODO: Factor out helper.js. Finally. Please.
            this._storage.get("options.ubp_root", _.bind(function(err, root) {
                if (err) {
                    cb(err);
                    return;
                }

                var params = {
                    tagbase: tagbase,
                    platform: platform,
                    app: app
                };

                if (campaignCode) params["campaignCode"] = campaignCode;
                if (associateId) params["associateId"] = associateId;
                if (bitMode) params["bitMode"] = bitMode;


                var url = root +
                          this.Endpoints.AttributionInfo +
                          "?" +
                          objectToParams(params);


                $ajax.getJson(url, function(err, info) {
                    if (err) {
                        cb(err);
                        return;
                    }

                    cb(null, info);
                });
            }, this));
        }
    });

    var AttributionManager = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(AttributionManager.prototype, {
        initialize: function(opts) {
            this._cachedContext = null;
            $lang.params(opts)
                .req("app")
                .req("platform")
                .req("tagbaseDelegate")
                .req("storage")
                .req("campaignCodeDelegate")
                .req("associateIdDelegate")
                .req("bitModeDelegate")
                .req("localeDelegate");

            this._storage = opts.storage;

            this._attributionClient = new AttributionClient(this._storage);

            this._app = opts.app;
            this._platform = opts.platform;


            // Async function to retrieve tagbase when requested.
            this._tagbaseDelegate = opts.tagbaseDelegate;
            // Async function to retrieve campaign code from localStorage when requested
            //                            associate id
            //                            bitMode
            this._campaignCodeDelegate = opts.campaignCodeDelegate;
            this._associateIdDelegate = opts.associateIdDelegate;
            this._bitModeDelegate = opts.bitModeDelegate;
            // Async function to retrieve locale/countryCode when requested.
            this._localeDelegate = opts.localeDelegate;

            this._promotionManager = new PromotionManager({storage: this._storage});
        },

        start: function(cb) {
            // XXX: Here is where we'd do a history check and update our
            // partnerID appropriately.
            Flow.getInstance().nextTick(cb);
        },

        // Gets ONLY the params required for attribution (ref, tag)
        getAttributionParameters: function(opts, cb) {
            this._getTagContext(opts, cb);
        },
        // Gets all attribution params and value
        getAttributionContext: function(cb) {
            this._getCachedContext(cb);
        },
        // Gets ONLY the tag for attribution (ref)
        getTagAttributionParameter: function(opts, cb) {
            if (arguments.length < 2) {
                cb = opts;
                opts = {};
            }
            cb = cb || $lang.noop;
            this._getCachedContext(_.bind(function(err, context) {
                if (err) {
                    cb(err);
                    return;
                }

                var tagContext = {};

                this._getTag({
                    partnerTagCode: context.partnerTagCode,
                    programCode: context.programCode,
                    productCode: context.tagSafeProductCode
                }, function(err, tag) {
                    if (err) {
                        return;
                    }

                    tagContext["tag"] = tag;
                    cb(tagContext);
                });
            }, this));
        },

        // Gets ONLY the ref for attribution (ref)
        // Useful when we need to attribute (campaign attribution)
        // e.g., for ping and install ping requests.
        getRefAttributionParameter: function(opts, cb) {
            if (arguments.length < 2) {
                cb = opts;
                opts = {};
            }
            cb = cb || $lang.noop;
            this._getCachedContext(_.bind(function(err, context) {
                if (err) {
                    cb(err);
                    return;
                }

                var refContext = {};

                this._getRef({
                    namespace: context.namespace,
                    partnerRefCode: context.partnerRefCode,
                    programCode: context.programCode,
                    productCode: context.refSafeProductCode,
                    featureCode: opts.featureCode
                }, function(err, ref) {
                    if (err) {
                        return;
                    }
                    refContext["ref_"] = ref;
                    cb(null, refContext);
                });

            }, this));

        },

        // Union of getAttributionParameters and getRemoteAttributionParameters
        // Useful when we need to attribute and make a request at the same time
        // e.g., for ping and install ping requests.
        getParams: function(opts, cb) {
            var returnContext = {};
            var latch = new StateLatch(["local", "remote"], $lang.returns(returnContext, cb));
            this.getAttributionParameters(opts, function(err, params) {
                if (err) {
                    latch.error(err);
                    return;
                }
                _.extend(returnContext, params);
                latch.trigger("local")
            });

            this.getRemoteAttributionParameters(function(err, params) {
                if (err) {
                    latch.error(err);
                    return;
                }

                _.extend(returnContext, params);
                latch.trigger("remote");
            });
        },

        // The bits of pieces the server needs
        // in order to determine the attribution information remotely.
        getRemoteAttributionParameters: function(cb) {
            // We should prefer to send only partner (not partner code) when we have it.
            // So we do a lookup for partner (which looks it up using tagbase)
            this._getCachedContext(_.bind(function(err, context) {
                if (err) {
                    cb(err);
                    return;
                }

                var partner = context.partner,
                    programCode = context.programCode,
                    tagbase = context.tagbase;

                var params = {
                    partner: partner,
                    programCode: programCode,
                    app: this._app,
                    platform: this._platform,
                    tagbase: tagbase
                };

                cb(null, params);
            }, this));
        },

        startRedemption: function(cb) {
            this._getCachedContext(_.bind(function(err, context) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }

                if(!context.isValidCampaignCode) {
                    cb(new Error("Campaign code is invalid."));
                }
                else {
                    this._promotionManager.redeemPromotion(context.campaignCode, cb);
                }
            }, this));
        },

        _getTagContext: function(opts, cb) {
            if (arguments.length < 2) {
                cb = opts;
                opts = {};
            }
            cb = cb || $lang.noop;
            this._getCachedContext(_.bind(function(err, context) {
                if (err) {
                    cb(err);
                    return;
                }

                var tagContext = {};

                // Phones home the result when _getTag and _getRef complete.
                var latch = new StateLatch(["ref","tag"], $lang.returns(tagContext, cb));

                this._getTag({
                    partnerTagCode: context.partnerTagCode,
                    programCode: context.programCode,
                    productCode: context.tagSafeProductCode
                }, function(err, tag) {
                    if (err) {
                        latch.error(err);
                        return;
                    }

                    tagContext["tag"] = tag;
                    latch.trigger("tag");
                });

                this._getRef({
                    namespace: context.namespace,
                    partnerRefCode: context.partnerRefCode,
                    programCode: context.programCode,
                    productCode: context.refSafeProductCode,
                    featureCode: opts.featureCode
                }, function(err, ref) {
                    if (err) {
                        latch.error(err);
                        return;
                    }
                    tagContext["ref_"] = ref;
                    latch.trigger("ref");
                });

            }, this));
        },

        _getTag: function(opts, cb) {
            opts = $options.fromObject(opts);
            var partnerTagCode  = opts.getOrError("partnerTagCode"),
                programCode  = opts.getOrError("programCode"),
                productCode  = opts.getOrError("productCode");

            // TODO: Don't rely on simple-storage directly
            this._localeDelegate(function(locale) {
                var countryCode = locale.toLowerCase();
                var suffix = CC_SUFFIX_MAP[countryCode];

                if (!(countryCode && suffix)) {
                    cb(new Error("Not enough information to generate AssocTag; countryCode or suffix missing. " + countryCode + "; " + suffix));
                    return;
                }

                //   For tags:
                //   [pre]            [product code]
                //   bitb-[partnerCode]-[programCode]-appCode-platformCode-country-countryCode
                //

                var tag = [
                    partnerTagCode,
                    programCode,
                    productCode,
                    countryCode,
                    suffix
                ].join("-");

                cb(null, tag);
            });

        },

        _getRef: function(opts, cb) {
            opts = $options.fromObject(opts);
            var namespace    = opts.getOrError("namespace"),
                partnerRefCode  = opts.getOrError("partnerRefCode"),
                programCode  = opts.getOrError("programCode"),
                productCode  = opts.getOrError("productCode"),
                featureCode  = opts.getOrElse("featureCode", "def");

            this._localeDelegate(function(locale) {
                var countryCode = locale.toLowerCase();

                if (!countryCode) {
                    cb(new Error("Not enough information to generate refTag; countryCode missing."));
                    return;
                }

                //   For refs:
                //   [pre]            [product code]
                //   bitb_partnerCode_appCode-platformCode_featureCode_country

                var tag = [
                    namespace,
                    partnerRefCode,
                    programCode,
                    productCode,
                    featureCode,
                    countryCode
                ].join("_");

                cb(null, tag);
            });

        },
        _isValidContext: function(context) {
            return (context.context &&
                    context.version == CACHED_CONTEXT_VERSION &&
                    context.time &&
                    Date.now() - context.time < CACHED_CONTEXT_TTL);
        },
        _getCachedContext: function(cb){
            cb = cb || $lang.noop;
            // TODO: Make this contention-safe by queueing up CBs and dispatching
            // on final success.
            if (this._cachedContext && this._isValidContext(this._cachedContext)) {
                Flow.getInstance().nextTick($lang.partiallyApply(cb, null, this._cachedContext.context));
                return;
            }

            // TODO: We should probably be passing in a cache delegate
            // rather than using simple storage directly. Makes testing easier...
            this._storage.get(CACHED_CONTEXT_KEY, _.bind(function(err, cachedContext) {
                if (err) {
                    cb(err);
                    return;
                }

                if (cachedContext && this._isValidContext(cachedContext)) {
                    this._cachedContext = cachedContext;
                    cb(null, cachedContext.context);
                    return;
                }

                this._tagbaseDelegate(_.bind(function(err, tagbase) {
                    if (err) {
                        cb(err);
                        return;
                    }
                this._associateIdDelegate(_.bind(function(err, associateId) {
                    if (err) {
                        cb(err);
                        return;
                    }
                this._bitModeDelegate(_.bind(function(err, bitMode) {
                    if (err) {
                        cb(err);
                        return;
                    }

                    // Fetch the campaign code, if any. Informs the programCode
                    // returned by RATT.
                    this._campaignCodeDelegate(_.bind(function(err, campaignCode) {
                        // Fetch canonical info from service
                        this._attributionClient.getAttributionInformation({
                            tagbase: tagbase,
                            app: this._app,
                            platform: this._platform,
                            campaignCode: campaignCode,
                            associateId: associateId,
                            bitMode: bitMode
                        }, _.bind(function(err, information) {
                            if (err) {
                                cb(err);
                                return;
                            }
                            var newCachedContext = {
                                version: CACHED_CONTEXT_VERSION,
                                context: information,
                                time: Date.now()
                            };
                            // Don't answer until we can successfully store it.
                            this._storage.set(CACHED_CONTEXT_KEY, newCachedContext, _.bind(function(err) {
                                if (err) {
                                    cb(err);
                                    return;
                                }
                                this._cachedContext = newCachedContext;
                                cb(null, this._cachedContext.context);
                            }, this));
                        }, this));
                    }, this));
                }, this));
                }, this));
                }, this));
            }, this));
        },

    });
    Promise.promisifyAll(AttributionManager.prototype);
    return AttributionManager;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/flow"),
        require("bit/commons/lang"),
        require("bit/commons/ajax"),
        require("bit/commons/options"),
        require("bit/commons/state-latch"),
        require("bit/ext/core/components/promotion-manager")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/flow",
        "bit/commons/lang",
        "bit/commons/ajax",
        "bit/commons/options",
        "bit/commons/state-latch",
        "bit/ext/core/components/promotion-manager"
    ], factory);
}

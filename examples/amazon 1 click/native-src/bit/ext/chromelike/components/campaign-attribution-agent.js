define([
    "underscore",
    "bit/commons/lang",
    "bit/commons/flow",
    "bit/ext/core/components/campaign-attribution/ubp-feature-campaign-attribution"
], function(
    _,
    $lang,
    Flow,
    UBPCampaignAttrExports
) {

    var UBPCampaignAttributionSatelliteBootstrapper = UBPCampaignAttrExports.UBPCampaignAttribution.UBPCampaignAttributionSatelliteBootstrapper,
    UBPCampaignAttributionClient = UBPCampaignAttrExports.UBPCampaignAttribution.UBPCampaignAttributionClient;


    var Agent = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Agent.prototype, {
        initialize: function(opts) {
            $lang.params(opts).req("endpoint");
            this._endpoint = opts.endpoint;

            this._bootstrapper = new UBPCampaignAttributionSatelliteBootstrapper(this._endpoint);
            this._client = new UBPCampaignAttributionClient();

                        this._attributeStateTracker = {
                            bitCampaignCode : {
                                didLookup : false,
                                queuedCallers : [],
                                cachedValue : null
                            },
                            tagbase : {
                                didLookup : false,
                                queuedCallers : [],
                                cachedValue : null
                            },
                            bitMode : {
                                didLookup : false,
                                queuedCallers : [],
                                cachedValue : null
                            },
                            associateId : {
                                didLookup : false,
                                queuedCallers : [],
                                cachedValue : null
                            }
                        };

            _.bindAll(this, "_campaignCodeDelegate", "_tagbaseDelegate", "_bitModeDelegate", "_associateIdDelegate", "_getCachedValue", "_delegate");
        },

                getCampaignCodeDelegate: function() {
                    return this._campaignCodeDelegate;
                },

                getTagbaseDelegate: function() {
                    return this._tagbaseDelegate;
                },

                getBitModeDelegate: function () {
                    return this._bitModeDelegate;
                },

                getAssociateIdDelegate: function () {
                    return this._associateIdDelegate;
                },

                _campaignCodeDelegate: function(cb) {
                    this._getCachedValue("bitCampaignCode", cb);
                },

                _tagbaseDelegate: function(cb) {
                    this._getCachedValue("tagbase", cb);
                },

                _bitModeDelegate: function(cb) {
                    this._getCachedValue("bitMode",cb);
                },

                _associateIdDelegate: function(cb) {
                    this._getCachedValue("associateId",cb);
                },

                _getCachedValue: function(attribute, cb) {
                    cb = cb || $lang.noop;
                    if (this._attributeStateTracker[attribute].didLookup) {
                        Flow.getInstance().nextTick($lang.partiallyApply(cb, null, this._attributeStateTracker[attribute].cachedValue));
                        return;
                    }

                    if (this._isBootstrapping) {
                        this._attributeStateTracker[attribute].queuedCallers.push(cb);
                        return;
                    }

                    this._attributeStateTracker[attribute].queuedCallers.push(cb);

                    this._delegate(attribute, cb);
                },

                _delegate: function(attribute, cb) {

                    this._isBootstrapping = true;
                    this._bootstrapper.buildIFrameBackedDelegate(_.bind(function(err, delegate) {
                            if (err) {
                                    // doesn't hear from Satellite
                                    //set  _isBootstrapping to false to unblock
                                    //subsequent calls after timout
                                    this._isBootstrapping = false;
                                    this._dispatchToQueued(err, attribute);
                                    return;
                            }

                            this._client.connect(delegate, _.bind(function(err) {
                                    if (err) {
                                            this._dispatchToQueued(err, attribute);
                                            return;
                                    }
                                    this._isBootstrapping = false;

                                    var capitalizedAttribute = attribute.charAt(0).toUpperCase() + attribute.substr(1);
                                    this._client["get" + capitalizedAttribute](_.bind(function(err, data) {
                                            if (err) {
                                                    this._dispatchToQueued(err, attribute);
                                                    return;
                                            }

                                            var attributeValue = null;
                                            if(data) {
                                                try {
                                                    //convert string to JSON
                                                    data = JSON.parse(data);
                                                    if(typeof(data) === "object") {
                                                        var currentTime = (new Date()).getTime();

                                                        // Check whether unexpired attribute value is present
                                                        if(data[1] > currentTime) {
                                                            attributeValue = data[0];
                                                        }
                                                    }
                                                    else if(typeof(data) === "string") {
                                                        attributeValue = data;
                                                    }
                                                }
                                                catch(e) {
                                                    //possibily the case when value was stored in
                                                    //localStorage without stringifying
                                                    attributeValue = data;
                                                }
                                            }

                                            // TODO: Persist here
                                            this._attributeStateTracker[attribute].didLookup = true;
                                            this._attributeStateTracker[attribute].cachedValue = attributeValue;
                                            // END TODO

                                            this._dispatchToQueued(null, attribute, attributeValue);
                                    }, this));
                            },this));
                    }, this));
                },

        _dispatchToQueued: function(err, attr, res) {
            var callers = this._attributeStateTracker[attr].queuedCallers;
            this._attributeStateTracker[attr].queuedCallers = [];
            _.each(callers, function(caller) {
                caller(err, res);
            });
        }
    });

    return Agent;

});

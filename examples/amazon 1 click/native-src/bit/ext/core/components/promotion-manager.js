var factory = function(
    _,
    Flow,
    $lang,
    $ajax
) {
    "use strict";

    var REDEEMED_PROMOTIONS_KEY = "options.redeemed_promotions";

    var PromotionClient = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(PromotionClient.prototype, {
        Endpoints: {
            RedeemPromotion: "/gp/ubp/oneButton/promo/redeemPromotion"
        },

        initialize: function(storage) {
            this._storage = storage;
        },

        redeemPromotion: function(campaignCode, cb) {
            cb = cb || $lang.noop;

            this._storage.get("options.ubp_root", _.bind(function(err, root) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }
                var url = root +
                    this.Endpoints.RedeemPromotion +
                    "?campaignCode=" + campaignCode;

                $ajax.getJson(url, function(err, response) {
                    if ($lang.cbOnErr(cb, err)) {
                        return;
                    }
                    if (!response || response.result !== "success") {
                        cb(new Error("Redemption attempt failed."));
                        return;
                    }

                    cb(null);
                });
            }, this));
        }
    });

    var PromotionManager = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(PromotionManager.prototype, {
        initialize: function(opts) {

            $lang.params(opts)
                .req("storage");

            this._storage = opts.storage;

            this._promotionClient = new PromotionClient(this._storage);
        },

        redeemPromotion: function(campaignCode, cb) {
            cb = cb || $lang.noop;

            if(!campaignCode) {
                cb(new Error("Campaign code is not defined."));
                return;
            }

            this._getRedeemedPromotions(_.bind(function(err, redeemedPromotions) {

                if ($lang.cbOnErr(cb, err)) {
                    return;
                }

                // if campaignCode already exist in redeemedPromotions,
                // then we have already successfully attempted to redeem
                // corresponding promotion
                if(redeemedPromotions && redeemedPromotions[campaignCode]) {
                    cb(null);
                    return;
                }

                this._promotionClient.redeemPromotion(campaignCode, _.bind(function(err) {
                    if ($lang.cbOnErr(cb, err)) {
                        return;
                    }
                    this._setRedeemedPromotions(redeemedPromotions, campaignCode, function(err) {
                        if ($lang.cbOnErr(cb, err)) {
                            return;
                        }

                        cb(null);
                    });
                }, this));
            }, this));
        },

        _getRedeemedPromotions: function(cb) {
            cb = cb || $lang.noop;
            this._storage.get(REDEEMED_PROMOTIONS_KEY, function(err, redeemedPromotions) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }

                Flow.getInstance().nextTick($lang.partiallyApply(cb, null, redeemedPromotions));
            });
        },

        _setRedeemedPromotions: function(redeemedPromotions, campaignCode, cb) {
            cb = cb || $lang.noop;
            redeemedPromotions = redeemedPromotions || {};
            redeemedPromotions[campaignCode] = true;
            this._storage.set(REDEEMED_PROMOTIONS_KEY, redeemedPromotions, function(err) {
                if ($lang.cbOnErr(cb, err)) {
                    return;
                }

                cb(null);
            });
        }
    });

    return PromotionManager;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/flow"),
        require("bit/commons/lang"),
        require("bit/commons/ajax")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/flow",
        "bit/commons/lang",
        "bit/commons/ajax"
    ], factory);
}

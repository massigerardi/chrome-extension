
var factory = function( _ , Promise, $options) {

    "use strict";

    var AlertsBadgeController = function () {
        this.initialize.apply(this,arguments);
    };

    _.extend(AlertsBadgeController.prototype, {

        initialize : function(opts) {
            opts = $options.fromObject(opts);
            this._simpleStorage = opts.getOrError("simpleStorage");
            this._runtime = opts.getOrError("runtime");
        },

        start : function () {
            Promise.bind(this)
            .then(function () {
                return this._simpleStorage.getAsync("options.alertsBadgeCount");
            })
            .then(function (alertsBadgeCount) {
                alertsBadgeCount = alertsBadgeCount || 0;
                this.setAlertsBadgeCount(alertsBadgeCount);
            });
        },

        getAlertsBadgeCount : function () {
            return this._simpleStorage.getAsync("options.alertsBadgeCount");
        },

        setAlertsBadgeCount : function (count) {
            this._runtime.setAlertsBadgeCount(count);
            this._simpleStorage.setAsync("options.alertsBadgeCount",count);
        }

    });
    return AlertsBadgeController;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options")

        );
} else if (typeof define !== "undefined") {
    define(["underscore","bluebird","bit/commons/options"], factory);
}

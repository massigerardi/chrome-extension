var factory = function() {

    "use strict";

    var MetaManager = function() {
        this.initialize.apply(this, arguments);
    };

    MetaManager.prototype = {
        initialize: function(w) {
            this._window = w;
        },

        getDocumentReferrer: function() {
            return this._window && this._window.document && this._window.document.referrer || "";
        },

        getWindowLocation: function() {
            return this._window && this._window.location.href || "";
        },

        getPerformanceTiming: function() {
            return  this._window.JSON &&
                    JSON.parse(JSON.stringify(  this._window &&
                                                this._window.performance &&
                                                this._window.performance.timing || {})
                    ) || {};
        },

        getWindowOuterWidth: function() {
            return this._window.outerWidth;
        }
    };

    return MetaManager;

};

if (typeof window !== "undefined") {
    window.UBPAPISupport = window.UBPAPISupport || {};
    window.UBPAPISupport.MetaManager = factory();
}
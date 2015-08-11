/*global define, require, module, navigator */
var factory = function() {
    
    "use strict";

    /*
     * Returns the version of Internet Explorer or a -1
     * (indicating the use of another browser, or IE 11).
     */
    var getSerDesForBrowser = function() {
        // Valid for IE < 11
        var getInternetExplorerVersion = function() {
            var rv = -1;
            // Return value assumes failure.
            if (typeof navigator !== "undefined" && navigator.appName === 'Microsoft Internet Explorer') {
                var ua = navigator.userAgent;
                var re = new RegExp("MSIE ([0-9]{1,}[\\.0-9]{0,})");
                if (re.exec(ua) !== null) {
                    rv = parseFloat(RegExp.$1);
                }
            }
            return rv;
        };
        // Chrome, Firefox, IE 11
        if (getInternetExplorerVersion() === -1) {
            return DEFAULT_SERDES;
        } else {
            // IE 9, 10
            return JSON_SERDES;
        }
    };

    // Default SerDes is identity (no serialization).
    var DEFAULT_SERDES = {
        serialize : function(obj) {
            return obj;
        },
        deserialize : function(msg) {
            return msg;
        }
    };

    var JSON_SERDES = {
        serialize : function(obj) {
            return JSON.stringify(obj);
        },
        deserialize : function(msg) {
            return JSON.parse(msg);
        }
    };

    return getSerDesForBrowser();

};

if ( typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if ( typeof define !== "undefined") {
    define([], factory);
}

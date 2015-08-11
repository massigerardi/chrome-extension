/**
 * @ Handles off-line 1BA behavior
 */
var factory = function(
    lang
) {

    var Navigator = function() {};

    Navigator.prototype = {
        isOffline: function(url, cb) {
            if( navigator.onLine !== "undefined"){
                return !navigator.onLine;
            }
            return false; // For  browsers who doesn't support navigator.onLine make is always online.
        },

        loadOfflineIframe: function(cb) {
            cb = cb || lang.noop;
            var root = "html/navigationError.html";
            cb(root);
        }
    };

    return new Navigator();
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("bit/commons/lang")
    );
} else if (typeof define !== "undefined") {
    define(["bit/commons/lang"], factory);
}



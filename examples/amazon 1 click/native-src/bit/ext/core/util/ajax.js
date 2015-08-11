/**
 * @exports a singleton instance of Ajax
 */
var factory = function(
    lang
) {

    var Ajax = function() {};

    Ajax.prototype = {
        get: function(url, cb) {
            cb = cb || lang.noop;
            if (typeof XMLHttpRequest !== "undefined") {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            cb(null, xhr.responseText);
                        } else {
                            var err = new Error("Server returned with non-200 status code: " + xhr.status);
                            err.xhr = xhr;
                            cb(err);
                        }
                    }
                }
                xhr.send();
            } else if(typeof module !== "undefined" && module.exports) {
                // Assume FF
                var req = require("request");
                req.Request({
                    url: url,
                    onComplete: function(response){
                    if (response.status === 200) {
                        cb(null, response.text);
                    } else {
                        var err = new Error("Server returned with non-200 status code: " + response.status);
                        cb(err);
                    }
                }}).get();
            } else {
                throw new Error("No transport mechanism available");
            }
        },

        getJson: function(url, cb) {
            cb = cb || lang.noop;
            this.get(url, function(err, responseText) {
                if (err) {
                    cb(err);
                    return;
                }

                var resp = null;
                try {
                    resp = JSON.parse(responseText);
                } catch (e) {
                    cb(e);
                    return;
                }

                cb(null, resp);
            });
        }
    };

    return new Ajax();
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("bit/ext/core/util/lang")
    );
} else if (typeof define !== "undefined") {
    define(["bit/ext/core/util/lang"], factory);
}



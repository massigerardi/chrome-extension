/**
 * @exports SessionStateTracker class
 */
define([
    "underscore",
    "bit/commons/lang",
    "bit/commons/ajax",
    "bit/commons/windowed-stack",
    "bit/ext/chromelike/util/log",
    "bit/ext/chromelike/storage/native-storage",
    "bit/ext/core/storage/simple-storage",
    "md5"
], function(
    _,
    lang,
    ajax,
    WindowedStack,
    $log,
    $nativeStorage,
    SimpleStorage,
    md5
) {

    $simpleStorage = new SimpleStorage($nativeStorage);

    // NOTE: c12n == classification.

    var SessionStateTracker = function() {
        this.initialize.apply(this, arguments);
    };

    SessionStateTracker.prototype = {
        _crsPath: "/gp/ubp/json/BAM/crs",
        initialize: function(opts) {
            opts = opts || {};
            this._port = opts.port;

            if (!this._port) {
                throw new Error("Expected messaging port");
            }

            this._helper = opts.helper;

            if (!this._helper) {
                throw new Error("Expected helper");
            }

            this._trackedUrls = new WindowedStack(3);
            this.onPageUpdated = _.bind(this.onPageUpdated, this);
        },

        _trackUrl: function(url) {
            var trackedUrl = new TrackedUrl(url);
            this._trackedUrls.push(trackedUrl);
            $log.debug("Tracking URL", trackedUrl, trackedUrl.toJSON());
        },

        _isRecognized: function(status) {
            // Server returns "1" for unrecognized, "2" for recognized
            return (status === "2");
        },

        // Ignore everything but http and https
        _isTrackable: function(url) {
            return (/^http(s)?:/.test(url));
        },

        onPageUpdated: function(tabId, changeInfo, tab) {
            if (changeInfo && changeInfo.status !== 'complete') {
                return;
            }

            var url = tab ? tab.url : null;

            if (!this._isTrackable(url)) {
                return;
            }

            this._trackUrl(url);
            $log.debug("Page updated. Querying session state. " + url);
            this._getLastStatus(_.bind(function(err, lastStatus){
                if(err) {
                    $log.debug("Error retrieving last status: " + err);
                    return;
                }

                this._getRecognitionStatus(_.bind(function(err, currentStatus) {
                    if (err) {
                        $log.debug("Error retrieving recognition status: " + err);
                        return;
                    }
                    // If we don't have a last status,
                    // set the current one for next time around
                    if (!lastStatus) {
                        this._setStatus(currentStatus, function(err) {
                            if (err) {
                                $log.debug("Error saving recognition status: " + err );
                                return;
                            }
                        });
                    } else {
                        // Else, compare the two - if they were previously
                        // recognized and now are not, then we need to notify
                        // someone
                        if (this._isRecognized(lastStatus) && !this._isRecognized(currentStatus)) {
                            // Save new status and notify
                            this._setStatus(currentStatus, _.bind(function(err) {
                                this._notifyStateChanged(lastStatus, currentStatus, url);
                            }, this));
                        } else if (lastStatus !== currentStatus) {
                            this._setStatus(currentStatus, _.bind(function(err){
                                if (err) {
                                    $log.debug("Error setting recognition status: " + err);
                                }
                            }, this));
                        } else {
                            $log.debug("No meaningful change in recognition status; doing nothing");
                        }
                    }
                }, this));
            }, this));
        },

        _getLastStatus: function(callback) {
            $log.debug("Getting last recognition status");
            callback = callback || lang.noop;
            $simpleStorage.get('options.recognition_status', function(err, status) {
                $log.debug("Last recognition status: " + status);
                callback(null, status);
            });
        },

        _setStatus: function(status, callback) {
            $log.debug("Saving recognitions status; " + status);
            $simpleStorage.set('options.recognition_status', status, function() {
                callback();
            });
        },

        _getRecognitionStatus: function(callback) {
            $log.debug("Querying remote recognition status");
            this._helper.getRoot(function(url){
                $log.debug("Getting recognition status from url: " + url);
                ajax.getJson(url, function(err, result) {
                    $log.debug("Received response from server; " + JSON.stringify(result));
                    if (err) {
                        callback(err);
                        return;
                    }

                    if (!result) {
                        callback(new Error("Invalid crs result"));
                        return;
                    }

                    if (result["error"]) {
                        callback(new Error(result["error"]));
                        return;
                    }

                    if (typeof result["crs"] === "undefined") {
                        callback(new Error("Invalid crs result format"));
                        return;
                    }

                    callback(null, result["crs"]);
                });
            }, this._crsPath);
        },

        _notifyStateChanged: function(previousStatus, currentStatus, url, callback) {
            callback = callback || lang.noop;
            var urls = _.chain(this._trackedUrls.toArray()).map(function(url) {
                try {
                    return url.toJSON();
                } catch (e) {
                    $log.error("Error serializing tracked url", url._url, e);
                    return null;
                }
            }).reject(function(item) {
                return item === null;
            }).value();

            $log.debug("State changed! " + previousStatus + "; " + currentStatus + "; " + url);
            $log.debug("Last URLs tracked: " + JSON.stringify(urls));
            $log.debug("Notifying remote service.");
            this._port.postMessage({
                UBPMessageType : "UBPMessageResponse",
                type : "SessionTracking_relayCRSChange",
                args: [previousStatus, currentStatus, urls]
            });
        }
    };

    var TrackedUrl = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(TrackedUrl.prototype, {
        initialize: function(url) {
            this._url = url;
        },

        // Returns a JSON-serializable object
        toJSON: function() {
            return {
                c12n: this._getClassificiation(),
                data: this._getData()
            };
        },

        _getParser: function() {
            if (!this._parser) {
                // Lazy-man's parser - delegate to browser
                this._parser = document.createElement("a");
                this._parser.href = this._url;
            }
            return this._parser;
        },

        _getClassificiation: function() {
            var parser = this._getParser();
            // If it's likely Amazon, classify as "full", regardless of protocol
            if (isLikelyAmazon(parser.hostname)) {
                return "f";
            } else {
                // For non-Amazon properties, we only want to track as "full" if it's an HTTP url
                if (isHttp(parser.protocol)) {
                    return "f";
                } else if (isHttps(parser.protocol)) {
                    // Return "partial"
                    return "p";
                } else {
                    // Prevents tracking of protocols we're not aware of
                    throw new Error("Protocol not supported: " + parser.protocol);
                }
            }
        },

        _getData: function() {
            // If "full", we want the full URL - server can process later
            // If "partial", we want the hostname, port, and md5 of the path - no more
            var c12n = this._getClassificiation();
            var parser = this._getParser();
            if (c12n === "f") {
                return {
                    url: this._url
                };
            } else if (c12n === "p") {
                return {
                    hostname: parser.hostname,
                    port: parser.port,
                    pathHash: md5(parser.pathname)
                };
            } else {
                throw new Error("Unsupported c12n: " + c12n);
            }
        }
    });


    var isLikelyAmazon = function(hostname) {
        // Reverse - tld comes first, e.g., ["uk", "co", "amazon", "www"]
        var parts = hostname.split(".").reverse();
        if (parts.length > 3) {
            // > 3 parts, e.g., www.amazon.co.uk - have to explicitly have amazon.co.[tld]
            // We ignore the tld if amazon and co are matched, so we don't have to enumerate tlds
            // or maintain a list.
            if (parts[1] === "co") {
                return (parts[2] === "amazon");
            } else {
                // > 3 parts, but not a .co.[tld], e.g., sub.sub.amazon.com
                return (parts[1] === "amazon");
            }
        } else if (parts.length > 1) {
            // 2 or 3 parts, e.g., www.amazon.com, www.amazon.de, amazon.com
            return (parts[1] === "amazon");
        } else {
            return false;
        }
    };
    var isHttp = function(protocol) {
        return protocol === "http:";
    };
    var isHttps = function(protocol) {
        return protocol === "https:";
    };


    return SessionStateTracker;
});

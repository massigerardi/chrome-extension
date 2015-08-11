var factory = function(
    _,
    $lang,
    $uuid,
    $options
) {

    "use strict";

    /**
     *  XHRClient - A NetworkClient that uses XMLHTTPRequest
     */
    var XHRClient = function() {
        this.initialize.apply(this, arguments);
    };

    var HTTP_METHOD = {
        GET: "GET",
        POST: "POST",
        PUT: "PUT",
        HEAD: "HEAD"
    };

    // Source: http://xhr.spec.whatwg.org/#states
    var STATE = {
        UNSENT: 0,
        OPENED: 1,
        HEADERS_RECEIVED: 2,
        LOADING: 3,
        DONE: 4
    };

    // Source: http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
    var STATUS = {
        OK: 200
    };

    XHRClient.prototype.initialize = function(opts) {
        opts = $options.fromObject(opts);
        this.lastServerClientTimePairObject = null;
        // Initialize empty map of requests
        this._requests = {};
    };

    /**
     *  Makes an asynchronous request configured using specified 'config' to specified 'url'
     *
     *  @param {String} url - URL to which the request is sent
     *  @param {Object} config - A set of key/value pairs to configure the request
     *          - {String} requestType
     *                Sets the Content-Type of the request that is sent to the server
     *                e.g. 'text/plain; charset=UTF-8'
     *          - {Object} data
     *                Data to be sent to the server
     *          - {String} responseType
     *                The type of data you're expecting back from the server
     *                Possible values: ["", "arraybuffer", "blob", "document", "json", "text" ]
     *                (Only "json" supported for now by this NetworkClient)
     *          - {function} error( {Object} error )
     *                A function that is called when the request fails
     *                - {Object} error
     *                    - {Number} status
     *                    - {String} statusText
     *                    - {String} message
     *          - {Object} headers
     *                Key/Value pairs of additional headers to send with request
     *          - {function} success( {Object} response )
     *                A function that is called if the request succeeds
     *                - {Object} response
     *                    - {Object} data
     *                    - {Number} status
     *                    - {String} statusText
     *          - {Number} timeout
     *                Set a timeout (in milliseconds) for the request
     *          - {String} http_method
     *                HTTP request method to be used
     */
    XHRClient.prototype.request = function(url, config) {
        var request = new XMLHttpRequest();
        var requestID = $uuid.v4();

        // Add the new request to the requestMap
        var requestMap = this._requests;
        requestMap[requestID] = request;

        // Fill config's unset keys with reasonable defaults
        config = config || {};
        _.defaults(config, {
            http_method: "GET",
            responseType: "json",
            headers: {},
            success: $lang.noop,
            error: $lang.noop,
            data: {},
            timeout: 0,
            cacheDateHeader: false//only caches the date header if this config value is true
        });
        if (!url || typeof url !== "string") {
            config['error'](new Error("URL is an invalid type"));
        }

        // Setup URL
        if (config['http_method'] === HTTP_METHOD['GET']) {
            url += hasParams(url) ? "&" : "?";
            url += serialize(config['data']);
        }
        // Open async request
        request.open(config['http_method'], url, true);

        // Set request headers
        _.each(_.keys(config['headers']), function(key) {
            request.setRequestHeader(key, config['headers'][key]);
        });
        // Set response type
        request.responseType = config['responseType'];


        // Configure request timeout and handle timeout
        request.timeout = config['timeout'];
        request.ontimeout = function() {
            config['error'](new Error("The request timed out"));
        };

        // Handle completion of request
        request.onreadystatechange = _.bind(function() {
            if (request.readyState === STATE.DONE) {
                // // Remove request from request map when it is complete
                delete requestMap[requestID];

                // If request completed successfully
                if (request.status === STATUS.OK) {
                    var response, error = new Error("Unable to parse the response");
                    try { 
                        response = parseResponse(request);
                    }
                    catch(e) {
                        response = null;
                    }

                    if( response ) {
                        config['success'](response);
                    } else {
                        config['error'](error);
                    }
                } else {
                    var error = new Error("Request completed with a non-200 status code");
                    error.status = request.status;
                    error.statusText = request.statusText;

                    config['error'](error);
                }
            } else if (request.readyState === STATE.HEADERS_RECEIVED) {
                //TODO: Add a class that uses the xhr client and stores date headers to preserve
                //stateless-ness of this object.
                var httpResponseHeaderDate = request.getResponseHeader("Date");

                if (httpResponseHeaderDate && config.cacheDateHeader) {
                    try {
                        var serverClientTimePairObject = {
                            "serverTime" : Date.parse(httpResponseHeaderDate),
                            "clientTime" : Date.now()
                        };
                        this.lastServerClientTimePairObject = serverClientTimePairObject;
                    } catch (error) {} //in case Date.parse throws.
                }
            }
        },this);

        // Send the request off on its way
        try {
            if (config['http_method'] === HTTP_METHOD['GET'] || _.isEmpty(config['data'])) {
                request.send();
            }
            else if (config['http_method'] !== HTTP_METHOD['GET'] && config['headers']['Content-Type'] === 'application/x-www-form-urlencoded') {
                request.send(serialize(config['data']));
            } 
            else {
                request.send(JSON.stringify(config['data']));
            }
        } catch (e) {
            config['error'](e);
        }
    };

    // Parses various kinds of responses
    var parseResponse = function(request) {
        var response;
        if (request.responseType === "json") {
            // Some XHR implementations already create response object for you
            // but Chrome throws an error if you try to access request.responseText
            // when the responseType is 'json', however, this is the only way
            // env.js knows to send a response. ugh.
            response = request.response || JSON.parse(request.responseText);
        } else if (request.responseType === "arraybuffer") {
            response = request.response || request.responseText;
        } else if (request.responseType === "text") {
            //Adding this case since the default (expected) response type is JSON,
            //however, (particularly for pings, which have an unknown response type often),
            //we don't want a parse error to be returned, making the request appear to have
            //failed. 
            response = request.response || request.responseText;
        } else {
            // IE's XHR implementation puts the JSON string in the "response"
            // but it doesn't set the responseType is "json".
            response = JSON.parse(request.response || request.responseText);
        }
        return response;
    };

    // Returns true if url already has parameters appended to it
    var hasParams = function(url) {
        return (url.indexOf("?") >= 0);
    };

    // Returns the data serialized in a string
    var serialize = function(obj, prefix) {
        var params = [];

        for (objKey in obj) {
            var paramKey = objKey;

            // Deal with nested objects
            if (prefix) {
                paramKey = "[" + paramKey + "]";
            }

            var paramValue = obj[paramKey];
            if (typeof paramValue === "object") {
                // Prepend keys within paramValue with this param's key
                paramValue = serialize(paramValue, paramKey);
            }

            var param = encodeURIComponent(paramKey) + "=" + encodeURIComponent(paramValue);
            params.push(param);
        }

        return params.join("&");
    };

    return XHRClient;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/lang"),
        require("bit/commons/uuid"),
        require("bit/commons/options")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/lang",
        "bit/commons/uuid",
        "bit/commons/options"
    ], factory);
}
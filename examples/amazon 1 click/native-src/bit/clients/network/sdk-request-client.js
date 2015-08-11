var factory = function(
    _,
    $lang,
    $uuid,
    $options
) {

    "use strict";

    /**
     *  SDKRequestClient - A NetworkClient that uses sdk/request module
     *  in the Firefox add-on SDK. 
     *  https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/request
     */
    var SDKRequestClient = function() {
        this.initialize.apply(this, arguments);
    };

    var HTTP_METHOD = {
        GET: "GET",
        POST: "POST",
        PUT: "PUT",
        HEAD: "HEAD"
    };

    // Source: http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html
    var STATUS = {
        OK: 200
    };

    SDKRequestClient.prototype.initialize = function(opts) {
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
     *          - {String} http_method
     *                HTTP request method to be used
     */
    SDKRequestClient.prototype.request = function(url, config) {
        var reqParams = {};
        var requestID = $uuid.v4();
        var requestMap = this._requests;
        
        // Fill config's unset keys with reasonable defaults
        config = config || {};
        _.defaults(config, {
            http_method: "GET",
            headers: {},
            success: $lang.noop,
            error: $lang.noop,
            data: {},
            cacheDateHeader: false
        });

        if (!url || typeof url !== "string") {
            config['error'](new Error("URL is an invalid type"));
        }

        // Setup URL
        if (config['http_method'] === HTTP_METHOD['GET']) {
            url += hasParams(url) ? "&" : "?";
            url += serialize(config['data']);
        }

        // Set the URL
        reqParams.url = url;

        // Set request headers
        reqParams.headers = config['headers'];

        // Handle completion
        reqParams.onComplete = _.bind(function(response) {
            delete requestMap[requestID];
            if(response.status === STATUS.OK) {
                config['success'](response.json||response.text);
            }
            else {
                var error = new Error("Request completed with a non-200 status code");
                error.status = response.status;
                error.statusText = response.statusText;
                config['error'](error);
            }
            //Cache the date header:
            var httpResponseHeaderDate = response.headers["Date"];
            if (httpResponseHeaderDate && config.cacheDateHeader) {
                try {
                    var serverClientTimePairObject = {
                        "serverTime" : Date.parse(httpResponseHeaderDate),
                        "clientTime" : Date.now()
                    };
                    this.lastServerClientTimePairObject = serverClientTimePairObject;
                } catch (error) {} //in case Date.parse throws.
            }
        },this);
        
        // Send the request
        try {
            if (config['http_method'] !== HTTP_METHOD['GET'] && !_.isEmpty(config['data'])) {
                if (config['headers']['Content-Type'] === 'application/x-www-form-urlencoded') {
                    reqParams.content = serialize(config['data']);
                } else {
                    reqParams.content = JSON.stringify(config['data']);
                }
            }
            var request = require("sdk/request").Request(reqParams);
            requestMap[requestID] = request;
            request[config['http_method'].toLowerCase()]();
        }
        catch(e) {
            config['error'](e);
        }
    };

    // Returns true if url already has parameters appended to it
    var hasParams = function(url) {
        return (url.indexOf("?") >= 0);
    };

    // Returns the data serialized in a string
    var serialize = function(obj, prefix) {
        var params = [];
        var objKey;
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

    return SDKRequestClient;
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
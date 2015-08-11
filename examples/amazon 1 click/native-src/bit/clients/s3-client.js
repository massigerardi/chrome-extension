var factory = function(
    _,
    Flow,
    $lang,
    $options
) {

    "use strict";

    /**
     * S3 Javascript Client
     *
     * Example usage:
     *
     *      var s3Client = new S3Client({
     *          networkClient: networkClient
     *      });
     *
     *      s3Client.getObject(objectUrl, function(null, response) {
     *          if(error) {
     *              // handle error case
     *          }
     *
     *          // do something useful with the result
     *
     *      });
     *
     */
    var Client = function() {
        this.initialize.apply(this, arguments);
    };

    Client.prototype.initialize = function(opts) {
        opts = $options.fromObject(opts);
        this._networkClient = opts.getOrError("networkClient");
    };

    /**
     *  getObject - Given a signed ObjectUrl, retrieves an object from S3.
     *  @param:
     *      - objectUrl: (Signed) ObjectUrl of the S3 Object.
     *      - {function} cb( {Object} error, {Object} response )
     *          A function that is called with the response from the Network Client
     *          Note: Both "error" and "response" will not be defined at the same time
     *          * In the event of an error:
     *              {Object} error:
     *                  - {String} message
     *              {Object} response will be null
     *          * In the event of success:
     *              {Object} error will be null
     *              {Object} response
     */
    Client.prototype.getObject = function(objectUrl, responseType, cb) {
        var operation = "GetObject";

        // Populate options
        var options = {};
        options["responseType"] = responseType || "json";
        options["url"] = objectUrl;

        // Configure output and fire callback
        options["callback"] = function(error, response) {
            if ($lang.cbOnErr(cb, error)) {
                return;
            }
            if (!response) {
                Flow.getInstance().nextTick(function() {
                    cb(new Error("S3 response is invalid"));
                });
                return;
            }
            Flow.getInstance().nextTick($lang.partiallyApply(cb, null, response));
        };

        this._makeRequest(operation, options);
    };

    Client.prototype._makeRequest = function(operation, opts) {
        opts = $options.fromObject(opts);

        var callback = opts.getOrError("callback");
        var url = opts.getOrError("url");

        var options = {};
        options["requestType"] = opts.getOrElse("requestType", "application/json; charset=UTF-8");
        options["responseType"] = opts.getOrElse("responseType", "json");

        options["success"] = function(response) {
            callback(null, response);
        };

        options["error"] = opts.getOrElse("error", function(error) {
            callback(error, null);
        });

        options["http_method"] = opts.getOrElse("http_method", "GET");
        options["headers"] = {};

        // Fire request
        this._networkClient.request(url, options);
    };

    return Client;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/flow"),
        require("bit/commons/lang"),
        require("bit/commons/options")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/flow",
        "bit/commons/lang",
        "bit/commons/options"
    ], factory);
}
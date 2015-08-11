var factory = function(
    _,
    $options
) {
    /**
     *  NetworkClientInterface - Performs an asynchronous request
     */    
    var NetworkClientInterface = function() {
        this.initialize.apply(this, arguments);
    };

    NetworkClientInterface.prototype.initialize = function(opts) {
        opts = $options.fromObject(opts);
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
    NetworkClientInterface.prototype.request = function(url, config) {
        throw new Error("This class is an interface, the 'request' method has no implementation.");
    };

    return NetworkClientInterface;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options")
    );
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/options"], factory);
}
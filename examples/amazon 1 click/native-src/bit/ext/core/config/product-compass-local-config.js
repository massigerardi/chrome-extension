var factory = function() {
    return {
        "remoteConfigObjectUrl": "https://s3-us-west-2.amazonaws.com/product-compass-prod/client-config/product-compass-remote-configuration.json"
    };
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}

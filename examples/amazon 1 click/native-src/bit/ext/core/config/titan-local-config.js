var factory = function() {
    return {
        "remoteConfigObjectUrl": "https://s3-us-west-2.amazonaws.com/titan-alexa-prod/client-config/titan-remote-config.json"
    };
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}
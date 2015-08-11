var factory = function() {
    return {
        "remoteConfigObjectUrl": "https://s3-us-west-2.amazonaws.com/bit-mode-config/client-config-prod/mode-remote-config.json"
    };
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}
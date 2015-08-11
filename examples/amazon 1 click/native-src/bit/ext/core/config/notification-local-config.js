var factory = function() {
    return {
        //"remoteConfigObjectUrl": "https://s3.amazonaws.com/1ba.notifications/client-config/prod/notification-remote-outer-config.json"
        //this is set to gamma for testing. set bak after
        "remoteConfigObjectUrl": "https://s3.amazonaws.com/1ba.notifications/client-config/prod/notification-remote-outer-config.json"
    };
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}

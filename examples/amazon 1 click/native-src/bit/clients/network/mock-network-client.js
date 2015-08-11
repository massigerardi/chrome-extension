var factory = function(
    _,
    Flow
) {
    var MockNetworkClient = function(response) {
        return {
            request: function(url, options) {
                if(response.status && response.status !== 200) {
                    Flow.getInstance().nextTick(function() {
                        options['error'](response);
                    });
                } else {
                    Flow.getInstance().nextTick(function() {
                        options['success'](response);
                    });
                }
            }
        };
    };

    return MockNetworkClient;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/flow")
    );
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/flow"], factory);
}
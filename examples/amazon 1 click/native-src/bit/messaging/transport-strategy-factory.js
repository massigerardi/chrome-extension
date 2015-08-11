/*global define, require, module */
var factory = function (_, $options, PostMessageTransportStrategy, PortTransportStrategy) {

    "use strict";

    var constructors = {
        postMessage: function (opts) {
            return new PostMessageTransportStrategy(opts);
        },
        port: function (opts) {
            return new PortTransportStrategy(opts);
        }
    };

    /**
     * TransportStrategyFactory
     *
     * Respnosibility
     * TransportStrategyFactory is responsible for creating different kinds of
     * TransportStrategy based on the 'style' parameter. The 'style'
     * is dictated by the communication features supported by the
     * underlying runtime environment.
     *
     * Refer the corresponding strategy documentation to know about the other
     * parameters that can be passed to the TransportStrategyFactory.
     *
     * Usage:
     * TransportStrategyFactory.build({
     *    style : "postMessage", ...
     * });
     *
     * @constructor
     */

    var TransportStrategyFactory = {
        build: function (opts) {
            var optsObj = $options.fromObject(opts);
            return constructors[optsObj.getOrError("style")](opts);
        }
    };

    return TransportStrategyFactory;

};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/commons/options"),
        require("bit/messaging/strategies/post-message-transport-strategy"),
        require("bit/messaging/strategies/port-transport-strategy"));
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/options", "bit/messaging/strategies/post-message-transport-strategy",
            "bit/messaging/strategies/port-transport-strategy"
        ],
        factory);
}
/*global define, require, module, navigator */
var factory = function (_, MessageChannel) {

    "use strict";

    /**
     * BlackHoleTransportStrategy - Swallows events, but conforms to the TransportStrategy interface.
     * Useful for testing things which require a transport strategy, but wont' use it for the
     * duration of the test.
     *
     * @constructor
     */
    var BlackHoleTransportStrategy = function () {
        this.initialize.apply(this, arguments);
    };

    _
        .extend(
            BlackHoleTransportStrategy.prototype, {
                initialize: function (opts) {
                    // "Inward" (targeted at this window)
                    this._dispatchChannel = new MessageChannel({
                        sentinel: this
                    });
                },

                /**
                 * Returns the dispatch channel.
                 */
                dispatchChannel: function () {
                    return this._dispatchChannel;
                },

                /**
                 * Sets up forwarding from otherChannel to the egressChannel
                 * @param {Object} otherChannel - Messages published on this channel will be forwarded
                 */
                forward: function (otherChannel) {

                },

                /**
                 * Unbinds ports of this transport
                 */
                unbind: function () {

                },

                /**
                 * Replace this transport's ports with new ones
                 */
                bind: function () {

                }

            });

    return BlackHoleTransportStrategy;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/messaging/message-channel"));
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/messaging/message-channel"], factory);
}

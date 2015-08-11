/*global define, require, module, navigator */
var factory = function (_, $options, $serdes, MessageFactory, MessageChannel, CompositeMessageChannel) {

    "use strict";

    /*
     * Format for the message used for communication
     */
    var Message = {
        typePortTransport: function (origin, msg) {
            return {
                mType: "portTransport",
                origin: origin,
                // Destination is currently unused. It's
                // expected that multiple strategies will
                // dispatch these events for now, but
                // their exchanges merely won't respond
                // to them. If the fanout gets too large,
                // we can add explicit destination endpointing
                destination: null,
                payload: msg
            };
        }
    };


    /**
     * PortTransportStrategy
     *
     * Responsibility
     * PortTransportStrategy uses the Firefox's Port API as the underlying method of
     * communication. An example of the usecase for this strategy is when we want the
     * Content Scripts to talk to the Firefox Add-On.
     *
     * It accepts the following options:
     *      identity: Passed along with all the messages denoting their origin.
     *      port: Object that allows you to send events to the content script using the
     *            port.emit() function and receive events from the content script using the
     *            port.on() function.
     *      inMsgLabel: All the incoming messages must be marked with this label.
     *            port.on(this._inMsgLabel, function() {});
     *
     *      outMsgLabel: All the outgoing messages will be marked with this label.
     *            port.emit(this._outMsgLabel, msg);
     *
     * More about Port API: https://developer.mozilla.org/en-US/Add-ons/SDK/Guides/Content_Scripts/using_port
     * Refer MessageFramework documentation to learn about TransportStrategy in general.
     * @constructor
     */
    var PortTransportStrategy = function () {
        this.initialize.apply(this, arguments);
    };

    _
        .extend(
            PortTransportStrategy.prototype, {
                initialize: function (opts) {
                    opts = $options.fromObject(opts);
                    this._identity = opts.getOrError("identity");
                    this._inMsgLabel = opts.getOrError("inMsgLabel");
                    this._outMsgLabel = opts.getOrError("outMsgLabel");

                    // "Inward" (targeted at this window)
                    this._dispatchChannel = new MessageChannel({
                        sentinel: this
                    });
                    // Outbound (self-binds)
                    this._egressChannel = new CompositeMessageChannel({
                        sentinel: this
                    });

                    _.bindAll(this, "_onMessage", "_send");

                    if (opts.get("port")) {
                        this.bind({
                            port: opts.getOrError("port")
                        });
                    }
                    // _egress forwards to port (and optionally elsewhere)
                    this._egressChannel.subscribe(this._send);
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
                    this._egressChannel.join(otherChannel);
                },

                /**
                 * Unbinds ports of this transport
                 */
                unbind: function () {
                    if(this._port) {
                        this._port.removeListener(this._inMsgLabel, this._onMessage);
                        this._port = null;
                    }
                },

                /**
                 * Replace this transport's ports with new ones
                 */
                bind: function (opts) {
                    opts = $options.fromObject(opts);

                    this._port = opts.getOrError("port");
                    if(this._port.on) {
                        this._port.on(this._inMsgLabel, this._onMessage);
                    }
                },

                /**
                 * Sends message from egressChannel to the port.
                 * @param {Object} msg - Message to be sent to the port.
                 */
                _send: function (msg) {

                    var wrappedMessage = Message.typePortTransport(this._identity, msg);

                    // TODO: Figure out appropriate targetOrigin (rather than "*").
                    // Problematically, in some contexts this will be the extension context,
                    // which is different in FF/CR/OP, while in others it'll be straight
                    // up amazon.com (but even then, it may be .com, .co.uk, etc, and on a
                    // myriad of ports)
                    if (this._port) {
                        this._port.emit(this._outMsgLabel, $serdes.serialize(wrappedMessage));
                    }
                },

                /**
                 * Passes the message received on the port to the dispatch channel.
                 * @param {Object} domMsg - Message recevied on the port
                 */
                _onMessage: function (domMsg) {
                    // TODO: Origin verification
                    var payload = $serdes.deserialize(domMsg);
                    var unwrapped = payload.payload;

                    if (payload.origin &&
                        // For now, this condition will always succeed, since
                        // we're explicitly setting destination to null
                        (!payload.destination || (payload.destination && payload.destination === this._identity))) {

                        // Ferry it
                        this._dispatchChannel.publish(this, unwrapped);
                    }
                }
            });

    return PortTransportStrategy;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/commons/options"), require("bit/commons/serdes"),
        require("bit/messaging/message-factory"), require("bit/messaging/message-channel"),
        require("bit/messaging/composite-message-channel"));
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/options", "bit/commons/serdes", "bit/messaging/message-factory",
        "bit/messaging/message-channel", "bit/messaging/composite-message-channel"
    ], factory);
}
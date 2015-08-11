/*global define, require, module, navigator */
var factory = function (_, $options, $serdes, MessageFactory, MessageChannel, CompositeMessageChannel) {

    "use strict";

    /*
     * Format for the message used for communication between
     * the inbound port and outbound port.
     */
    var Message = {
        typePostMessageTransport: function (origin, msg, dest) {
            return {
                mType: "postMessageTransport",
                origin: origin,
                // Destination is currently unused. It's
                // expected that multiple strategies will
                // dispatch these events for now, but
                // their exchanges merely won't respond
                // to them. If the fanout gets too large,
                // we can add explicit destination endpointing
                destination: dest || null,
                payload: msg
            };
        }
    };

    /**
     * PostMessageTransportStrategy
     *
     * Responsibility
     * PortTransportStrategy uses the postMessage API for safe cross-origin communication.
     * An example of the usecase for this strategy is when we want an iFrame to talk to it's
     * Parent window.
     *
     *
     * It accepts the following options:
     *      identity: Passed along with all the messages denoting their origin.
     *      inboundPort: Object on which addEventListener() or attachEvent() will be called.
     *                   This will be the receiver of all the messages.
     *      outboundPort: Object on which postMessage() will be called.
     *                    This will be the source of all the messages that are sent.
     *
     *
     * More about postMessage API: https://developer.mozilla.org/en-US/docs/Web/API/Window.postMessage
     * Refer MessageFramework documentation to learn about TransportStrategy in general.
     * @constructor
     */
    var PostMessageTransportStrategy = function () {
        this.initialize.apply(this, arguments);
    };

    _
        .extend(
            PostMessageTransportStrategy.prototype, {
                initialize: function (opts) {
                    opts = $options.fromObject(opts);
                    this._identity = opts.getOrError("identity");

                    // "Inward" (targeted at this window)
                    this._dispatchChannel = new MessageChannel({
                        sentinel: this
                    });
                    // Outbound (self-binds)
                    this._egressChannel = new CompositeMessageChannel({
                        sentinel: this
                    });

                    this._inboundFilter = opts.getOrElse("inboundFilter", function() {return true; });
                    this._outboundFilter = opts.getOrElse("outboundFilter", function() { return true; });

                    this._destination = opts.getOrElse("destination", null);

                    _.bindAll(this, "_onMessage", "_send");

                    if (opts.get("inboundPort") && opts.get("outboundPort")) {
                        this.bind({
                            inboundPort: opts.getOrError("inboundPort"),
                            outboundPort: opts.getOrError("outboundPort")
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
                 * Removes the inboundPort and outboundPort of this transport
                 */
                unbind: function () {
                    if (this._inboundPort) {
                        if (this._inboundPort.removeEventListener) {
                            this._inboundPort.removeEventListener("message", this._onMessage, false);
                        } else if (this._inboundPort.detachEvent) {
                            this._inboundPort.detachEvent("onmessage", this._onMessage);
                        }
                    }

                    this._inboundPort = null;
                    this._outboundPort = null;
                },

                /**
                 * Replaces this transport's inboundPort and outboundPort with new ones
                 *      inboundPort: Object on which addEventListener() or attachEvent() will be called.
                 *                   This will be the receiver of all the messages.
                 *      outboundPort: Object on which postMessage() will be called.
                 *                    This will be the source of all the messages that are sent.
                 */
                bind: function (opts) {
                    opts = $options.fromObject(opts);

                    this._inboundPort = opts.getOrError("inboundPort");
                    this._outboundPort = opts.getOrElse("outboundPort", null);

                    if (this._inboundPort.addEventListener) {
                        this._inboundPort.addEventListener("message", this._onMessage, false);
                    } else if (this._inboundPort.attachEvent) {
                        this._inboundPort.attachEvent("onmessage", this._onMessage);
                    }
                },

                /**
                 * Sends message from egressChannel to the outboundPort.
                 * @param {Object} msg - Message to be sent to the outboundPort.
                 */
                _send: function (msg) {

                    var wrappedMessage = Message.typePostMessageTransport(this._identity, msg, this._destination);

                    if (!this._outboundFilter(wrappedMessage)) {
                        return;
                    }

                    // TODO: Figure out appropriate targetOrigin (rather than "*").
                    // Problematically, in some contexts this will be the extension context,
                    // which is different in FF/CR/OP, while in others it'll be straight
                    // up amazon.com (but even then, it may be .com, .co.uk, etc, and on a
                    // myriad of ports)
                    if (this._outboundPort) {
                        this._outboundPort.postMessage($serdes.serialize(wrappedMessage), "*");
                    }
                },

                /**
                 * Passes the message received on the inboundPort to the dispatch channel.
                 * @param {Object} domMsg - Message recevied on the inboundPort
                 */
                _onMessage: function (domMsg) {
                    // TODO: Origin verification
                    var payload = $serdes.deserialize(domMsg.data);
                    var unwrapped = payload.payload;

                    if (!this._inboundFilter(payload)) {
                        return;
                    }

                    // Not self-targeting, and targeted at me
                    if ((payload.origin && payload.origin !== this._identity) &&
                        // For now, this condition will always succeed, since
                        // we're explicitly setting destination to null
                        (!payload.destination || (payload.destination && payload.destination === this._identity))) {

                        // Ferry it
                        this._dispatchChannel.publish(this, unwrapped);
                    }
                }
            });

    return PostMessageTransportStrategy;
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

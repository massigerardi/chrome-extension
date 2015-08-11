/*global define, require, module */
var factory = function (
    _,
    $options,
    MessageExchange,
    MessageDispatcher
) {

    "use strict";

    /**
     *
     * MessageFramework
     *
     * Responsibility
     * MessageFramework is a wrapper around the messaging system that includes a
     * MessageExchange, MessageDispatcher and a TransportStrategy.
     *
     *
     * Illustration:
     *
     *                        +--------------+               +--------------+
     *                        |              |               |              |
     * +------------+    +----+-----+   +----+----+     +----+-----+        |
     * |  Message   |<---+ Dispatch |   | Egress  +---->| Egress   |   +-------------+
     * | Dispatcher |    | Channel  |   | Channel |     | Channel  +-->| Runtime     |
     * +-----+------+    +----+-----+   +----+----+     +----+-----+   | Specific    |
     *       v                |              |               |         | Transport   |
     * +------------+         |         +----+----+     +----+-----+   | Mechanism   |
     * | Responder  |         |         | Ingress |<----+ Dispatch |   +--+----------+
     * +------------+         |         | Channel |     | Channel  |<-----+ |
     *                        |         +----+----+     +----+-----+        |
     *                        |              |               |              |
     *                        +--------------+               +--------------+
     *                         MessageExchange               TransportStrategy
     *
     * As shown in the Illustration, the MessageFramework is composed of the following
     * components:
     *
     * 1. MessageExchange:
     *    Refer the MessageExchange documentation.
     *
     * 2. MessageDispatcher:
     *    Refer the MessageDispatcher documentation.
     *
     * 3. TransportStrategy:
     *    TransportStrategy defines how the messages will be passed to and from the
     *    messaging system in the given runtime environment. This is the only runtime
     *    specific component in the entire messaging system.
     *    It is easier to understand this concept using an example. Consider that you
     *    are writing an application called FooApp that runs inside an iFrame. FooApp
     *    needs to communicate with another application called BarApp that is running
     *    in the parent window. FooApp and BarApp would each create a MessageFramework
     *    that uses the PostMessageTransportStrategy. PostMessageTransportStrategy knows how to
     *    send messages from an iFrame to the parent window and back. Each TransportStrategy
     *    comes with a EgressChannel (CompositeMessageChannel) and DispatchChannel (MessageChannel).
     *
     *    Any message published to the EgressChannel is sent using the runtime specific
     *    communication mechanism for sending messages. Messages that are received by the
     *    TransportStrategy, using the runtime specific communication mechanism for receiving
     *    messages, are published on the DispatchChannel.
     *
     *
     * MessageFramework wires up these different components as follows:
     * 1. TransportStrategy.forward(MessageExchange.egressChannel());
     *    Sets up forwarding of messages from the EgressChannel of the MessageExchange
     *    to the EgressChannel of the TransportStrategy.
     *
     * 2. MessageExchange.listen(TransportStrategy.dispatchChannel());
     *    Sets up the IngressChannel of the MessageExchange to listen for messages from the
     *    DispatchChannel of the TransportStrategy.
     *
     * 3. MessageDispatcher.join(MessageExchange.dispatchChannel());
     *    Sets up the MessageDispatcher to receive messages from the DispatchChannel of the
     *    MessageExchange.
     *
     * Usage:
     *
     * Create a MessageFramework as follows:
     *
     * var messageFramework = new MessageFramework({
     *     strategy: TransportStrategyFactory.build({
     *                  style : "postMessage", ..
     *               }),
     *     responder: new Responder()
     * });
     *
     * Get the instance of the MessageExchange as follows:
     *
     * var exchange = messageFramework.getExchange();
     *
     */
    var MessageFramework = function () {
        this.initialize.apply(this, arguments);
    };

    _.extend(MessageFramework.prototype, {
        initialize: function (opts) {
            opts = $options.fromObject(opts);
            this._exchange = new MessageExchange(opts.getOrElse("messageExchangeOptions", {}));
            this._strategy = opts.getOrError("strategy");
            this._strategy.forward(this._exchange.egressChannel());
            this._exchange.listen(this._strategy.dispatchChannel());
            this._dispatcher = new MessageDispatcher({
                responder: opts.getOrError("responder")
            });
            this._dispatcher.join(this._exchange.dispatchChannel());
            this._dispatcher.enable();
        },
        getExchange: function () {
            return this._exchange;
        }
    });

    return MessageFramework;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/messaging/message-exchange"),
        require("bit/messaging/message-dispatcher")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/messaging/message-exchange",
        "bit/messaging/message-dispatcher"
    ], factory);
}

/*global define, require, module */
var factory = function (
    _,
    $options,
    CompositeMessageChannel,
    StateGuard
) {

    "use strict";

    /**
     * MessageDispatcher
     *
     * Responsibility
     * MessageDispatcher is responsible for sending the 'localDispatch' messages
     * it receives from MessageExchange(s) to a Responder object. It is upto the
     * programmer to write the Responder as a component that can either process the
     * message or forward it down to other components that can do the processing.
     *
     * Illustration
     *                                  +-----------------+
     *                                  |                 |
     *                                  |          +------+--------+
     *                                  |          | EgressChannel |
     *                                  |          +------+--------+
     * +-------------------+   +--------+--------+        |
     * | MessageDispatcher |<--+ DispatchChannel |        |
     * +---------+---------+   +--------+--------+        |
     *   invoke()|         join()       |          +------+---------+
     *           v                      |          | IngressChannel |
     *     +-----------+                |          +------+---------+
     *     | Responder |                |                 |
     *     +-----------+                +-----------------+
     *                                    MessageExchange
     *
     * As shown in the above illustration, the MessageDispatcher joins the
     * DispatchChannel of a MessageExchange. Messages received from the
     * MessaegExchange are parsed and the effective context, API name, payload,
     * and replyCallback from the message is passed to Responder.invoke().
     *
     * For more information about DispatchChannel and localDispatch message,
     * read MessageExchange documentation.
     *
     * @constructor
     */
    var MessageDispatcher = function () {
        this.initialize.apply(this, arguments);
    };

    var defaultContextDelegate = function () {
        return {};
    };

    _.extend(MessageDispatcher.prototype, {
        initialize: function (opts) {
            opts = $options.fromObject(opts);
            this._guard = new StateGuard("disposed");
            // Responder is the object that knows what to do with a message
            this._responder = opts.getOrError("responder");
            this._compositeChannel = new CompositeMessageChannel({
                sentinel: this
            });
            this._enabled = false;
            this._contextDelegate = opts.getOrElse("contextDelegate", defaultContextDelegate);
            _.bindAll(this, "_dispatch");
            this._compositeChannel.subscribe(this._dispatch);

        },

        dispose: function() {
            if (this._guard.applied("disposed")) {
                return;
            }

            if (this._compositeChannel) {
                this._compositeChannel.dispose();
                this._compositeChannel = null;
            }

            if (this._responder) {
                this._responder = null;
            }

            this._guard.apply("disposed");
        },

        /**
         * Join a channel to listen for messages
         * @param {Object} channel - MessageChannel (usually the dispatch channel of a MessageExchange)
         */
        join: function (channel) {
            this._guard.deny("disposed");
            this._compositeChannel.join(channel);
        },

        /**
         * Leave a channel
         * @param {Object} channel - MessageChannel (usually the dispatch channel of a MessageExchange)
         */
        leave: function (channel) {
            this._guard.deny("disposed");
            this._compositeChannel.leave(channel);
        },

        /**
         * Enable the dispatcher
         */
        enable: function () {
            this._guard.deny("disposed");
            this._enabled = true;
        },

        /**
         * Disable the dispatcher
         */
        disable: function () {
            this._guard.deny("disposed");
            this._enabled = false;
        },

        /**
         * Dispatch the message to the responder.
         * @param {Object} wrappedMessage
         */
        _dispatch: function (wrappedMessage) {
            // If a message slipped through between dispose and dispatch time
            // discard the message
            if (this._guard.applied("disposed")) {
                return;
            }

            // If we're not turned on, don't dispatch anything
            if (!this._enabled) {
                return;
            }

            // If it's not wrapped in a localDispatch message, we don't care
            // about it
            if (wrappedMessage.mType !== "localDispatch") {
                return;
            }
            var msg = wrappedMessage.payload;
            var replyCallback = wrappedMessage.replyCallback;
            var ctx = this._contextDelegate();
            this._responder.invoke(ctx, msg.mType, msg, replyCallback);
        }
    });

    return MessageDispatcher;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/messaging/composite-message-channel"),
        require("bit/commons/state-guard")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/messaging/composite-message-channel",
        "bit/commons/state-guard"
    ], factory);
}

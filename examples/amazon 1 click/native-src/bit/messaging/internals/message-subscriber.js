/*global define, require, module */
var factory = function (_, $options) {

    "use strict";

    /**
     * MessageSubscriber
     *
     * Responsibility
     * MessageSubscriber acts as a subscriber to the MessageChannel. A MessageSubscriber
     * is created by the MessageChannel when a module wishes to subscribe to the
     * MessageChannel.
     *
     * Illustration
     *
     * +------------+                                +-----------------------------+
     * | Foo Module +----new MessageChannel(this)--->| Foo MessageChannel          |
     * +------------+                                |-----------------------------|
     *                                               | _sentinel : Foo Module      |
     * +------------+                                |                             |
     * | Bar Module +----subscribe(barHandler)------>| _subscribers : [barHandler] |
     * +------------+                                +-----------------------------+
     *
     * Usage
     * In the above illustration, Foo Module owns a MessageChannel and Bar Module is
     * interested in receving notifications from this channel. Thus, Bar Module calls
     * the MessageChannel.subscribe(barHandler) method on the Foo MessageChannel.
     * As a result of this call, MessageChannel creates a new MessageSubscriber using
     * 'barHandler()' as follows:
     *
     * var subscriber = new MessageSubscriber({ handler: barHandler });
     *
     * When the Foo Module publishes a message on the Foo MessageChannel, it calls the
     * MessageSubscriber.notify() on all it's subscribers.
     *
     * @constructor
     */
    var MessageSubscriber = function () {
        this.initialize.apply(this, arguments);
    };


    _.extend(MessageSubscriber.prototype, {
        initialize: function (opts) {
            opts = $options.fromObject(opts);
            // Handler defines the method that is called when the subscriber receives
            // a message from the Channel.
            this._handler = opts.getOrError("handler");
        },

        /**
         * Returns true if the handler provided matches this subscriber.
         * @param {Function} handler - Method called upon notify.
         */
        matches: function (handler) {
            return (this._handler === handler);
        },

        /**
         * Executes the handler.
         * @param {Object} message.
         */
        notify: function (message) {
            this._handler(message);
        },

        /**
         * Disposes the subscriber by clearing it's handler.
         */
        dispose: function () {
            this._handler = null;
        }
    });

    return MessageSubscriber;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/commons/options"));
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/options"], factory);
}
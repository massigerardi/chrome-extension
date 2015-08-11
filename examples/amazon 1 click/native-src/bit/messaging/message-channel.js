/*global define, require, module */
var factory = function (_, $options, MessageSubscriber) {

    "use strict";

    /**
     * MessageChannel
     *
     * Responsibility
     * MessageChannel is the component of the messaging system to which subscribers
     * can subscribe to and receive messages from.
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
     * Features
     * 1. Channels have only one owner (identified by sentinel), and only that owner
     *    may explicitly publish to the channel. In the above illustration, the owner
     *    is Foo Module.
     * 2. Channels are uni-directional, which keeps message routing easy to debug and
     *    reason about. Additionally, this helps keep the size of the implicit interface
     *    small.
     *
     * Assumptions
     * 1. An object wishing to publish events must expose a channel, and an outside
     *    entity may or may not choose to listen.
     * 2. A channel should make no assumptions about where a consumer lives. It may
     *    exist within the same window, in another window, or on a completely separate
     *    computer. In order to enable these use cases, message sent along a channel
     *    must be serializable.
     *
     * Usage
     * Consider that Foo Module is interested in publishing certain events and
     * Bar Module is interested in learning about those events. Foo Module creates a
     * MessageChannel as follows:
     *
     * var fooChannel = new MessageChannel({sentinel: this});
     *
     * The 'sentinel' parameter allows FooModule to control the Channel and prevents
     * any other modules from publishing to this channel. Bar Module can then subscibe to
     * this channel as follows:
     *
     * fooChannel.subscribe(barHandler);
     *
     * Here 'barHandler()' is a function that will be invoked when FooModule decides to
     * publish a message on the 'fooChannel'. Internally, fooChannel creates a new
     * MessageSubscriber using the 'barHandler()'. This function should be ready to accept
     * a single message parameter.
     *
     * Foo Module can publish a message on the 'fooChannel' as follows:
     *
     * fooChannel.publish(this, message);
     *
     * Here, 'this' refers to whatever was used as the sentinel while creating the channel.
     * In the above example, it is the Foo Module instance that created this channel. As a
     * result of this, 'fooChannel' invokes the notify() method on all the  MessageSubscribers
     * that are subscribed to it. MessageSubscriber.notify() relays the call to the handlers
     * used to register the subscribers (for example: 'barHandler()').
     *
     * @constructor
     */
    var MessageChannel = function () {
        this.initialize.apply(this, arguments);
    };

    _.extend(MessageChannel.prototype, {
        initialize: function (opts) {
            opts = $options.fromObject(opts);
            // Having a sentinel makes it easy to debug and enforce access control.
            this._sentinel = opts.getOrError("sentinel");
            this._subscribers = [];
        },

        /**
         * Publishes the message to the subscribers if the right sentinel is provided.
         * @param {Object} sentinel - This must be same as the one provided at the time of Channel creation.
         * @param {Object} message - Message that needs to be published to the channel's subscribers.
         */
        publish: function (sentinel, message) {
            if (this._sentinel !== sentinel) {
                throw new Error("Invalid sentinel provided; cannot publish message.");
            }
            _.invoke(this._subscribers, "notify", message);
        },

        /**
         * Allows subscribers to provide a handler and subscribe to this channel.
         * @param {Function} handler - Creates a subscriber with the provided handler.
         */
        subscribe: function (handler) {
            if (!handler) {
                return;
            }
            if (_.any(this._subscribers, function (subscriber) {
                return subscriber.matches(handler);
            })) {
                throw new Error("Cannot double-subscribe to a channel.");
            }
            this._subscribers.push(new MessageSubscriber({
                handler: handler
            }));
        },

        /**
         * Unsubscribes from the channel by providing the handler used to create the Subscriber
         * @param {Function} handler - Must be the same as the one used to create the Subscriber
         */
        unsubscribe: function (handler) {
            var idx = 0;
            var matchingSubcriber = _.find(this._subscribers, function (subscriber) {
                if (subscriber.matches(handler)) {
                    return true;
                } else {
                    idx = idx + 1;
                }
            });
            if (matchingSubcriber) {
                this._subscribers.splice(idx, 1);
                matchingSubcriber.dispose();
            }
        },

        /**
         * Disposes the channel by disposing all it's subscribers
         */
        dispose: function () {
            _.invoke(this._subscribers, "dispose");
            this._subscribers = [];
        }
    });
    return MessageChannel;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/commons/options"),
        require("bit/messaging/internals/message-subscriber"));
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/options", "bit/messaging/internals/message-subscriber"], factory);
}

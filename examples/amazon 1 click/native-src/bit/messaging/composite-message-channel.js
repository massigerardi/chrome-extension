/*global define, require, module */
var factory = function (_, MessageChannel) {

    "use strict";

    /**
     * CompositeMessageChannel
     *
     * Responsibility
     * CompositeMessageChannel is a special type of MessageChannel that allows
     * multiple publishers to publish messages (as opposed to the regular
     * MessageChannel that only ever has one owner/publisher).
     *
     * Illustration
     *
     *     owner1						 owner3
     * +-------------+  join()   +----------------------+ publish() +-------------+
     * | foo1Channel +---------->|                      +---------->| subscriber1 |
     * +-------------+           |                      |           +-------------+
     *                           | fooCompositeChannel  |
     * +-------------+  join()   |                      | publish() +-------------+
     * | foo2Channel +---------->|                      +---------->| subscriber2 |
     * +-------------+           +----------------------+           +-------------+
     *     owner2
     *
     * In the above Illustration, fooChannel1 and fooChannel2 are regular
     * MessageChannels owned by owner1 and owner2 respectively. fooCompositeChannel
     * is a CompositeMessageChannel owned by owner3. Subscriber1 and Subscriber2 are
     * two subscribers of the fooCompositeChannel.
     *
     * fooCompositeChannel is a full-fledged MessageChannel i.e. owner3 can
     * publish messages on this channel and both it's subscribers subscriber1 and
     * subscriber2 will receive this message.
     *
     * Because FooCompositeChannel is a CompositeMessageChannel, it can also relay
     * messages from other channels (such as fooChannel1 and fooChannel2) to it's
     * subscribers - thereby allowing multiple publishers to publish on the same
     * channel.
     *
     * Usage
     * The above functionality can be achieved by joining fooChannel1 and fooChannel2
     * to fooCompositeChannel as follows:
     *
     * fooCompositeChannel.join(foo1Channel);
     * fooCompositeChannel.join(foo2Channel);
     *
     * As a result, any messages published to foo1Channel or foo2Channel or
     * fooCompositeChannel will be sent to subscriber1 and subscriber2.
     *
     * Note that messages published on fooCompositeChannel will not be sent to direct
     * subscribers of foo1Channel and foo2Channel.
     *
     * @constructor
     */
    var CompositeMessageChannel = function () {
        this.initialize.apply(this, arguments);
    };

    _.extend(CompositeMessageChannel.prototype, MessageChannel.prototype);

    _.extend(CompositeMessageChannel.prototype, {
        initialize: function () {
            // Call parent initializer
            MessageChannel.prototype.initialize.apply(this, arguments);
            this._joinedChannels = [];
            _.bindAll(this, "_forwardDispatcher");
        },

        /**
         * Allows a publisher to join the Composite channel
         * @param {Object} otherChannel
         */
        join: function (otherChannel) {
            otherChannel.subscribe(this._forwardDispatcher);
            this._joinedChannels.push(otherChannel);
        },

        /**
         * Allows a publisher to leave the Composite channel
         * @param {Object} otherChannel
         */
        leave: function (otherChannel) {
            var localRef;
            var idx = this._joinedChannels.indexOf(otherChannel);
            if (idx !== -1) {
                localRef = this._joinedChannels[idx];
                this._joinedChannels.splice(idx, 1);
            }
            if (localRef) {
                otherChannel.unsubscribe(this._forwardDispatcher);
            }
        },

        /**
         * Ferries event as if this channel had published the message itself
         * @param {Object} message - Message to be forwarded
         */
        _forwardDispatcher: function (message) {
            this.publish(this._sentinel, message);
        }
    });

    return CompositeMessageChannel;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/messaging/message-channel"));
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/messaging/message-channel"], factory);
}
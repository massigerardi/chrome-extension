var factory = function(
    _,
    Events,
    MessageChannel,
    CompositeChannel
) {

    /**
     * InMemoryPort
     *
     * Mimics the Firefox Port API, with incoming/outgoing messages sent along
     * ingress/egress channels, rather than to an actual remote window.
     *
     * Useful for testing, or for situations where a "remote" component is actually
     * local.
     */
    var InMemoryPort = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(InMemoryPort.prototype, {
        initialize: function() {
            // We want to use Events to manage the subscriptions,
            // but the Events API overlaps with the Port API, so instead of
            // mixing in Events to InMemoryPort, we manage
            // them in an internal object
            this._pubsub = _.extend({}, Events);

            // emit() forwards to egressChannel
            this._egressChannel = new MessageChannel({sentinel: this});

            // ingressChannel forwards to on() subscribers
            this._ingressChannel = new CompositeChannel({sentinel: this});

            this._ingressChannel.subscribe(_.bind(function(msg) {
                if (msg.msgLabel && msg.msg) {
                    this._pubsub.notify(msg.msgLabel, msg.msg);
                } else {
                    throw new Error("Invalid message format for InMemoryPort dispatch");
                }
            }, this));
        },


        // Part of the Port API
        on: function(label, handler) {
            this._pubsub.on(label, handler);
        },

        // Part of the Port API
        emit: function(label, msg) {
            this._egressChannel.publish(this, {
                msgLabel: label,
                msg: msg
            });
        },

        // Messages published to otherChannel with the format
        // msg.inMsgLabel and msg.msg will be forwarded to event subscribers
        join: function(otherChannel) {
            this._ingressChannel.join(otherChannel);
        },

        leave: function(otherChannel) {
            this._ingressChannel.leave(otherChannel);
        },

        egressChannel: function() {
            return this._egressChannel;
        },

        twine: function(otherPort) {
            this.join(otherPort.egressChannel());
            otherPort.join(this.egressChannel());
        },

        untwine: function(otherPort) {
            this.leave(otherPort.egressChannel());
            otherPort.leave(this.egressChannel());
        }
    });

    return InMemoryPort;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/events"),
        require("bit/messaging/message-channel"),
        require("bit/messaging/composite-message-channel")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/events",
        "bit/messaging/message-channel",
        "bit/messaging/composite-message-channel"
    ], factory);
}

var factory = function(
    _,
    MessageChannel
) {

    /**
     *  USE AT YOUR OWN RISK
     *
     *  A MessageBus is like a MessageChannel (and in fact inherits from it)
     *  but without the single-publisher restriction. A MessageBus owns its own
     *  sentinel. The publish method accepts 1 or 2 arguments (message, or sentinel
     *  and message) to remain compatible with the MessageChannel API, but if
     *  a sentinel is provided it will be ignored.
     *
     *  Note that in most cases, when you think you want a MessageBus, what you
     *  really want is a CompositeChannel.
     */
    var MessageBus = function() {
        this.initialize.apply(this, arguments);
    };


    _.extend(MessageBus.prototype, MessageChannel.prototype, {
        initialize: function() {
            this._privateSentinel = {};
            MessageChannel.prototype.initialize.call(this, {sentinel: this._privateSentinel});
        },
        /**
         *  Publish a message to listeners
         *
         *  Either two args:
         *  @param {Object} sentinel
         *  @param {Object} message
         *
         *  Or one arg:
         *  @param {Object} message
         *
         *  If a sentinel is provided, it will be ignored, as a MessageBus owns its
         *  own sentinel. This is to remain API compatible with MessageChannel.
         */
        publish: function() {
            var args = _.toArray(arguments);
            var sentinel = this._privateSentinel;
            var msg;
            if (args.length == 1) {
                msg = args[0];
            } else {
                msg = args[1];
            }
            return MessageChannel.prototype.publish.call(this, sentinel, msg);
        }
    });

    return MessageBus;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/messaging/message-channel")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/messaging/message-channel"
    ], factory);
}

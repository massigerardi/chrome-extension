/*global define, require, module */
var factory = function (_, $options, $uuid) {

    "use strict";

    var constructors = {
        Message: function (opts) {
            return {
                msgId: $uuid.v4(),
                mType: opts.getOrError("mType"),
                payload: opts.getOrElse("msg", null),
                t: Date.now()
            };
        },
        rpcSend: function (opts) {
            return this.Message(opts);
        },
        rpcSendAndReceive: function (opts) {
            return this.Message(opts);
        },
        rpcReply: function (opts) {
            return _.extend(this.Message(opts), {
                rMsgId: opts.getOrError("inReplyTo"),
                error: opts.getOrElse("error", null)
            });
        },
        localDispatch: function (opts) {
            return _.extend(this.Message(opts), {
                oMsgId: opts.getOrError("originalMsgId"),
                replyCallback: opts.getOrError("replyCallback")
            });
        }
    };

    /**
     * MessageFactory
     *
     * Respnosibility
     * MessageFactory is responsible for creating different kinds of
     * messages used by the MessageExchange.
     *
     * Refer the MessageExchange documentation to learn more about
     * MessageFactory
     * @constructor
     */

    var MessageFactory = function () {
        this.initialize.apply(this, arguments);
    };

    _.extend(MessageFactory.prototype, {
        initialize: function (opts) {}
    });

    MessageFactory.createMessage = function (opts) {
        opts = $options.fromObject(opts);
        return constructors[opts.getOrError("mType")](opts);
    };

    return MessageFactory;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/commons/options"),
        require("bit/commons/uuid"));
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/options", "bit/commons/uuid"], factory);
}

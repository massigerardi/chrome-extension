var factory = function(
    _,
    $options
) {

    var SUFFIX_WHEN_MISSING = "unhandled";
    var SUFFIX_WHEN_INVALID = "invalid";

    var BEFORE_DISPATCH_METHOD = "beforeDispatch";
    var AFTER_DISPATCH_METHOD  = "afterDispatch";


    /**
     * InvocationRouter
     *
     * Meant to be used in tandem with a MessageDispatcher, an InvocationRouter
     * automatically calls methods on the provided delegate based on the name
     * of the message mType.
     *
     *
     * For instance, given:
     *
     *
     *     var MyService = function() {
     *         this.initialize.apply(this, arguments);
     *     }
     *
     *     MyService.prototype = {
     *         initialize: function(messageExchange) {
     *             this._exchange = messageExchange;
     *             this._dispatcher = new MessageDispatcher({
     *                 responder: new InvocationRouter({ delegate: this })
     *             })
     *             this._dispatcher.join(this._exchange.dispatchChannel());
     *             this._dispatcher.enable();
     *         },
     *
     *         // if this._exchange receives a message of mType "funkyTown",
     *         // it will be auto-dispatched to this method
     *         onMsgFunkyTown: function(ctx, msg, cb) {
     *             cb(null, {
     *                 mType: "funkyTownReply"
     *             });
     *         },
     *
     *         // If a message is missing an mType, it will be sent to an "invalid"
     *         // handler
     *         onMsgInvalid: function(ctx, msg, cb) {
     *             // Do something interesting (log, etc)
     *         },
     *
     *         // If a message is sent with an mType for which there is no exact handler
     *         // match, it will be dispatched here. This is useful for debugging and/or
     *         // transparent forwarding
     *         onMsgUnhandled: function(ctx, msg, cb) {
     *             // Do something interesting
     *         }
     *     };
     *
     *     var clientExchange = new MessageExchange();
     *     var serviceExchange = new MessageExchange();
     *
     *     // Hooks up the two exchanges directly - just used for
     *     // local, in-memory dispatch between two exchanges (mostly for testing)
     *     serviceExchange.twine(clientExchange);
     *
     *     var service = new MyService(serviceExchange);
     *
     *     clientExchange.sendAndReceive({
     *         mType: "funkyTown"
     *     }, function(err, resp) {
     *         console.log(resp.mType); // logs "funkyTownReply"
     *     });
     *
     */
    var InvocationRouter = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(InvocationRouter.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._handlerPrefix = opts.getOrElse("handlerPrefix", "onMsg");
            this._delegate = opts.getOrError("delegate");
        },
        invoke: function(ctx, mType, msg, cb) {
            var handlerName = this._handlerNameForMessageType(mType);
            var fallback = this._handlerNameForMessageType(SUFFIX_WHEN_MISSING);
            var finalHandler = null;
            if (typeof this._delegate[handlerName] === "function") {
                finalHandler = handlerName;
            } else if (typeof this._delegate[fallback] === "function") {
                finalHandler = fallback;
            }

            if (finalHandler) {

                if (typeof this._delegate[BEFORE_DISPATCH_METHOD] === "function") {
                    this._delegate[BEFORE_DISPATCH_METHOD](ctx, msg);
                }

                this._delegate[finalHandler](ctx, msg, _.bind(function() {
                    var args = _.toArray(arguments);
                    if (typeof this._delegate[AFTER_DISPATCH_METHOD] === "function") {
                        this._delegate[AFTER_DISPATCH_METHOD](ctx, msg, args);
                    }
                    cb.apply(null, args);
                }, this));
            }
        },
        _handlerNameForMessageType: function(msgType) {
            msgType = msgType || SUFFIX_WHEN_INVALID;
            return this._handlerPrefix + msgType.charAt(0).toUpperCase() + msgType.substr(1);
        }
    });

    return InvocationRouter;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options"
    ], factory);
}

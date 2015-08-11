var factory = function(
    _,
    Promise,
    MessageDispatcher,
    InvocationRouter,
    StateGuard
) {

    /**
     * Object encapsulating the state of a connected client, and providing
     * the wiring between the connected client and the provided `delegate`.
     * See Session#attach(delegate).
     */
    var Session = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Session.prototype, {
        initialize: function(clientIdentity, messageExchange) {
            this._clientIdentity = clientIdentity;
            this._exchange = Promise.promisifyAll(messageExchange);
            this._dispatcher = null;
            this._guard = new StateGuard("disposed");
            _.bindAll(this, "_getRequestContext");
        },

        dispose: function() {
            if (this._guard.applied("disposed")) {
                return;
            }

            this.detach();
            this._exchange = null;
            this._guard.apply("disposed");
        },

        /**
         * The clientIdentity provided during instantiation.
         */
        clientIdentity: function() {
            return this._clientIdentity;
        },

        /**
         * Attaches this session to the provided `delegate`.
         *
         * In the case of a CheramiService, this will in most cases be
         * the service instance itself.
         *
         * Attaching a session to a delegate allows the delegat to respond
         * to messages received by this session's MessageExchange. It uses
         * an InvocationRouter which transforms messages with mType = "foo" to
         * `delegate.onMsgFoo(ctx, msg, cb)` invocations.
         *
         * Attaching to a delegate causes any prevously attached delegate to be
         * detached.
         */
        attach: function(delegate) {
            this._guard.deny("disposed");

            if (this._dispatcher) {
                this.detach();
            }

            this._dispatcher = new MessageDispatcher({
                responder: new InvocationRouter({ delegate: delegate }),
                contextDelegate: this._getRequestContext
            });
            this._dispatcher.join(this._exchange.dispatchChannel());
            this._dispatcher.enable();
        },

        /**
         * Detaches this session from any previously attached delegate.
         *
         * If not previously attached, this does nothing.
         */
        detach: function() {
            if (this._dispatcher) {
                this._dispatcher.disable();
                this._dispatcher.dispose();
                this._dispatcher = null;
            }
        },

        exchange: function() {
            this._guard.deny("disposed");

            return this._exchange;
        },

        _getRequestContext: function() {
            return {
                session: this
            };
        }
    });

    return Session;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/messaging/message-dispatcher"),
        require("bit/messaging/invocation-router"),
        require("bit/commons/state-guard")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/messaging/message-dispatcher",
        "bit/messaging/invocation-router",
        "bit/commons/state-guard"
    ], factory);
}

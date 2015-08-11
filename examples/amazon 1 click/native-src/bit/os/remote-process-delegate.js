var factory = function(
    _,
    Promise,
    $options,
    MessageExchange,
    MessageDispatcher,
    InvocationRouter
) {

    /**
     * Much like a LocalProcess delegates all of its intelligence to
     * a delegate object (via a MessageExchange), a RemoteProcess
     * does the same, but to a remote delegate sitting on the other
     * side of a memory boundary, communicating via a TransportStrategy.
     *
     * The RemoteProcessDelegate is a helper base class that takes care of
     * the lower-level RemoteProcess requirements, such as initial handshaking
     * and periodic health checking.
     */

    var RemoteProcessDelegate = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(RemoteProcessDelegate.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            var transport = opts.getOrError("transport");

            this._messageExchange = new MessageExchange();
            this._messageExchange.listen( transport.dispatchChannel() );
            transport.forward( this._messageExchange.egressChannel() );

            this._dispatcher = new MessageDispatcher({
                responder: new InvocationRouter({ delegate: this })
            });
            this._dispatcher.join( this._messageExchange.dispatchChannel() );
            this._dispatcher.enable();
        },

        start: function(cb) {
            return Promise.bind(this).nodeify(cb);
        },

        stop: function(cb) {
            return Promise.bind(this).nodeify(cb);
        },

        onMsgUBPProcessHandshake: function(ctx, msg, cb) {
            cb(null, {
                mType: "UBPProcessHandshakeReply"
            });
        },

        onMsgUBPProcessHealthCheck: function(ctx, msg, cb) {
            cb(null, {
                mType: "UBPProcessHealthCheckReply"
            });
        },

        onMsgUBPProcessSignal: function(ctx, msg, cb) {
            cb(null, {
                mType: "UBPProcessSignalReply"
            });
        },

        onMsgUnhandled: function(ctx, msg, cb) {}
    });

    return RemoteProcessDelegate;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/messaging/message-exchange"),
        require("bit/messaging/message-dispatcher"),
        require("bit/messaging/invocation-router")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/messaging/message-exchange",
        "bit/messaging/message-dispatcher",
        "bit/messaging/invocation-router"
    ], factory);
}

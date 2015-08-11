var factory = function(
    _,
    Promise,
    $options,
    StateGuard,
    MessageExchange,
    Session,
    AsyncInMemoryStore,
    MessageChannel
) {

    /**
     *
     *
     * Note: Cher Ami is the name of the WWI homing pigeon which helped save
     * the Lost Battalion of the 77th Division in the Battle of the Argonne.
     * It's French for "dear friend". Get it? A client/service library named
     * after a homing pigeon?
     *
     * I pronounce my single-word version "shur-AH-me", and it means nothing, but
     * sounds cool. It's also the name of an American actress/voice actress, but
     * didn't know that when I picked the name.
     */

    var CheramiService = function(){
        this.initialize.apply(this, arguments);
    };

    _.extend(CheramiService.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._sessions = new AsyncInMemoryStore();
            this._broadcastChannel = new MessageChannel({sentinel: this});
            this._guard = new StateGuard("disposed", "started");
            _.bindAll(this, "_broadcast");
            this._broadcastChannel.subscribe(this._broadcast);
        },

        dispose: function() {
            if (this._guard.applied("disposed")) {
                return;
            }

            if (this._broadcastChannel) {
                this._broadcastChannel.dispose();
            }

            if (this._sessions) {
                this._sessions.dispose();
                this._sessions = null;
            }

            this._guard.apply("disposed");
        },

        /**
         * Default implementation is a placeholder. Consumers should always assume
         * there are explicit start/stop steps to a Cherami service, to allow
         * potentially asynchronous setup/teardown of internal components.
         *
         * @async Node
         */
        start: function(cb) {
            return Promise.bind(this)
            .then(function() {
                return this._guard.denyAsync("disposed");
            })
            .then(function() {
                return this._guard.applyAsync("started");
            }).nodeify(cb);
        },

        /**
         * @async Node
         */
        stop: function(cb) {
            return Promise.bind(this).nodeify(cb);
        },

        /**
         * Creates a new Exchange bound to the provided transport
         * and this service as the responder.
         *
         * @async Node
         */
        clientConnect: function(clientIdentity, transport, cb) {
            return Promise.bind(this)
            .then(function() {
                return this._guard.denyAsync("disposed");
            })
            .then(function() {
                return this._guard.requireAsync("started");
            })
            .then(function() {
                return this._buildExchange(transport);
            })
            .then(function(exchange) {
                return this._initSession(clientIdentity, exchange);
            }).nodeify(cb);
        },

        /**
         * Like clientConnect. Assumes the provided exchange is already
         * twined with a remote exchange.
         *
         * @async Node
         */
        clientConnectExchange: function(clientIdentity, exchange, cb) {
            return Promise.bind(this)
            .then(function() {
                return this._guard.denyAsync("disposed");
            })
            .then(function() {
                return this._guard.requireAsync("started");
            })
            .then(function(){
                return this._initSession(clientIdentity, exchange);
            }).nodeify(cb);
        },

        /**
         * Disconnects the client identified by `clientIdentity` by removing
         * the session from the session store.
         */
        clientDisconnect: function(clientIdentity, cb) {
            return Promise.bind(this)
            .then(function() {
                return this._guard.denyAsync("disposed");
            })
            .then(function() {
                return this._guard.requireAsync("started");
            })
            .then(function() {
                return this._sessions.remove(clientIdentity);
            })
            .then(function(session) {
                session.dispose();
            }).nodeify(cb);
        },

        /**
         * Query to see if a client with the provided `clientIdentity` is
         * connected by inspecting the session store.
         */
        clientConnected: function(clientIdentity, cb) {
            return this._sessions.exists(clientIdentity).nodeify(cb);
        },

        /**
         * Message published along the broadcastChannel are also
         * sent to any connected transports/exchanges.
         */
        broadcastChannel: function() {
            return this._broadcastChannel;
        },

        /**
         * Causes a message to be broadcast to all connected transports/exchanges.
         */
        broadcast: function(msg) {
            this._guard.deny("disposed").required("started");
            this._broadcastChannel.publish(this, msg);
        },


        /**
         * Loops through current sessions and performs a MessageExchange#send
         * of the provided message to that session's MessageExchange.
         */
        _broadcast: function(msg) {
            return this._sessions.keys().bind(this).then(function(keys) {
                return Promise.all(_.map(keys, function(key) {
                    return this._sessions.get(key).bind(this).then(function(session) {
                        // Broadcast does a send, not sendAndReceive.
                        // Connected clients are not expected to reply to
                        // any particular broadcast message, so it's
                        // not productive to wait for replies.
                        return session.exchange().sendAsync(msg);
                    });
                }, this));
            });
        },

        /**
         * Default no-op implementation of onMsgUnhandled. Override in a subclass
         * to be notified when a message sent to this service isn't being handled
         * by virtue of having an onMsg[Pascal-cased mType] handler defined on
         * the service object.
         *
         * @async Node
         */
        onMsgUnhandled: function(ctx, msg, cb) {},

        /**
         * Default no-op implementation of onMsgInvalid. Override in a subclass to
         * be notified when a message without an mType is sent to this service.
         *
         * @async Node
         */
        onMsgInvalid: function(ctx, msg, cb) {},


        /**
         * Builds an exchange bound to this transport (but otherwise unwired)
         *
         * @async Promise
         */
        _buildExchange: Promise.method(function(transport) {
            var exchange = Promise.promisifyAll(new MessageExchange());
            transport.forward(exchange.egressChannel());
            exchange.listen(transport.dispatchChannel());
            return exchange;
        }),

        /**
         * Constructs a session object, wires the exchange to the session
         * dispatchers, wires session to delegate (this), stashes session,
         * begins heartbeat check cycle
         *
         * @async Promise
         */
        _initSession: Promise.method(function(clientIdentity, exchange) {
            var session = new Session(clientIdentity, exchange);
            session.attach(this);

            // In another world, it might be a mistake to trust the clientIdentity.
            // But for now, we're in my world, and in my world, the client tells
            // the truth.
            return this._sessions.put(clientIdentity, session).then(function() {
                return session;
            });
        })

    });

    Promise.promisifyAll(CheramiService.prototype);

    return CheramiService;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/state-guard"),
        require("bit/messaging/message-exchange"),
        require("bit/cherami/internals/session"),
        require("bit/cherami/internals/storage/async-in-memory-store"),
        require("bit/messaging/message-channel")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/state-guard",
        "bit/messaging/message-exchange",
        "bit/cherami/internals/session",
        "bit/cherami/internals/storage/async-in-memory-store",
        "bit/messaging/message-channel"
    ], factory);
}

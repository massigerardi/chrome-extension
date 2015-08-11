var factory = function(
    _,
    Promise,
    $uuid,
    $options,
    $taskManager,
    $lang,
    InMemoryPort,
    MessageExchange,
    MessageChannel,
    MessageDispatcher,
    InvocationRouter
) {

    /**
     * InMemoryPortSandboxDelegate is used to facilitate easy testing of
     * virtual remote processes. They don't actually create the underlying
     * sandbox, but return a port bound to an exchange which will reply to
     * the initial handshake method as though it exists.
     */

    var InMemoryPortSandboxDelegate = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(InMemoryPortSandboxDelegate.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._sandboxes = {};
            this._transportStrategyOptions = opts.getOrElse("transportStrategyOptions", undefined);
            this._delegate = opts.getOrElseFn("remoteDelegate", function() {
                return new AutoRespondingDelegate();
            });

        },
        fabricate: function(url, cb) {
            var sandboxId = $uuid.v4();

            var sandbox = new Sandbox({
                id: sandboxId,
                url: url,
                delegate: this._delegate,
                transportStrategyOptions: this._transportStrategyOptions
            });

            this._sandboxes[sandboxId] = sandbox;
            $taskManager.scheduleTask($lang.partiallyApply(cb, null, {
                handle: sandboxId,
                bindable: {
                    port: sandbox.port()
                }
            }));
        },
        destroy: function(handle, cb) {
            // TODO: kill with fire
        }
    });

    var Sandbox = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Sandbox.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);

            this._id          = opts.getOrError("id");
            this._url         = opts.getOrError("url");

            this._delegate    = opts.getOrElse("delegate", this);

            var transportStrategyOptions = $options.fromObject(opts.getOrElse("transportStrategyOptions", undefined));

            this._inMsgLabel  = transportStrategyOptions.getOrElse("inMsgLabel", "messageToPort");
            this._outMsgLabel = transportStrategyOptions.getOrElse("outMsgLabel", "messageFromPort");


            this._exchange   = new MessageExchange({
                remoteReplyTimeout: 2000
            });
            this._toExchange = new MessageChannel({sentinel: this});
            // Publishing to toExchange will cause the MessageExchange to receive
            // and respond to incoming messages
            this._exchange.listen(this._toExchange);

            this._port   = new InMemoryPort();
            this._toPort = new MessageChannel({sentinel: this});
            // Publishing to toPort causes the port to "emit" the message provided,
            // wrapping it in the conventional port message envelope along the way.
            this._port.join(this._toPort);

            // Handle "outgoing" messages
            this._exchange.egressChannel().subscribe(_.bind(function(msg) {
                this._toPort.publish(this, {
                    msgLabel: this._outMsgLabel,
                    msg: {
                        origin: this._url,
                        payload: msg
                    }
                })
            }, this));

            // Handle "incoming" messages
            this._port.egressChannel().subscribe(_.bind(function(msg) {
                this._toExchange.publish(this, msg.msg.payload);
            }, this));

            // Dispatch incoming messages
            this._dispatcher = new MessageDispatcher({
                responder: new InvocationRouter({ delegate: this._delegate })
            });

            this._dispatcher.join(this._exchange.dispatchChannel());
            this._dispatcher.enable();

            // this._mirrorPort = new InMemoryPort();
            // this._port.twine(this._mirrorPort);
        },
        port: function() {
            return this._port;
        }
    });

    var AutoRespondingDelegate = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(AutoRespondingDelegate.prototype, {
        initialize: function() {},
        onMsgUBPProcessHandshake: function(ctx, msg, cb) {
            $taskManager.scheduleTask($lang.partiallyApply(cb, null, {
                mType: "UBPProcessHandshakeReply"
            }));
        },
        onMsgUBPProcessSignal: function(ctx, msg, cb) {
            cb();
        }
    });

    return InMemoryPortSandboxDelegate;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/uuid"),
        require("bit/commons/options"),
        require("bit/commons/task-manager"),
        require("bit/commons/lang"),
        require("bit/messaging/internals/in-memory-port"),
        require("bit/messaging/message-exchange"),
        require("bit/messaging/message-channel"),
        require("bit/messaging/message-dispatcher"),
        require("bit/messaging/invocation-router")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/uuid",
        "bit/commons/options",
        "bit/commons/task-manager",
        "bit/commons/lang",
        "bit/messaging/internals/in-memory-port",
        "bit/messaging/message-exchange",
        "bit/messaging/message-channel",
        "bit/messaging/message-dispatcher",
        "bit/messaging/invocation-router"
    ], factory);
}

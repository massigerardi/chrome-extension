var factory = function(
    _,
    Promise,
    $options,
    MessageExchange,
    MessageDispatcher,
    Handshake,
    BaseProcess
) {

    var LocalProcess = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(LocalProcess.prototype, BaseProcess.prototype, {
        initialize: function(opts) {
            BaseProcess.prototype.initialize.apply(this, arguments);
            opts = $options.fromObject(opts);

            // A LocalProcess has a ProcessDelegate, which is expected
            // to implement:
            //   ProcessDelegate#exchange() - will be tied to this
            //   process's exchange.
            this._delegate = opts.getOrError("delegate");
            this._exchange = null;
            this._dispatcher = new MessageDispatcher({
                responder: this
            });
        },

        /**
         * init - Handshakes with the delegate provided during instantiation.
         *
         * @returns Promise{empty} - Promise is fulfilled when the underlying
         *                           sandbox has been created, and initial
         *                           handshake is complete.
         */
        init: function() {
            return this._transitionToAsync("INITIALIZING")
            .bind(this)
            .then(function() {

                // We don't have per-request timeouts,
                // so we use a separate MessageExchange during
                // the handshake process
                this._handshakeExchange = new MessageExchange({
                    remoteReplyTimeout: 7 * 1000
                });

                var otherExchange = this._delegate.exchange();
                this._handshakeExchange.twine(otherExchange);

                this.transitionTo("HANDSHAKING");
                this._handshake = new Handshake({
                    exchange: this._handshakeExchange
                });

                this._handshake.start();
                return this._handshake.promise();
            }).then(function() {
                var otherExchange = this._delegate.exchange();
                this._handshakeExchange.untwine(otherExchange);
                this._handshakeExchange.dispose();

                this._exchange = Promise.promisifyAll(new MessageExchange());
                this._dispatcher.join(this._exchange.dispatchChannel());
                this._dispatcher.enable();

                this._exchange.twine(otherExchange);
                this.transitionTo("RUNNING");
                return this._exchange;
            });
        },
        exchange: function() {
            return this._exchange;
        },
        didSigTerm: Promise.method(function() {
            // Noop
        })
    });

    return LocalProcess;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/messaging/message-exchange"),
        require("bit/messaging/message-dispatcher"),
        require("bit/os/internals/handshake"),
        require("bit/os/internals/base-process")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/messaging/message-exchange",
        "bit/messaging/message-dispatcher",
        "bit/os/internals/handshake",
        "bit/os/internals/base-process"
    ], factory);
}

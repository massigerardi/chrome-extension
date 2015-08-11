var factory = function(
    _,
    Promise,
    $options,
    // I don't really like the TransportStrategyFactory singleton, since its
    // registered providers are only modifiable at module declaration time
    // rather than at runtime. This prevents other strategies from being
    // added in a late-bound fashion. But, it's also the only thing we have
    // at the moment.
    TransportStrategyFactory,
    MessageFramework,
    BaseProcess,
    Handshake
) {

    /**
     * RemoteProcess
     *
     * Represents a running process in the virtual process manager.
     *
     * Conceptually, a remote process is defined as a remote SPA running in an execution
     * sandbox, such as an iframe or Mozilla PageWorker. A `RemoteProcess` encapsulates
     * the following:
     *
     *   1. Execution state
     *   2. Messaging to the underlying sandbox (via a MessageTransport)
     *   3. Health-checking the contained SPA.
     *
     */
    var RemoteProcess = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(RemoteProcess.prototype, BaseProcess.prototype, {
        /**
         * Do not confuse this object initializer with the
         * RemoteProcess#init method, which instructs the
         * newly created process object to begin
         * construction of the underlying sandbox-hosted SPA
         */
        initialize: function(opts) {
            BaseProcess.prototype.initialize.apply(this, arguments);
            opts = $options.fromObject(opts);
            this._url = opts.getOrError("url");
            this._identity = opts.getOrError("identity");

            // TODO: Exchanges don't have automatic retries
            // Additionally, they have a per-exchange timeout.
            // We want a lower timeout for the handshake than for other
            // request. As a result, we use two exchanges  - one during
            // handshake, and one during normal requests.
            //
            // We need to implement per-request tryouts,
            // or use a separate exchange for handshaking
            // than we use for everything else. This is
            // vaiable, but messy.
            //
            // Alternatively, we can do a manual handshake,
            // not using the exchange stuff.
            // BEGIN HACKS
            this._handshakeExchange = null;
            this._exchange = null; // Will be set during RemoteProcess#init
            // END HACKS


            var transportOpts = opts.getOrElse("transportStrategyOptions");
            if (!transportOpts.identity) {
                transportOpts.identity = this._identity;
            }

            if (!transportOpts.style) {
                transportOpts.style = opts.getOrElse("transportStyle", "postMessage");
            }

            this._transport = TransportStrategyFactory.build(transportOpts);

            /**
             * SandboxDelegate is expected to have the following methods:
             *
             * SandboxDelegate#fabricate(url, cb) - Creates a sandbox pointing at the provided URL.
             *   @param {url} - string URL
             *   @param {cb}  - function(result, error) - Called on completion
             *                  `result` should have the following:
             *                    result.handle   - object - Used to later manipulate/destroy the sandbox
             *                    result.bindable - object - An object suitable for usage in
             *                                               MessageTransportStrategy#bind. Care should
             *                                               be taken to ensure that the SandboxDelegate
             *                                               and TransportStyle provided to this RemoteProcess
             *                                               are compatible
             *
             *
             * SandboxDelegate#destroy(handle, cb) - Destroys a previously created sandbox
             */

            // Promisify the delegate to get *Async methods.
            this._sandboxDelegate = Promise.promisifyAll(opts.getOrError("sandboxDelegate"));

            // The sandbox handle is returned by SandboxDelegate#fabricate.
            // This handle can be used to later destroy the sandbox using
            // SandboxDelegate#destroy
            this._sandboxHandle = null;
        },

        /**
         * init - Creates underlying process sandbox pointing at remote
         *        Single Page Application (SPA).
         *
         *        Underlying execution sandbox is created using the constructor-
         *        provided SandboxDelegate.
         *
         * @returns Promise{empty} - Promise is fulfilled when the underlying
         *                           sandbox has been created, and initial
         *                           handshake is complete.
         */
        init: function() {
            // We start off in INITIALIZING
            return this._transitionToAsync("INITIALIZING")

            // .bind sets the context for the rest of the promise chain
            .bind(this)

            // This creates the actual underlying sandbox we'll be communicating with
            .then(function() {
                return this._sandboxDelegate.fabricateAsync(this._url);
            }).then(function(res) {
                // Stash handle for teardown
                this._sandboxHandle = res.handle;

                // Bind transport to the sandbox
                this._transport.bind(res.bindable);
            })

            // Set our state to HANDSHAKING, and begin the Handshake process
            .then(function() {
                // We use a separate MessageExchange for the handshake request,
                // because we don't have per-request remoteReplyTimeouts.
                //
                // Once we get a successful handshake, we dispose of this
                // MessageExchange and bind a new one to our transport for
                // regular messaging.
                this._handshakeExchange = new MessageFramework({
                    strategy: this._transport,
                    responder: this,
                    messageExchangeOptions: {
                        remoteReplyTimeout: 7 * 1000 // 3 tries, 7 second timeout each
                    }
                }).getExchange();

                this.transitionTo("HANDSHAKING");

                this._handshake = new Handshake({
                    exchange: this._handshakeExchange
                });

                // The handshake requests happen out of band of this
                // callback chain. The end result is tied in via the
                // Handshake#promise();
                this._handshake.start();
                return this._handshake.promise();
            })

            .then(function() {
                // Once we get a proper handshake back, we can swap out the exchange
                // for one with a longer timeout
                this._handshakeExchange.dispose();
                this._handshake.dispose();

                // This one has a normal timeout of ~30s
                this._exchange = Promise.promisifyAll(new MessageFramework({
                    strategy: this._transport,
                    responder: this
                }).getExchange());

                this.transitionTo("RUNNING")
                return this._exchange;
            })
            .catch(function (err){
                this.transitionTo("ZOMBIE");
                if (this._handshakeExchange) this._handshakeExchange.dispose();
                if (this._handshake) this._handshake.dispose();
                this.didSigTerm();
                throw err;
            });
        },

        invoke: function(ctx, mType, msg, cb) {},

        /**
         *  exchange() Returns this RemoteProcess's MessageExchange
         *
         *  The MessageExchange will only be ready after the promise returned
         *  by RemoteProcess#init() has been fulfilled. As a shortcut, the exchange is
         *  set as RemoteProcess#init()'s fulfillment value.
         */
        exchange: function() {
            return this._exchange;
        },

        didSigTerm: Promise.method(function() {
            if (this._sandboxHandle) {
                return this._sandboxDelegate.destroyAsync(this._sandboxHandle)
            }
        })
    });

    return RemoteProcess;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/messaging/transport-strategy-factory"),
        require("bit/messaging/message-framework"),
        require("bit/os/internals/base-process"),
        require("bit/os/internals/handshake")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/messaging/transport-strategy-factory",
        "bit/messaging/message-framework",
        "bit/os/internals/base-process",
        "bit/os/internals/handshake"
    ], factory);
}

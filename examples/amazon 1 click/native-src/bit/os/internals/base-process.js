var factory = function(
    _,
    Promise,
    StateMachine
) {


    /**
     * BaseProcess
     *
     * Represents a running process in the virtual process manager. The purpose of
     * BaseProcess is to define a set of standard states and transitions shared
     * amongst all process types (remote, local).
     *
     */
    var BaseProcess = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(BaseProcess.prototype, StateMachine, {

        // For StateMachine
        SM: {
            States: [
                // BaseProcess object exists, but underlying sandbox has not yet been created.
                // This is the state immediately after creating a new BaseProcess, but before
                // calling BaseProcess#init
                "CREATED",

                // BaseProcess sandbox is being created
                "INITIALIZING",

                // BaseProcess sandbox is created, and the initial handshake between
                // the process objects and its sandbox is occurring
                "HANDSHAKING",

                // BaseProcess is in normal running state
                "RUNNING",

                // BaseProcess has been asked to terminate
                "TERMINATING",

                // BaseProcess has not acknowledged terminate signal after N seconds
                "ROGUE",

                // BaseProcess is not responding to healthcheck requests
                "INCOMM",

                // Sandbox responded to terminate signal and has been reaped,
                // but the BaseProcess object is still in the process table
                "ZOMBIE"
            ],
            Transitions: {
                "CREATED"      : ["INITIALIZING", "ZOMBIE"],
                "INITIALIZING" : ["HANDSHAKING", "ZOMBIE"],

                // A handshaking process either goes to normal state, or
                // in the event of a handshake error, the sandbox is immediately
                // torn down and the process is a zombie
                "HANDSHAKING"  : ["RUNNING", "ZOMBIE"],

                // A process goes into INCOMM if it stops responding to
                // healthcheck messages.
                "RUNNING"      : ["TERMINATING", "INCOMM"],

                // A "ROGUE" process is one which was told to terminate,
                // but did not respond with a confirmation in the appropriate
                // amount of time.
                //
                // A "ZOMBIE" is a process which terminated its sandbox
                // successfully, but the process is still in memory. This is
                // the last legal state a process can be in before being removed
                // from the process table.
                "TERMINATING"  : ["ROGUE", "ZOMBIE"],
                "ROGUE"        : ["ZOMBIE"],
                "INCOMM"       : ["TERMINATING", "RUNNING"]
            },
            InitialState: "CREATED"
        },

        /**
         * Do not confuse this object initializer with the
         * BaseProcess#init method, which instructs the
         * newly created process object to begin
         * construction of the underlying sandbox-hosted SPA
         */
        initialize: function() {
            // Init StateMachine
            this.smInit();
            _.bindAll(this, "_boundHealthCheckDelegate");
        },

        /**
         * Promisified version of StateMachine#transitionTo bound to this instance.
         */
        _transitionToAsync: Promise.method(function(state) {
            return this.transitionTo(state);
        }),

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
        init: Promise.method(function() {
            throw new Error("Must override BaseProcess#init");
        }),

        dispose: function() {
            throw new Error("Must override BaseProcess#dispose");
        },

        /**
         *  exchange() Should return this Process's Promisified MessageExchange
         *
         *  The MessageExchange will only be ready after the promise returned
         *  by BaseProcess#init() has been fulfilled. As a shortcut, the exchange is
         *  set as BaseProcess#init()'s fulfillment value.
         */
        exchange: function() {
            throw new Error("Must override BaseProcess#exchange")
        },


        healthCheckDelegate: function() {
            return this._boundHealthCheckDelegate;
        },

        /**
         * Returns completion Promise
         */
        signal: function(signal) {
            return this.exchange().sendAndReceiveAsync({
                mType: "UBPProcessSignal",
                signal: signal
            });
        },

        /**
         * Transitions this Process toward a terminated state (ZOMBIE),
         * signaling the underlying delegate along the way, and allowing
         * it cycles to wrap up work.
         */
        gracefulTeardown: function() {
            return this._transitionToAsync("TERMINATING")
                .bind(this)
                .then(function() {
                    return this.signal("WILL_TERM");
                })
                .then(function() {
                    // TODO: We have to catch timeout errors
                    // and transition to INCOMM as appropriate
                    return this.signal("TERM");
                })
                .then(function() {
                    return this.didSigTerm();
                })
                .then(function() {
                    return this._transitionToAsync("ZOMBIE");
                })
        },

        /**
         * After didSigTerm, any underlying sandbox/delegate should be disposed of and
         * removed from memory.
         *
         * The default implementation merely returns a resolved promise. Subclasses should
         * return a Promise chain that disposes of the underyling delegate.
         */
        didSigTerm: function() {
            return Promise.resolve();
        },

        // This is bound to "this" as instantiation time, so it's safe to
        // pluck it off the object properties and call it as a first-class function.
        // It'll be appropropriately bound to "this" instance.
        _boundHealthCheckDelegate: function(cb) {
            this.exchange().sendAndReceive({
                mType: "UBPProcessHealthCheck"
            }, function(err) {
                // Swallow any "response" message - we just care
                // that there was no error
                cb(err);
            });
        }
    });

    return BaseProcess;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/state-machine")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/state-machine"
    ], factory);
}


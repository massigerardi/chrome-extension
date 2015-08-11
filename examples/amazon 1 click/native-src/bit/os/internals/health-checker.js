var factory = function(
    _,
    Promise,
    $options,
    $taskManager,
    StateMachine
) {


    /**
     *  HealthChecker - calls the provided `checkDelegate' function every `healthCheckInterval' ms.
     *
     *  The purpose of HealthChecker is to periodically call a provided function
     *  and signal if it ever returns an error. There are no start/stop mechanics -
     *  from the moment a HealthChecker is instantiated to the moment it is
     *  disposed, it enters the call loop.
     *
     *  The HealthChecker is implemented using the StateMachine mixin.
     *
     *                       ---------------------------------------------> Disposed
     *                      /                      ^                            ^
     *                     /                      /                            /
     *  Created ------>  Chilling -----> HealthChecking -----> Error ---------/
     *                     ^                    /
     *                      \ _________________/
     *
     */
    var HealthChecker = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(HealthChecker.prototype, StateMachine, {
        SM: {
            States: [
                "Created",
                "Chilling",
                "HealthChecking",
                "Error",
                "Disposed"
            ],
            Transitions: {
                "Created"        : ["Chilling", "Disposed"],
                "Chilling"       : ["HealthChecking", "Disposed"],
                "HealthChecking" : ["Chilling", "Error", "Disposed"],
                "Error"          : ["Disposed"]
            },
            Callbacks: {
                After: {
                    "Chilling" : ["_scheduleCheck"],
                    "Error"    : ["_signalError"]
                }
            },
            InitialState: "Created"
        },

        initialize: function(opts) {
            opts = $options.fromObject(opts);
            _.bindAll(this, "_check");

            this._healthCheckInterval = opts.getOrError("healthCheckInterval");
            this._delegate            = Promise.promisify(opts.getOrError("checkDelegate"));
            this._disposed            = false;
            this._err                 = null;

            this.smInit();
            this.transitionTo("Chilling");
        },

        dispose: function() {
            if (this._disposed) {
                return;
            }

            this._disposed = true;
            this.transitionTo("Disposed");

            if (this._outstandingCheck) {
                this._outstandingCheck.cancel();
                this._outstandingCheck = null;
            }

            if (this._delegate) {
                this._delegate = null;
            }
        },

        _scheduleCheck: function() {
            if (this._disposed) {
                return;
            }
            $taskManager.scheduleTask(this._check, this._healthCheckInterval)
        },

        _check: function() {
            if (this._disposed) {
                return;
            }
            this.transitionTo("HealthChecking");
            // Note that we do not have a delegate timeout here. The
            // delegate is responsible for throwing its own timeout error.
            this._outstandingCheck = this._delegate()
            .bind(this)
            .cancellable()
            .then(function() {
                if (this._disposed) {
                    return;
                }
                this.transitionTo("Chilling");
            }).caught(function(err) {
                if (this._disposed) {
                    return;
                }
                this._err = err;
                this.transitionTo("Error");
            }).lastly(function() {
                this._outstandingCheck = null;
            });
        },
        _signalError: function() {
            this.notify("healthCheckError", this._err);
        }
    });

    return HealthChecker;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/task-manager"),
        require("bit/commons/state-machine")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/task-manager",
        "bit/commons/state-machine"
    ], factory);
}

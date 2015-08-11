var factory = function(
    _,
    $options,
    Events
) {

    /**
     * A "handle" by which one may message and refer to a process. A Pid acts as a
     * "pivot" between a process and the process manager that owns it, allowing
     * one to message the underlying process without having to have a handle to
     * the ProcessManager it's currently attached to.
     *
     * Events emitted:
     *      ("error", Error.[Reason])
     *      ("lifecycle", Lifecycle.[State])
     */
    var Pid = function() {
        this.initialize.apply(this, arguments);
    };

    var Error = {
        HealthCheck: "healthCheck"
    };

    var Lifecycle = {
        Terminated: "terminated"
    };

    _.extend(Pid.prototype, Events, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._id = opts.getOrError("processId");
            this._procMan = opts.getOrError("processManager");
        },

        /**
         * "package protected" - called by ProcessManager
         *
         * Swallows potential subscriber exceptions, since
         * this is a signal, and isn't suppose to stop
         * the caller's execution flow.
         */
        _signalHealthCheckError: function() {
            try {
                this.notify("error", Error.HealthCheck);
            } catch(e) {}
        },

        /**
         * "package protected" - called by ProcessManager
         *
         * Swallows potential subscriber exceptions, since
         * this is a signal, and isn't suppose to stop
         * the caller's execution flow.
         */
        _signalTerminated: function() {
            try {
                this.notify("lifecycle", Lifecycle.Terminated);
            } catch(e) {}
        },

        id: function() {
            return this._id;
        },

        exchange: function() {
            return this._procMan._exchangeForProcessId(this._id);
        },

        sendAndReceive: function(msg, cb) {
            return this._procMan.proxiedSendAndReceive(this._id, msg, cb);
        }
    });

    Pid.Error = Error;
    Pid.Lifecycle = Lifecycle;

    return Pid;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/commons/events")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/commons/events"
    ], factory);
}

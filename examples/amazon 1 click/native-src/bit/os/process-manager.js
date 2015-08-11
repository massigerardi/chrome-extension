var factory = function(
    _,
    Promise,
    $uuid,
    $options,
    Events,
    Pid,
    ProcessState,
    HealthChecker
) {

    var DEFAULTS = {
        PROCESS_HEALT_CHECK_INTERVAL: 10000,
        PROCESS_MESSAGE_TIMEOUT: 2000
    };


    /**
     * A ProcessManager owns zero or more processes. Processes are created by
     * calling `ProcessManager#spawn`, providing a suitable `Spawner` which
     * returns a subclass of `BaseProcess`. Processes spawned by a ProcessManager
     * become owned by that ProcessManager.
     *
     * Spawning a process results in a Pid object, which is associated
     * with a ProcessManager and an opaque process id. Someone with a reference
     * to a Pid can message the underlying LocalProcessDelegate/RemoteProcessDelegate
     * without having a reference to the Process surrounding it, or the ProcessManager.
     *
     * The ProcessManager is also responsible for maintaining periodic health checks
     * against processes it owns. Currently the behavior on health check error is TBD -
     * ProcessManager#_onHealthCheckError will be called with the process id of the failing
     * process.
     */
    var ProcessManager = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ProcessManager.prototype, Events, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);

            this._nextProcessNumber = 1;
            this._processes = {};
            this._id = "PM-" + $uuid.v4();

            this._processHealthCheckInterval =
                opts.getOrElse("processHealthCheckInterval", DEFAULTS.PROCESS_HEALT_CHECK_INTERVAL);

            // The time we wait for a process to acknowledge receipt of a message
            this._processMessageTimeout =
                opts.getOrElse("processMessageTimeout", DEFAULTS.PROCESS_MESSAGE_TIMEOUT);

            this._healthCheckRunners = {};
        },
        spawn: Promise.method(function(spawner, args) {
            Promise.promisifyAll(spawner);
            return spawner.spawnAsync(args)
            // "this" within this callback chain will be the following
            // context object
            .bind({
                pid: null,
                process: null,
                pm: this
            })
            .then(function(process) {
                // Returns Pid
                this.process = process;
                return this.pm.attach(process);
            })
            .then(function(pid) {
                this.pid = pid;
                return this.process.init();
            }).then(function() {
                return this.pid;
            })
            .catch(function (err) {
                //call shutdown on the process if we get an error 
                return Promise.bind(this)
                .then(function () {
                    if (this.pid && this.pid.id) {
                        return this.pm.executeShutdownProcess(this.pid.id());
                    }
                })
                .then(function () {
                    throw err;
                });
            });
        }),
        id: function() {
            return this._id;
        },
        attach: Promise.method(function(process) {
            var processId = this._nextProcessNumber++;
            var healthChecker = this._createHealthCheckerForProcess(process);

            // We save the bound listener as part of the ProcessState so we can
            // unbind it later.
            var listener = _.bind(this._onHealthCheckError, this, processId);
            healthChecker.on("healthCheckError", listener);

            var pid = new Pid({
                processManager: this,
                processId: processId
            });

            this._processes[processId] = new ProcessState(pid, process, healthChecker, listener);

            return pid;
        }),
        _onHealthCheckError: function(processId, err) {
            console.log("Health check error for process", processId);

            var procState = this._processes[processId];
            if (procState) {
                procState.pid()._signalHealthCheckError();
            }
        },
        _createHealthCheckerForProcess: function(process) {
            // Need a health check delegate
            return new HealthChecker({
                healthCheckInterval: this._processHealthCheckInterval,
                checkDelegate: process.healthCheckDelegate()
            });
        },
        start: function(cb) {
            return Promise.resolve().nodeify(cb);
        },
        stop: function(cb) {
            return this._executeShutdown().nodeify(cb);
        },
        //executeshutdown for one pid.
        executeShutdownProcess: function (processId) {
            var procState = this._processes[processId];
            if (!(procState && procState.process)) return Promise.resolve(null);
            var proc      = procState.process();
            return Promise.bind(this)
            .then(function () {
                return proc.gracefulTeardown();
            })
            .finally(function () {
                procState.healthChecker().dispose();
                procState.pid()._signalTerminated();
            });
        },
        _executeShutdown: function() {
            // Loop through processes
            // Send them through the shutdown cycle very quickly
            // Rip out the process sandboxes, dispose
            // Signal that we've stopped
            return Promise.all(_.map(this._processes, function(procState, processId) {
                var proc = procState.process();
                return proc.gracefulTeardown().then(function() {
                    procState.healthChecker().dispose();
                    return procState.pid()._signalTerminated();
                });
            }, this)).bind(this).then(function() {
                this.notify("didShutdown");
            });
        },
        proxiedSendAndReceive: function(processId, msg, cb) {
            var procState = this._processes[processId];
            if (!procState) {
                cb(new Error("No such process: " + processId));
                return;
            }
            // TODO: This should probably be wrapped
            // to distinguish IPC communication messages (those sent to the
            // underlying SPA/delegate for the purpose of app-level comms)
            // from IPC control messages (those sent to the process for
            // the purpose of signaling lower-level control or state enforcement)
            procState.process().exchange().sendAndReceive(msg, cb);
        },

        // Treat as package-protected
        _exchangeForProcessId: function(processId) {
            var procState = this._processes[processId];
            if (procState) {
                return procState.process().exchange();
            }
        }
    });



    return ProcessManager;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/uuid"),
        require("bit/commons/options"),
        require("bit/commons/events"),
        require("bit/os/internals/pid"),
        require("bit/os/internals/process-state"),
        require("bit/os/internals/health-checker")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/uuid",
        "bit/commons/options",
        "bit/commons/events",
        "bit/os/internals/pid",
        "bit/os/internals/process-state",
        "bit/os/internals/health-checker"
    ], factory);
}

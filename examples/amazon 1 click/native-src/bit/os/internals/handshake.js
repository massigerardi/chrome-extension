var factory = function(
    _,
    Promise,
    $options,
    $taskManager
) {
    /**
     *  Encapsulates sending a handshake request via a provided MessageExchange,
     *  retrying up to `opts.maxRetries' times in the event of timeout errors.
     *
     *  Note that if another (non-timeout) error occurs while tring to handshake,
     *  the Handshake promise will be immediately rejected without retry.
     */
    var Handshake = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Handshake.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);

            this._exchange = Promise.promisifyAll(opts.getOrError("exchange"));

            this._resolver = Promise.defer();

            _.bindAll(this, "_attemptHandshake");

            this._maxTries = opts.getOrElse("maxTries", 3);
            this._tries = 0;
            this._started = false;
        },

        dispose: function() {
            this._exchange = null;
        },

        /**
         * This promise is fulfilled at the end of the handshake workflow.
         * If resolved, we were able to handshake successfully. If rejected,
         * there was either an unrelated error during handshake, or we timed
         * out more than `maxTries' times.
         */
        promise: function() {
            return this._resolver.promise;
        },

        /**
         * Kicks off the workflow. This kicks off the flow asynchronously, so it's
         * safe to grab the promise from the Handshake immediately after calling
         * start, e.g.,
         *
         *   var someAsyncMethod = function() {
         *       var handshake = new Handshake({...init options...});
         *       handshake.start();
         *       return handshake.promise();
         *   }
         *
         */
        start: function() {
            if (this._started) {
                throw new Error("Cannot call Handshake#start() multiple times");
            }
            this._started = true;
            $taskManager.scheduleTask(this._attemptHandshake);
            return this.promise();
        },

        cancel: function() {
            if (this._pendingHandshake) {
                this._pendingHandshake.cancel();
            }
        },

        _attemptHandshake: function() {
            if (this._pendingHandshake) {
                return;
            }

            this._tries++;

            this._pendingHandshake = this._exchange.sendAndReceiveAsync({
                mType: "UBPProcessHandshake"
            }).bind(this).cancellable().then(function(){
                this._resolver.resolve();
            }).caught(function(err) {
                // The MessageExchange returns a "Request timeout exceeded" Error
                // object after its remoteReplyTimeout is exceeded.
                var isTimeout = function(err) {
                    return err && err.message && err.message.match(/timeout exceeded/);
                };

                var canTryAgain = function(tries, maxTries) {
                    return tries < maxTries;
                };

                // If we've received it fewer than _maxTries times,
                // we'll try again. Else, we reject the promise, signaling that we've timed out (or that
                // there was another, non-timeout related error)
                // Note that we ONLY retry if it was a timeout error.
                if (isTimeout(err) && canTryAgain(this._tries, this._maxTries)) {
                    this._pendingHandshake = null;
                    $taskManager.scheduleTask(this._attemptHandshake);
                } else {
                    this._resolver.reject(err);
                }
            }).lastly(function() {
                this._pendingHandshake = null;
            });
        }
    });

    return Handshake;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/task-manager")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/task-manager"
    ], factory);
}

var factory = function(
    _,
    Flow,
    Iterator
) {

    /**
     *  A Waterfall takes a series of Node-style asynchronous functions,
     *  such that the last parameter of a given function is an (err, results)
     *  callback, e.g.:
     *
     *      var seedFoo = function(callback) {
     *          setTimeout(function() {
     *              callback(null, "someFoo");
     *          }, 1);
     *      };
     *
     *      var stepOne = function(someFoo, callback) {
     *          if (someExceptionalCondition()) {
     *              // Because we should *always* be asynchronous when we say we are
     *              setTimeout(function(){
     *                  callback(new Error("Oh no!"));
     *              }, 1);
     *          } else {
     *              // Because we should *always* be asynchronous when we say we are
     *              setTimeout(function(){
     *                  callback(null, synchronousTransformToBar(someFoo));
     *              }, 1);
     *          }
     *      };
     *
     *      var stepTwo = function(someBar, callback) {
     *          if (someOtherExceptionalCondition()) {
     *              // Because we should *always* be asynchronous when we say we are
     *              setTimeout(function() {
     *                  callback(new Error("Oh no!"));
     *              }, 1);
     *          } else {
     *              // Because we should *always* be asynchronous when we say we are
     *              setTimeout(function() {
     *                  callback(null, synchronousTransformToFinalResult(someBar));
     *              }, 1);
     *          }
     *      };
     *
     *      var waterfall = new Waterfall([
     *          seedFoo,
     *          stepOne,
     *          stepTwo
     *      ], function(err, finalResult) {
     *          // If err, "finalResult" will be undef
     *          // If no err, "finalResult" should have the results of
     *          // the entire chain
     *      });
     *
     *      waterfall.run();
     *
     *  In the above example, non-error results passed to the callback in stepOne are passed as parameters
     *  to stepTwo. If someExceptionalCondition() or someOtherExceptionalCondition() return true,
     *  execution of remaining steps stops, and the completion callback is called. Else, execution continues
     *  until all steps have been called, and the final results are passed to the completion callback.
     *
     *  Note that if an exception is thrown from a waterfall step, execution halts. It's up to the step implementer
     *  to wrap his/her code in try/catch as appropriate. (Feature request?)
     */

    var Waterfall = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Waterfall.prototype, {
        initialize: function(funs, completionCallback) {
            this._funs = new Iterator(funs);
            this._completionCallback = completionCallback;
            this._didRun = false;
            this._didFinish = false;
            this._stopRequested = false;
            _.bindAll(this, "_nextKickResults", "_kickNext");
        },
        run: function() {
            if (this._stopRequested) {
                throw new Error("Can't call run after stop");
            }

            if (this._didRun) {
                throw new Error("Can't run a waterfall twice");
            }

            if (!this._funs.hasNext()) {
                Flow.getInstance().nextTick(this._nextKickResults);
            } else {
                Flow.getInstance().nextTick(this._kickNext);
            }
            this._didRun = true;
        },
        // Stops the waterfall silently
        stop: function() {
            this._stopRequested = true;
        },
        // Halts the workflow and calls the completion callback
        // with the provided error (or a halt error if not provided)
        cancel: function(err) {
            err = err || new Error("Waterfall cancelled");
            if (this._didFinish || this._stopRequested) {
                return;
            }
            this.stop();
            this._completionCallback(err);
            this.dispose();
            this._didFinish = true;
        },
        _nextKickResults: function() {
            if (this._didFinish) {
                return;
            }

            if (this._stopRequested) {
                this.dispose();
                return;
            }

            var args = _.toArray(arguments);
            if (args[0]) {
                // called back with error
                Flow.getInstance().nextTick(_.bind(function(){
                    this._completionCallback(args[0]);
                    this.dispose();
                }, this));
                this._didFinish = true;
            } else if (!this._funs.hasNext()) {
                // didn't call back with error, but no
                // more funs left

                Flow.getInstance().nextTick(_.bind(function(){
                    this._completionCallback.apply(null, args);
                    this.dispose();
                }, this));
                this._didFinish = true;
            } else {
                // no error, and funs left. cascade.

                args = args.slice(1);
                Flow.getInstance().nextTick(_.bind(function(){
                    this._kickNext(args);
                }, this));
            }
        },

        _kickNext: function(args) {
            if (this._stopRequested) {
                return;
            }

            args = args || [];
            var nextFun = this._funs.next();
            args.push(this._nextKickResults);
            nextFun.apply(null, args);
        },
        dispose: function() {
            this._disposed = true;
            this._completionCallback = null;
            this._funs = null;
        }
    });

    return Waterfall;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/flow"),
        require("bit/commons/iterator")
    );
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/flow", "bit/commons/iterator"], factory);
}

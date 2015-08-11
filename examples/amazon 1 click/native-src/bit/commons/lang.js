var factory = function(
    _,
    SimpleFuture
) {
    var Lang = function() {};

    Lang.prototype = {

        /**
         * A no-op (no-operation) function. Useful when defining default
         * callbacks, so we can apply with confidence without having to
         * allocate a new empty function every time:
         *
         *   var asyncFunc = function(cb) {
         *       cb = cb || $lang.noop;
         *       setTimeout(function() {
         *           cb(null, "woo!");
         *       }, 1);
         *   };
         *
         */
        noop: function() {},

        /**
         * This one is easier to show than describe:
         *
         *   var adder = function(a, b) {
         *       return a + b;
         *   };
         *
         *   adder(1, 1); // => 2
         *
         *   // Returns a function in which the `a` in `adder` is bound to 5
         *   var addsFive = $lang.partiallyApply(adder, 5);
         *
         *   addsFive(1); // => 6
         *
         *   var addsFiveAndFive = $lang.partiallyApply(adder, 5, 5);
         *
         *   addsFiveAndFive(); // => 10;
         *
         * The function `fun` is partially applied to the early-provided `args`,
         * with the final application occuring when the returned function is called.
         * This is useful when you want to pass around a function with early-bound "state"
         * that a caller needn't know about.
         *
         * Read more about partial function application: http://en.wikipedia.org/wiki/Partial_application
         */
        partiallyApply: function(/* fun, args... */) {
            var args = _.toArray(arguments);
            var fun = args.shift();
            return function() {
                var additionalArgs = _.toArray(arguments);
                return fun.apply(null, args.concat(additionalArgs));
            }
        },
        /**
         * Returns a new `ScopedRequire` instance, used for param validation
         * when you don't necessarily need/want the semantics that `bit/commons/options`
         * provides, and just want to verify the presence of values in an object.
         *
         *   var f = function(opts) {
         *       // Throws an error if opts.one, opts.two, or opts.three are
         *       // undefined or null (false is okay).
         *       $lang
         *           .params(opts)
         *           .req("one")
         *           .req("two")
         *           .req("three");
         *   };
         *
         *   f({
         *       one: 1,
         *       two: 2,
         *       three:false
         *   }); // => okay
         *
         *   f({
         *       one: 1,
         *       three: 3
         *   }); // => throws
         *
         *   f({
         *       one:1,
         *       two:null,
         *       three:3
         *   }); // => throws
         *
         */
        params: function(obj) {
            var scopedRequire = new ScopedRequire(obj);
            return scopedRequire;
        },

        /**
         * Returns a function `a` which calls the provided `cb` with `what`
         * as the success value, unless `a` was called with error.
         * This is useful when you have an early bound success condition, with
         * a late-bound asynchronous failure predicate. Example:
         *
         *   // Asynchronous function
         *   var getValueUnlessExpired = function(cb) {
         *       // Read value from synchronous store (early-bound)
         *       var successValue = store.read();
         *
         *       // But we only want to return it if some other asynchronous
         *       // call doesn't return in error.
         *       doSomethingOrError($lang.returns(successValue, cb));
         *   };
         *
         *   // If doSomethingOrError calls back with an error, that error will
         *   // be passed to the original `cb`. If there is no error, the `successValue`
         *   // will be passed to the original `cb`.
         *
         *   doSomethingWithError(function(err, result) {
         *      // err = either error or null
         *      // result = either undefined or store.read();
         *   });
         *
         */
        returns: function(what, cb) {
            return function(err) {
                if (err) {
                    cb(err);
                    return;
                }
                cb(null, what);
            }
        },

        /**
         * This check has side effects.
         * Given cb, potentialErr, calls cb(potentialErr) and returns
         * true iff potentialErr is truthy.
         *
         * Usage is within a callback, to propagate errors and kill further
         * execution of async functions:
         *
         *   function(cb) {
         *     this.someAsyncMethod(val, function(err, result) {
         *        if ($lang.cbOnErr(cb, err)) {
         *            return;
         *        }
         *        // Else do something interesting...
         *     });
         *   }
         *
         * Since cbOnErr isn't asynchronous - that is, it doesn't explicitly schedule
         * the execution of the CB - it is assumed that cbOnErr is checking the results
         * of an already asynchronous callback, i.e., that we're already in a scheduled
         * callback
         */
        cbOnErr: function(cb, potentialErr) {
            cb = cb || this.noop;
            if(potentialErr) {
                cb(potentialErr);
                return true;
            }
            return false;
        },

        /**
         * Helper method for throwing an exception. Useful when you want to
         * throw an error as an expression, which is normally not possible
         * as throwing is a statement. Example:
         *
         *   var val = someOptionsHash.value || $lang.doThrow("value attribute is required");
         *
         */
        doThrow: function(err) {
            throw err;
        },

        /**
         * Eh. Don't use this. It's not really a "future" so much as a value container, as
         * there is no API for being notified when the underlying value becomes available.
         * Use Bluebird promises instead.
         */
        future: function(val) {
            return new SimpleFuture(val);
        },
        /**
         *
         * Given $lang.pojoKlass(["attr1", "attr2"]), returns equivalent of:
         *
         * var MyKlass = function() {
         *  this.initialize.apply(this, arguments);
         * };
         *
         * MyKlass.prototype = {
         *  initialize: function(attr1, attr2) {
         *      this._attr1 = attr1;
         *      this._attr2 = attr2;
         *  },
         *  attr1: function() {
         *      return this._attr1;
         *  },
         *  attr2: function() {
         *      return this._attr2;
         *  }
         * }
         */
        pojoKlass: function(attributes, opts) {
            attributes = attributes || [];
            opts = opts || {};
            var klass = function() {
                this.initialize.apply(this, arguments);
            };

            var klassInitializer = function() {
                var args = _.toArray(arguments);
                _.each(attributes, _.bind(function(v, k) {
                    var attr = "_" + v;
                    this[attr] = args[k];
                }, this));
            };

            klass.prototype.initialize = klassInitializer;

            _.each(attributes, function(attr) {
                var internalName = "_" + attr;
                var getter = function() {
                    return this[internalName];
                };
                klass.prototype[attr] = getter;
            });

            if (opts.setters) {
                _.each(attributes, function(attr) {
                    var internalName = "_" + attr;
                    var setterName = "set" + attr.charAt(0).toUpperCase() + attr.substr(1);
                    var setter = function(v) {
                        this[internalName] = v;
                    };
                    klass.prototype[setterName] = setter;
                });
            }



            return klass;
        }
    };

    var ScopedRequire = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ScopedRequire.prototype, {
        initialize: function(target) {
            if (!target) {
                throw new Error("Invalid target provided for scoped require");
            }
            this._target = target;
        },
        req: function(attr, message) {
            if (!attr) {
                throw new Error("Invalid attribute provided");
            }
            message = message || "Attribute required but missing: `"+attr+"'";

            if (typeof this._target[attr] == "undefined" || this._target[attr] === null) {
                throw new Error(message);
            }
            return this;
        }
    });

    return new Lang();
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/simple-future")
    );
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/simple-future"], factory);
}

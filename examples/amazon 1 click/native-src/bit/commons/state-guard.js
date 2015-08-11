var factory = function(
    _,
    Promise
) {


    /**
     * Utility device for enforcing state invariance.
     *
     * Example usage:
     *
     *
     *   var MyKlass = function() {
     *       this.initialize.apply(this, arguments);
     *   };
     *
     *   _.extend(MyKlass.prototype, {
     *       initialize: function() {
     *           this._guard = new StateGuard("foo", "disposed");
     *           this._someState = { foo: 1, bar: 2 };
     *       },
     *       // Disposes this object's state. If "disposed" state was
     *       // already applied to this object, returns early
     *       dispose: function() {
     *           if (this._guard.applied("disposed")) {
     *               return;
     *           }
     *           this._someState = null;
     *           this._guard.apply("dispose");
     *       },
     *       // Throws an exception if called after dispose();
     *       // Applies the "foo" state to the guard
     *       foo: function() {
     *           this._guard.deny("disposed").apply("foo");
     *           return this._someState.foo;
     *       },
     *       // Throws an exception if called after dispose();
     *       // Throws an exception unless foo has been called before calling bar
     *       bar: function() {
     *           this._guard.deny("disposed").require("foo");
     *           return this._someState.bar;
     *       }
     *   });
     *
     *   var one = new MyKlass();
     *   one.foo(); // returns 1
     *   one.bar(); // returns 2
     *   one.dispose();
     *   try {
     *       one.foo(); // throws error
     *   } catch(e){}
     *
     *   try {
     *       one.bar(); // throws error
     *   } catch(e) {}
     *
     *   var two = new MyKlass();
     *   try {
     *       two.bar(); // throws error (foo() not called first)
     *   } catch(e) {}
     *
     *   two.foo(); //
     *   two.bar(); // ok
     *
     */
    var StateGuard = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(StateGuard.prototype, {
        initialize: function() {
            this._validStates = _.reduce(coerceToArray(arguments), function(memo, item) {
                memo[item] = true;
                return memo;
            }, {});

            this._applied = {};
            _.bindAll(this, "_isApplied");
        },

        /**
         * Raises an exception if any of the provided `states` have not
         * been previously applied to this `StateGuard`.
         */
        require: function(/* states...*/) {
            var states = coerceToArray(arguments);
            verifyValidStatesOrThrow(this._validStates, states);
            if (!_.every(states, this._isApplied)) {
                throw new Error("States required but not present: " + prettify(states));
            }
            return this;
        },

        /**
         * Alias for require, since Firefox packager aggresively tries to resolve
         * require(string) to a module
         */
        required: function() {
            return this.require.apply(this, arguments);
        },

        requireAsync: Promise.method(function() {
            return this.require.apply(this, arguments);
        }),

        /**
         * Raises an exception if any of the provided `states` has been
         * previously applied to this `StateGuard`. Opposite of `require`.
         */
        deny: function(/* states...*/) {
            var states = coerceToArray(arguments);
            verifyValidStatesOrThrow(this._validStates, states);
            if (_.some(states, this._isApplied)) {
                throw new Error("States denied but present: " + prettify(states));
            }
            return this;
        },

        denyAsync: Promise.method(function() {
            return this.deny.apply(this, arguments);
        }),

        /**
         * Applies `states` to this `StateGuard`.
         */
        apply: function(/* states...*/) {
            var states = coerceToArray(arguments);
            verifyValidStatesOrThrow(this._validStates, states);
            _.each(states, function(state) {
                this._applied[state] = true;
            }, this);
            return this;
        },

        applyAsync: Promise.method(function() {
            return this.apply.apply(this, arguments);
        }),

        /**
         * Unapplies `states` to this `StateGuard`.
         */
        unapply: function(/* states...*/) {
            var states = coerceToArray(arguments);
            verifyValidStatesOrThrow(this._validStates, states);
            _.each(states, function(state) {
                this._applied[state] = false;
            }, this);
            return this;
        },

        unapplyAsync: Promise.method(function() {
            return this.unapply.apply(this, arguments);
        }),

        applied: function(/* states...*/) {
            var states = coerceToArray(arguments);
            verifyValidStatesOrThrow(this._validStates, states);
            return _.every(states, this._isApplied);
        },

        appliedAsync: Promise.method(function() {
            return this.applied.apply(this, arguments);
        }),

        _isApplied: function(state) {
            return typeof this._applied[state] !== "undefined" && this._applied[state];
        }
    });

    /**
     * Ensures that if args is of type Array[Arguments] or simply Arguments,
     * the resulting value is simply Array[]. Example:
     *
     *   console.log(coerceToArray(1, 2, 3)) => [1, 2, 3];
     *   console.log(coerceToArray([1, 2, 3])) => [1, 2, 3];
     *
     * This is useful when providing functions which can be either variadic
     * or accept a singl array of values.
     *
     */
    var coerceToArray = function(args) {
        return _.flatten(_.toArray(args));
    };

    /**
     * Helper to ensure that the states provided are all valid states.
     * Valid states are provided during StateGuard construction.
     */
    var verifyValidStatesOrThrow = function(validStatesHash, states) {
        var diff = _.difference(states, _.keys(validStatesHash));
        if (diff.length > 0) {
            throw new Error("Invalid states provided: " + prettify(diff));
        }
    };

    /**
     * Helper for pretty-printing an array.
     */
    var prettify = function(states) {
        return states.join(",");
    };

    return StateGuard;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird"
    ], factory);
}

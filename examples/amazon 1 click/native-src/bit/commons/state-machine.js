var factory = function(
    _,
    Events,
    $options,
    $taskManager
) {

    var SM_ATTR_NAMESPACE = "_sm_";


    /**
     * StateMachine - a mixin for turning an object into a state machine
     *
     * A StateMachine target mixes in StateMachine, and defines states, transitions,
     * and callbacks on the `SM' property somewhere in the prototype chain (or on
     * the instance itself).
     *
     * In the instance constructor, call this.smInit() to set the initial state.
     *
     * Example usage:
     *
     *     var MyMachine = function() {
     *         this.intialize.apply(this, arguments);
     *     }
     *
     *     _.extend(MyMachine.prototype, StateMachine, {
     *         SM: {
     *             States: [
     *                 "Zero",
     *                 "One",
     *                 "Two",
     *                 "Three"
     *             ],
     *             Transitions: {
     *                 "Zero": ["One"],
     *                 "One": ["Two"],
     *                 "Two": ["Three"],
     *                 "Three": ["One"]
     *             },
     *             Callbacks: {
     *                 After: {
     *                     "One": ["_moveToTwo"],
     *                     "Two": ["_moveToThree"],
     *                     "Three": ["_moveToOne"]
     *                 }
     *             },
     *             InitialState: "Zero"
     *         },
     *         initialize: function() {
     *             this.smInit();
     *             this.transitionTo("One");
     *         },
     *
     *         _moveToTwo: function() {
     *             this._moveTo("Two", 500);
     *         },
     *
     *         _moveToThree: function() {
     *             this._moveTo("Three", 500);
     *         },
     *
     *         _moveToOne: function() {
     *             this._moveTo("One", 500);
     *         },
     *
     *         _moveTo: function(state, timeout) {
     *             var self = this;
     *             setTimeout(function() {
     *                 this.transitionTo(state)
     *             }, timeout);
     *         }
     *     });
     *
     *     var machine = new MyMachine();
     *
     *     // This callback would be called every 500 ms, and
     *     // we would see the transitions from:
     *     //   (One -> Two),
     *     //   (Two -> Three),
     *     //   (Three -> One)
     *     //    ... and so on.
     *     machine.on("stateTransition", function(transition) {
     *         console.log("Moved from ", transition.from, " to ", transition.to);
     *     });
     *
     * SM.States is required. It is a list of valid states.
     *
     * SM.Transitions defines valid transitions between states.
     *
     * SM.Callbacks is optional. Given
     * SM.Callbacks.After[state] = [methodName1, methodName2]
     *
     * this[methodName1] and this[methodName2] will be called as functions
     * after a transition to `state'. The entire set of calls will happen
     * after the transitionTo method has returned (in a subsequent 'tick'), but
     * will be called in order, synchronously. That is, if this[methodName1]() throws
     * an error, this[methodName2]() will not be called, but throwing an error in either
     * one will not cause `transitionTo' to throw.
     *
     * SM.Callbacks.Before is not defined, but is reserved for future use.
     */
    var StateMachine = _.extend({}, Events, {
        // This should be overridden by the object mixing in
        // StateMachine. It should include the valid states and transitions
        SM: {
            States: [],
            Transitions: {},
            Callbacks: {
                After: {
                    // e.g.,
                    // "someState" : ["someMethod"]
                }
            },
            InitialState: null
        },

        /**
         * smInit() should be called by the mixin target's initializer.
         * This sets up the target instance's initial internal state data
         */
        smInit: function(initialState) {
            initialState = initialState || this.SM.InitialState;
            this._smSetState(initialState);
        },

        transitionTo: function(state) {
            this._smSetState(state);

            if (this.SM.Callbacks &&
                this.SM.Callbacks.After &&
                this.SM.Callbacks.After[state]) {
                var methodNames = this.SM.Callbacks.After[state];

                // We'll defer throwing any potential callback error until we're
                // in the next dispatch, so we don't break the current call chain
                $taskManager.scheduleTask(_.bind(function(){
                    _.each(methodNames, function(methodName) {
                        if (this[methodName]) {
                            this[methodName](state);
                        } else {
                            throw new Error("Invalid callback method " + methodName +
                                            " registered in StateMachine for state: " + state);
                        }
                    }, this)
                }, this));
            }

            return true;
        },

        inState: function(state) {
            this._smCheckState(state);
            return this._smGet("current") === state;
        },

        // Utility methods to help with getting/setting internal fields
        _smSet: function(friendlyAttr, value) {
            this[SM_ATTR_NAMESPACE + friendlyAttr] = value;
        },

        _smGet: function(friendlyAttr) {
            return this[SM_ATTR_NAMESPACE + friendlyAttr];
        },

        _smIsValidState: function(state) {
            return state && _.contains(this.SM.States, state);
        },

        _smCheckState: function(state) {
            if (!this._smIsValidState(state)) {
                throw new Error("Invalid state: " + state);
            }
        },

        // Internal state set field - validates that given state is within
        // valid states, and is coming from a valid state
        _smSetState: function(state) {
            this._smCheckState(state); // throws

            var current = this._smGet("current");
            if (!current) {
                // Let it fly without doing transition check, since there is
                // no "previous" for the first state
                this._smSet("current", state);
            } else {
                // Check that it's a valid transition
                var transitions = this.SM.Transitions[current];
                if (!transitions || !_.contains(transitions, state)) {
                    throw new Error("Invalid state transition - no transition defined from `"+ current +"' to `"+ state +"'");
                }

                this._smSet("current", state);
            }

            this.notify("stateTransition", {
                from: current,
                to: state
            });
        }
    });

    return StateMachine;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/events"),
        require("bit/commons/options"),
        require("bit/commons/task-manager")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/events",
        "bit/commons/options",
        "bit/commons/task-manager"
    ], factory);
}

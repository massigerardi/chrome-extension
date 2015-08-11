var factory = function(
	_,
	Flow
) {
	"use strict";
	var StateLatch = function() {
		this.initialize.apply(this, arguments);
	};

	_.extend(StateLatch.prototype, {
		initialize: function(states, completionCallback) {
			this._states = _.reduce(states, function(memo, state) {
				memo[state] = false;
				return memo;
			}, {});
			this._validStates = states;
			this._completionCallback = completionCallback;
			this._complete = false;
			this._error = false;
		},
		callbackTrigger: function(state) {
			return _.bind(function(err){

				if (this._disposed) {
					return;
				}

				if (this._complete) {
					return;
				}

				if (err) {
					this._error = err;
					this._triggerCompletion();
					return;
				}

				this._triggerState(state);

			}, this);
		},

		// Used to manually trigger error
		error: function(err) {
			if (this._disposed) {
				return;
			}

			if (this._complete) {
				return;
			}

			this._error = err;
			this._triggerCompletion();
		},

		// Used to manually trigger state
		trigger: function(state) {
			this._triggerState(state);
		},

		_triggerCompletion: function() {
			if (this._disposed) {
				return;
			}

			if (this._complete) {
				return;
			}

			this._complete = true;

			Flow.getInstance().nextTick(_.bind(function() {
				this._completionCallback(this._error);
				this.dispose();
			}, this))
		},

		_triggerState: function(state) {
			if (this._complete) {
				return;
			}

			if (this._disposed) {
				return;
			}

			if (this._validStates.indexOf(state) === -1) {
				this._error = new Error("No valid state: " + state);
				this._triggerCompletion();
				return;
			}

			this._states[state] = true;

			if (_.every(this._states, function(v,k) { return v })) {
				this._triggerCompletion();
			}
		},
		dispose: function() {
			this._disposed = true;
			this._error = null;
			this._completionCallback = null;
			this._validStates = null;
			this._states = null;
		}
	});

	return StateLatch;
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = factory(
		require("underscore"),
		require("bit/commons/flow")
    );
} else if (typeof define !== "undefined") {
	define(["underscore", "bit/commons/flow"], factory);
}


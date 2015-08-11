var factory = function(
	_,
	Flow,
	$lang
) {

	var ReadyGate = function() {
		this.initialize.apply(this, arguments);
	};

	_.extend(ReadyGate.prototype, {
		initialize: function() {
			this._inFlight = false;
			this._isComplete = false;
			this._cachedErr = null;
			this._cachedResp = null;

			this._queuedCallers = [];
			_.bindAll(this, "_dispatch");
		},
		onReady: function(fun) {
			this._queuedCallers.push(fun);
			if (this._isComplete) {
				var callers = this._queuedCallers.slice(0);
				this._queuedCallers = [];
				Flow.getInstance().nextTick($lang.partiallyApply(this._dispatch, callers));
			}
		},
		gated: function(fun) {
			if (this._inFlight) {
				return;
			} else if (this._isComplete) {
				// Ignore the fun
				// Should dispatch answer to queued callers next tick
				var callers = this._queuedCallers.slice(0);
				this._queuedCallers = [];
				Flow.getInstance().nextTick($lang.partiallyApply(this._dispatch, callers));
				return;
			} else {
				// Should execute this block
				fun();
				this._inFlight = true;
				return;
			}
		},
		handler: function() {
			var self = this;

			if (this._inFlight) {
				throw new Error("Handler should have only been called once, while not in flight");
			}

			return function(err, resp) {
				self._isComplete = true;
				self._inFlight = false;
				self._cachedErr = err;
				self._cachedResp = resp;
				var callers = self._queuedCallers.slice(0);
				self._queuedCallers = [];
				Flow.getInstance().nextTick($lang.partiallyApply(self._dispatch, callers));
			}
		},
		_dispatch: function(callers) {
			_.each(callers, _.bind(function(caller) {
				try {
					caller(this._cachedErr, this._cachedResp);
				} catch (e) {
					throw new Error("Error in dispatch loop: " + e);
				}
			}, this));
		}

	});

	return ReadyGate;
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = factory(
		require("underscore"),
		require("bit/ext/core/util/flow"),
		require("bit/ext/core/util/lang")
    );
} else if (typeof define !== "undefined") {
	define(["underscore", "bit/ext/core/util/flow", "bit/ext/core/util/lang"], factory);
}



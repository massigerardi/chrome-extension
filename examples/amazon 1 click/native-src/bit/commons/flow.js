var factory = function(
	_,
	$lang
) {
	var Flow = function() {};

	_.extend(Flow.prototype, {

		nextTick: function(cb) {
			cb = cb || $lang.noop;
			// XXX: In some contexts, we have a real
			// process.nextTick. If that's the case, use it. For now,
			// just fake it.
			if (typeof setTimeout !== "undefined") {
				setTimeout(cb, 1);
			} else {
				if (typeof module !== "undefined" &&
					module.exports && typeof require !== "undefined") {
					// Try the Moz way
					var t = require("sdk/timers");
					if (t) {
						t.setTimeout(cb, 1);
					} else {
						throw new Error("Don't know who to delegate task to!");
					}
				} else {
					throw new Error("Don't know who to delegate task to!");
				}
			}
		}

	});

	var flow = new Flow();
	Flow.getInstance = function() {
		return flow;
	}

	return Flow;
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = factory(
		require("underscore"),
		require("bit/commons/lang")
    );
} else if (typeof define !== "undefined") {
	define(["underscore", "bit/commons/lang"], factory);
}

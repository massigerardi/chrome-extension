var factory = function(
	_,
	SimpleFuture
) {
	var Lang = function() {};

	Lang.prototype = {
		noop: function() {},
		partiallyApply: function() {
			var args = _.toArray(arguments);
			var fun = args.shift();
			return function() {
				var additionalArgs = _.toArray(arguments);
				return fun.apply(null, args.concat(additionalArgs));
			}
		},
		params: function(obj) {
			var scopedRequire = new ScopedRequire(obj);
			return scopedRequire;
		},
		returns: function(what, cb) {
			return function(err) {
				if (err) {
					cb(err);
					return;
				}
				cb(null, what);
			}
		},
		future: function(val) {
			return new SimpleFuture(val);
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
		require("bit/ext/core/util/simple-future")
    );
} else if (typeof define !== "undefined") {
	define(["underscore", "bit/ext/core/util/simple-future"], factory);
}

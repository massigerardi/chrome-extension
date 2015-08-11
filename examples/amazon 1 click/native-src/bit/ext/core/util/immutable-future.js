var factory = function(
	_,
	SimpleFuture
) {

	var ImmutableFuture = function() {
		this.initialize.apply(this, arguments);
	};

	_.extend(ImmutableFuture.prototype, SimpleFuture.prototype, {
		initialize: function() {
			SimpleFuture.prototype.initialize.apply(this, arguments);
		},
		set: function(val) {
			if (this._isSet) {
				throw new Error("Cannot set a future twice");
			}
			this._set(val);
		}
	});

	return ImmutableFuture;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
    	require("underscore"),
    	require("bit/ext/core/util/simple-future")
    );
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/ext/core/util/simple-future"], factory);
}

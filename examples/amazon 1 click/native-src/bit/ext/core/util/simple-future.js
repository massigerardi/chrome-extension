var factory = function(
	_
) {

	var SimpleFuture = function() {
		this.initialize.apply(this, arguments);
	};

	_.extend(SimpleFuture.prototype, {
		initialize: function(val) {
			this._isSet = false;
			this._val = null;

			if (typeof val !== "undefined") {
				this._set(val);
			}
		},
		get: function() {
			if (!this._isSet) {
				throw new Error("Requested future before underlying value was set.");
			}
			return this._val;
		},
		getOrElse: function(defaultValue) {
			if (!this._isSet) {
				return defaultValue;
			}

			return this._val;
		},
		set: function(val) {
			this._set(val);
		},
		isSet: function() {
			return this._isSet;
		},
		_set: function(val) {
			this._isSet = true;
			this._val = val;
		}
	});

	return SimpleFuture;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
    	require("underscore")
    );
} else if (typeof define !== "undefined") {
    define(["underscore"], factory);
}

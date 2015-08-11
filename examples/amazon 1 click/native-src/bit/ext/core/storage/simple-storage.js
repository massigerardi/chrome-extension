/*
    SimpleStorage presents a consistent asynchronous proxy
    for each of our various native storage implementations, which
    are passed in as delegates.

    Each platform implements its own NativeStorage conforming
    to the following interface: 

    get(key, cb)
        cb has signature:
            cb(result)
    set(key-val object, cb)
        cb has signature:
            cb()
    clear()

    @exports SimpleStorage class

*/

var factory = function(
	_,
	Promise,
	Event
	) {

	var SimpleStorage = function() {
		this.initialize.apply(this, arguments);
	};

	_.extend(SimpleStorage.prototype, Event, {
		initialize: function(nativeStorage) {
			this._nativeStorage = nativeStorage;
		},
		get: function(k, cb) {
			k = this._getKey(k);

			this._nativeStorage.get(k, function(data) {
				if (cb) cb(null, data[k]);
			});
		},

		set: function(k, v, cb) {
			if (!k) {
				if (cb) cb();
				return ;
			}
            var shouldNotifyOnChange = false;
			if (this._validKeyObj(k)) {
				var namespace = k.namespace,
					key = k.key;
                shouldNotifyOnChange = true;
			}

			k = this._getKey(k);

			var m = {};
			m[k] = v;

			Promise.bind(this)
			.then(function () {
				//Get the current value stored for this key.
				return this.getAsync(k);
			})
			.then(function (value) {
				//If the value is equal v (what we were gonna set that key to), just return.
				//isEqual performs a deep object comparison...see underscorejs.org for more info
				//regarding implementation.
				if (_.isEqual(value,v)) return /* valueIsDifferent = */false;//tells next link in the promise chain that the value hasn't changed.

				return new Promise(_.bind(function (fulfill,reject) {
					this._nativeStorage.set(m, function() {
						fulfill(/* valueIsDifferent = */true);//tells the next link in the chain that the value has changed
					});
				},this));
			})
			.then(function (valueIsDifferent){
                if (shouldNotifyOnChange && valueIsDifferent) this.notify("OnChange", namespace, key);
				if (cb) cb();
                //notify only after setting the value
			});
		},

		bindOnChange: function(cb) {
			this.on("OnChange",cb);
		},

		clear: function() {
			this._nativeStorage.clear();
		},

		_getKey: function(key) {
			var returnKey = undefined;
			switch(typeof key) {
				case "object":
					if (this._validKeyObj(key)) {
						returnKey = key.namespace + "." + key.key;
					}
					break;
				case "string":
					returnKey = key;
					break;
				default:
					break;
			}
			return returnKey;
		},

		_validKeyObj: function(keyObj) {
            return keyObj.namespace && keyObj.key 
                && typeof keyObj.namespace === "string"
                && typeof keyObj.key === "string";
        },
	});

    Promise.promisifyAll(SimpleStorage.prototype);
	return SimpleStorage;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/events")

    );
} else if (typeof define !== "undefined") {
    define([
    	"underscore",
    	"bluebird",
    	"bit/commons/events"
    ], factory);
}



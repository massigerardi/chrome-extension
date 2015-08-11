/**
 * @returns Events mixin
 */
var factory = function(
	_
) {

	var Events = {
		on: function(eventName, callback, context){
			var bucket = this._evtGetBucket(eventName);
			if (bucket.subscriptionExists(callback, context)) {
				throw new Error("Error creating event subscription. Looks like it already exists - preventing double-subscription.");
			}
			bucket.subscribe(callback, context);
		},
		off: function(eventName, callback, context) {
			if (arguments.length === 0) {
				// Remove all subs
				this._evtRemoveSubs();
			} else if (arguments.length === 1) {
				// Remove all subs for a bucket
				var bucket = this._evtGetBucket(eventName);
				bucket.unsubscribeAll();
			} else {
				var bucket = this._evtGetBucket(eventName);
				bucket.unsubscribe(callback, context);
			}
		},
		notify: function() {
			var args = _.toArray(arguments);
			var eventName = args.shift();
			if (eventName) {
				var bucket = this._evtGetBucket(eventName);
				bucket.notify(args);
			}
		},
		_evtGetBucket: function(eventName) {
			this._evtBuckets = this._evtBuckets || {};
			this._evtBuckets[eventName] = this._evtBuckets[eventName] || new EventBucket(eventName);

			return this._evtBuckets[eventName];
		},
		_evtRemoveSubs: function() {
			_.invoke(this._evtBuckets, "unsubscribeAll");
		}
	};

	var EventBucket = function() {
		this.initialize.apply(this, arguments);
	};

	_.extend(EventBucket.prototype, {
		initialize: function(eventName) {
			this._eventName = eventName;
			this._subscriptions = [];
		},
		subscriptionExists: function(callback, context) {
			// $log.error(this._eventName, callback, context);
			return !!(_.find(this._subscriptions, function(sub) {
				return sub.matches(this._eventName, callback, context);
			}));
		},
		subscribe: function(callback, context) {
			this._subscriptions.push(new Subscription(this._eventName, callback, context));
		},
		unsubscribeAll: function() {
			_.invoke(this._subscriptions, "dispose");
			this._subscriptions = [];
		},
		unsubscribe: function(callback, context) {
			// We only allow one sub per (callback, context) tuple, so it's safe
			// to find the first and remove it.
			var idx = 0;
			var match = _.find(this._subscriptions, _.bind(function(sub) {
				if (sub.matches(this._eventName, callback, context)) {
					return true;
				} else {
					idx++;
				}
			}, this));

			if (match) {
				// Remove dead dude
				this._subscriptions.splice(idx, 1);
				match.dispose();
			}
		},
		notify: function(argsAry) {
			_.invoke(this._subscriptions, "notify", argsAry);
		}
	});

	var Subscription = function() {
		this.initialize.apply(this, arguments);
	};

	_.extend(Subscription.prototype, {
		initialize: function(eventName, callback, context) {
			this._eventName = eventName;
			this._callback = callback;
			this._context = context;
		},
		matches: function(eventName, callback, context) {
			return (this._eventName === eventName &&
					this._callback === callback &&
					this._context === context);
		},
		notify: function(args) {
			this._callback.apply(this._context, args);
		},
		dispose: function() {
			if (this._disposed) {
				return;
			}

			this._disposed = true;
			this._eventName = null;
			this._callback = null;
			this._context = null;
		}
	});

	return Events;
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = factory(
		require("underscore")

    );
} else if (typeof define !== "undefined") {
	define(["underscore"], factory);
}



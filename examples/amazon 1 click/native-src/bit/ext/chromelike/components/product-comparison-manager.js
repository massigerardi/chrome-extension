define([
	"underscore",
	"bit/ext/chromelike/storage/native-storage",
	"bit/ext/core/storage/simple-storage",
	"bit/ext/chromelike/util/log",
	"bit/commons/lang"
], function(
	_,
	$nativeStorage,
	SimpleStorage,
	$log,
	$lang
) {

	$simpleStorage = new SimpleStorage($nativeStorage);

	var ProductComparisonManager = function() {
		this.initialize.apply(this, arguments);
	};

	_.extend(ProductComparisonManager.prototype, {
		initialize: function() {
			this._started = false;
                        this._showNotificationsStatus = {
                            sia: false,
                            searchassist: false
                        };
		},

		_enable: function(notificationsStatus) {
                        $log.debug("Enabling product comparison");
                        var self = this;
                        _.each(notificationsStatus, function(e) { self._showNotificationsStatus[e] = true; });
		},

                _enableAll: function() {
                        $log.debug("Enable sia and searchassist");
                        this._showNotificationsStatus.sia = true;
                        this._showNotificationsStatus.searchassist = true;
                },

		isReady: function() {
			return this._started;
		},

		isEnabled: function() {
                       return this._showNotificationsStatus.sia || this._showNotificationsStatus.searchassist;
		},

		_disable: function() {
			$log.debug("Disabling product comparison for the user");
                        this._showNotificationsStatus.sia = false;
                        this._showNotificationsStatus.searchassist = false;
		},

                getDisabledFeature: function() {
                        if(this._showNotificationsStatus.sia && this._showNotificationsStatus.searchassist) {
                            return null;
                        } else if(this._showNotificationsStatus.sia || this._showNotificationsStatus.searchassist){
                            return (this._showNotificationsStatus.sia ? "searchassist" : "sia");
                        }
                        return null;
                },

                update: function(options) {
                    if(options.length) {
                        for(var type in this._showNotificationsStatus) {
                            if(this._showNotificationsStatus.hasOwnProperty(type)) {
                                if(_.find(options, function(e) { return e === type})) {
                                    this._showNotificationsStatus[type] = true;
                                } else {
                                    this._showNotificationsStatus[type] = false;
                                }
                            }
                        }
                    } else {
                        this._disable();
                    }
                },

		start: function(cb) {
			cb = cb || $lang.noop;

			$log.debug("Starting Product Comparison features Manager");

			$simpleStorage.get('options.alertList', _.bind(function(err, list) {
				if (err) {
					cb(err);
					return;
				}

				if (typeof list === "undefined") {
					$log.debug("Preferences hasn't been set. Enabling by default.");
					this._enableAll();
				} else {
					$log.debug("Preference list found. Checking for SIA or SearchAssist.");
					var pc = (_.filter(list.split(","), function(e) { return (e === "sia" || e === "searchassist") }))
                                        if(pc.length) {
                                            this._enable(pc);
                                        }
				}
				this._started = true;
				cb();
			}, this));
		},
//TODO: Once Helper is refactored into a separate component, move the callback inside chrome.tabs.onUpdated.addListener(..) from main.js to here
/*
		getInjectionScript: function(cb) {
			cb = cb || $lang.noop;

			$simpleStorage.get('options.ubp_root', function(err, root) {
				if (err) {
					cb(err);
					return;
				}

				if (!root) {
					cb(new Error("Couldn't generate script - no root set"));
					return;
				}

				var script = "(function() { var s = document.createElement('script'); s.src = \"" + root + "/gp/bit/apps/web/SIA/scraper?url=\" + document.location.href; document.body.appendChild(s);}());";
				cb(null, script);
			});
		}
*/
	});

	return ProductComparisonManager;
});

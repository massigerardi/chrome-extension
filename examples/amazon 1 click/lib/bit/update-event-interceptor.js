(function(ns) {
	// Since the onInstalled event is only triggered once immediately
	// after the initial page load, we need to make sure any
	// handlers for this event are registered during the
	// first pass of the DOM, where scripts are loaded
	// and evaluated synchronously.
	//
	// window.UpdateEventInterceptor will hang on to
	// the state associated with this event,
	// and is made programmatically available within the requirejs
	// runtime by requiring the corresponding requirejs shim in
	// components/update-event-interceptor.js
	var UpdateEventInterceptorK = function() {
                this._wasInstalled = false;
		this._updated = false;
		this._showUpgradePrompt = false;
		this._wasTriggered = false;
		var self = this;
		var unboundOnInstalled = this.onInstalled;
		this.onInstalled = function() {
			unboundOnInstalled.apply(self, arguments);
		}
	};

	UpdateEventInterceptorK.prototype = {
		onInstalled: function(details) {
			this._wasTriggered = true;
                        var tagbase = localStorage.getItem('com.amazon.bit.chrome.oemId');
                        if(details.reason === 'install') {
                            if(tagbase) {
                                chrome.storage.local.set({'isOemInstall': true});
                                chrome.storage.local.set({'options.acceptedTermsOfUse': false});
                            }
                            this._wasInstalled = true;
                        } else if(details.reason === 'update' || details.reason === 'chrome_update') {
                            var majorVersion = parseInt(details.previousVersion);
                            if (majorVersion && majorVersion < 3) {
                                chrome.storage.local.set({'hadNonOBExtension' : true});
                                this._showUpgradePrompt = true;
                            }
                            this._updated = true;
                        }
                        if(tagbase) {
                            // only set tagbase if there was any found in local
                            // storage, else default tagbase in main.js read
                            // from attribution-config.js would be used.
                            chrome.storage.local.set({'tagbase':tagbase});
                        }
		},
		wasTriggered: function() {
			return this._wasTriggered;
		},
		wasUpdated: function() {
			return this._updated;
		},
		shouldShowUpgradePrompt: function() {
			return this._showUpgradePrompt;
		},
        wasInstalled: function() {
            return this._wasInstalled;
        }
	}

	ns.UpdateEventInterceptor = new UpdateEventInterceptorK();

}(window));

chrome.runtime.onInstalled.addListener(window.UpdateEventInterceptor.onInstalled);

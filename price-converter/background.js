/* Structure
data {
	currency : STRING,
	rates	:  OBJECT
	}

}
*/

// WE COULD HAVE SEND THE TAB.ID FROM THE CONTENT SCRIPT
// INSTEAD OF USING TAB RELATED LISTENERS. BUT HEY
// IT WORKS:)

CCC = {
	debug			: false,

	tabs			: {},
	mode			: 'page',
	tabID			: null,							// Current tabID
	cacheTS			: (1000 * 60) * 3600 * 8,		// Cache interval
	data			: localStorage['data'] ? JSON.parse(localStorage['data']) : {'currency' : 'BTC'},

	initialize		: function() {
		// Handle browserAction click
		if(this.mode === 'browser') {
			chrome.browserAction.onClicked.addListener(function(tab) {
				CCC.tabID = tab.id;
				CCC.convert();
			});
		}



		// Handle onRequest(s)
		// Used to convert again using new currency setting from options.
		chrome.extension.onRequest.addListener(function(req, sender, sendResponse) {
			CCC.tabID = sender.tab.id;
			if(req.miniConvert) {
				//console.log('CONVERTING BG');
				CCC.miniConvert(req.miniConvert);
				return false;
			};


			// Domains check (disabled)
			if(req.href) {

				if(CCC.data.disUsedomains === true && CCC.data.disDomains) {
					var disDomains 	= CCC.data.disDomains.split(/\n/);
					var disSkip		= false;

					disDomains.forEach(function(item, index) {
						if(item && req.href.indexOf(item) !== -1) {
							skip = true;
							return;
						}
					});

					// Oopsy
					if(skip === true) {
						// Bailing out.
						return false;
					}
				}
			}


			// Domains check (enabled)
			if(req.href) {
				if(CCC.data.usedomains == true && CCC.data.domains) {
					var domains = CCC.data.domains.split(/\n/);
					var skip	= true;
					domains.forEach(function(item, index) {
						if(item && req.href.indexOf(item) !== -1) {
							skip = false;
							return;
						}
					});

					if(skip) {
						return false;
					} else {
						CCC.convert();
					}
				} else {
					CCC.convert();
				}
			}

			if(req['update'])	{
				CCC.convert(true);
			}

			// Display pageAction if applicable
			if(req['changes'] && CCC.mode === 'page' && (CCC.data.icon || CCC.data.icon == undefined)) {
				CCC.tabs[CCC.tabID] = true;
				chrome.pageAction.show(CCC.tabID);
				chrome.pageAction.setTitle({'tabId' : CCC.tabID, 'title' : 'CCC: ' + req.changes + ' conversions'});
			}
		});

		// Handle tab.changed
		chrome.tabs.onSelectionChanged.addListener(function(tabId, info) {
  			CCC.tabID = tabId;
		});

		// Handle tab.(re)loade
		chrome.tabs.onUpdated.addListener(function(tabId, change, tab) {

			// CHANGED: 24.12.2009
			// Fixed a serious glitch
			if (change.status == 'complete')  {
				if(!CCC.tabID) {
				//	CCC.tabID = tabId;
				}
				//CCC.convert();
			}
		});

		// Fix a bug when switching windows
		chrome.windows.onFocusChanged.addListener(function() {
			// Get current tab

			chrome.tabs.getSelected(null, function(tab) {
				CCC.tabID = tab.id;
			});
		});

		// Get current tab
		chrome.tabs.getSelected(null, function(tab) {
			console.log('tab changed');
			//CCC.tabID = tab.id;
		});


		/// Handle pageAction click
		if(this.mode === 'page') {
			chrome.pageAction.onClicked.addListener(function(tab) {
				// Send request to content script

				// CHANGED: 12.1.2010
				// ouf :)
				//console.log('edw')
				CCC.tabID = tab.id;

				//alert( chrome.extension.getURL('icons/' + ( CCC.mode ? '19.png' : '19-off.png') ) ) ;
				CCC.tabs[CCC.tabID] = !CCC.tabs[CCC.tabID];
				chrome.tabs.sendRequest(CCC.tabID, { 'toggle' : CCC.tabs[CCC.tabID] }, function(response) {
									// response handler
				});




		  			chrome.pageAction.setIcon({
					'tabId' : 	CCC.tabID,
					'path' : 	chrome.extension.getURL('/icons/' + ( CCC.tabs[CCC.tabID] ? '19.png' : '19-off.png'))
			});
				//CCC.tabID = tab.id;
				//CCC.convert();
			});
		}



		return this.getRates();
	},

	toggle			: function() {
		if(this.isDisabled) {

		} else {

		}

	},

	// Set badge text to current currency;
	// Applicable only when this.mode === 'browser'
	setBadge		: function() {
		if(this.mode === 'browser') {
			chrome.browserAction.setBadgeText({'text' : this.data.currency});
		}
		return this;
	},

	convert			 : function(forceGetRates) {
		if(!localStorage['data']) {
			return this.getRates();
		}
		// Check on localStorage again
		this.data 	= JSON.parse(localStorage['data']);
		this.setBadge();

		if(forceGetRates) {
			this.getRates(true);
		}

		// Send request to content script
		if(this.data.rates && this.tabID) {
			chrome.tabs.sendRequest(this.tabID, {'action': 'CCC.convert', 'data' : this.data}, function(response) {
				// response handler
			});
	  	}

	  	return this;
  	},

  	miniConvert	 : function(data) {
  		var amount = data.amount;
  		var currency = data.currency;
		if(this.data.currency === 'BTC') {
            // Fetch Mt Gox
            xhr = new XMLHttpRequest();
            xhr.open('GET', 'http://btcrate.com/convert?from='+currency+'&to=btc&exch=mtgox&conv=xe&amount='+amount, true);
            xhr.send();

            xhr.onreadystatechange = function() {
                if (xhr.readyState == 4) {
                    console.log(xhr.responseText);
                    chrome.tabs.sendRequest(CCC.tabID, { 'miniConverted' : xhr.responseText }, function(response) {
                        // response handler
                    });
                    //      alert(xhr.responseText);
                }
            };
	   	} else {
		    // Fetch
		    xhr = new XMLHttpRequest();
		    xhr.open('GET', 'http://chrome.' + ( this.debug ? 'dev.' : '') + 'pathfinder.gr/Stocks/convert.php?amount='+amount+'&to='+this.data.currency + '&from=' + currency, true);
		    xhr.send();

            console.log('CONVERTING')
            console.log(amount, currency);

            xhr.onreadystatechange = function() {
		        if (xhr.readyState == 4) {
			        chrome.tabs.sendRequest(CCC.tabID, { 'miniConverted' : xhr.responseText }, function(response) {
					    // response handler
				    });
    				//alert(xhr.responseText);
			    }
		    };
        }

  	},

  	// OBSOLETE for now
  	reloadPage	: function() {
  		chrome.tabs.sendRequest(CCC.tabID, {'reload' : true}, function(response) {

  		});
  		return this;
  	},

	getRates		: function(force) {
		if(force) {
			this.data.updated 	= null;
			this.data.rates		 = null;
		}
		var rates 	= this.data.rates;
		var updated = this.data.updated;

		force = true;
		// Force for new currencies
		if(!this.data.rates || this.data.rates.AED == undefined || this.data.rates.ISL == undefined ||  this.data.rates.SAR == undefined || this.rates.JPY === undefined || this.rates.KWD === undefined ||  this.rates.SAR < 1) {
			force = true;
		}


		// Use cached rates if applicable
		if(!force && this.data && localStorage['data']) {
			if(!this.debug && rates && updated && (new Date().getTime() - updated <  this.cacheTS)) {
				return this.convert();
			}
		}

		// console.log('http://chrome.' + ( this.debug ? 'dev.' : '') + 'pathfinder.gr/Stocks/ccc.php?json=1&currency=' + this.data.currency);

		if(this.data.currency === 'BTC') {
            // Fetch Mt Gox
            xhr = new XMLHttpRequest();
            xhr.open('POST', 'http://api.bitcoincharts.com/v1/weighted_prices.json', true);
            xhr.send();
            xhr.onreadystatechange = function() {
                var xj = JSON.parse(xhr.responseText);
                var eur = xj["EUR"];
                var usd = xj["USD"];
                var jpy = xj["JPY"];
                var gbp = xj["GBP"];
				var rates = {
				    "EUR": eur["24h"],
				    "GBP": gbp["24h"],
				    "JPY": jpy["24h"],
				    "USD": usd["24h"]
				};
				
                if (xhr.readyState == 4) {
				    if(rates) {
				    	CCC.data.rates 			= rates;
				    	CCC.data.updated 		= new Date().getTime();
				    	localStorage['data'] 	= JSON.stringify(CCC.data); // Store again
				    	CCC.convert();
				    } else {
				    	if(CCC.data.rates) {
				    		CCC.convert();
				    	}
				    }
                }
            };
        } else {
		    // Fetch
		    xhr = new XMLHttpRequest();
		    xhr.open('GET', 'http://chrome.' + ( this.debug ? 'dev.' : '') + 'pathfinder.gr/Stocks/ccc.php?json=1&currency=' + this.data.currency, true);
		    xhr.send();
		    xhr.onreadystatechange = function() {
				var rates					= JSON.parse(xhr.responseText);
			    if (xhr.readyState == 4) {
				    if(rates) {
				    	CCC.data.rates 			= rates;
				    	CCC.data.updated 		= new Date().getTime();
				    	localStorage['data'] 	= JSON.stringify(CCC.data); // Store again
				    	CCC.convert();
				    } else {
				    	if(CCC.data.rates) {
				    		CCC.convert();
				    	}
				    }
			    }
		    };
        };
	}
}

// Rock n' Roll
CCC.initialize();


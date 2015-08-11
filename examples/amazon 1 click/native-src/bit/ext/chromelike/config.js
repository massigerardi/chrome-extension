define([], function() {
	var Config = function() {};

	Config.prototype = {
		isDebug: function() {
			return false;
		},
		getDefaultRoot: function() {
			// Change this to pre-prod for testing as necessary
			return "https://www.amazon.com";
		},
		getCampaignSatelliteEndpoint: function() {
			// return your desktop, or amazon.COM (only .COM)
			// Must be SSL.
			return this.getDefaultRoot() + "/gp/ubp/oneButton/RATT/serviceSatellite";
		}
	};

	return new Config();
});

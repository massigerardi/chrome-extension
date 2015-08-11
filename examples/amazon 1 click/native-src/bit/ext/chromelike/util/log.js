define(["bit/ext/chromelike/config"], function(
	config
) {
	var Logger = function() {};

	Logger.prototype = {
		_log: function() {
			switch(arguments.length) {
				case 0:
					console.log();
					break;
				case 1:
					console.log(arguments[0]);
					break;
				case 2:
					console.log(arguments[0], arguments[1]);
					break;
				case 3:
					console.log(arguments[0], arguments[1], arguments[2]);
					break;
				default:
					console.log(arguments);
					break;
			}
		},

		debug: function() {
			if (config.isDebug()) {
				this._log.apply(this, arguments);
			}
		},

		// TODO: Make log-level aware. For now, assume errors should be shown.
		error: function() {
			this._log.apply(this, arguments);
		}
	};

	// Legacy
	Logger.prototype.log = Logger.prototype.debug;

	return new Logger();
});

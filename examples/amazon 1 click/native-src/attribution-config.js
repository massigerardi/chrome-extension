define([], function() {
	var AttributionConfig = function() {};

	AttributionConfig.prototype = {
		
            getAttributionPlatfom: function() {
                    //Chrome:CR,Opera:OP,360:TS 
                    return "CR";
            },
            getTagbase: function() {
                    return "abba-chrome";
            }
                // Add extension specific function here 
	};

	return new AttributionConfig();
});

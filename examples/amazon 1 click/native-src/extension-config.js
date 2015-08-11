/* Responsibility
* ==================
* ExtensionConfig is responsible for handling non backward compatible feature
* How it works :
*  Add non backward compatible feature in config
*  config :{
*  modes:"smile,prime",
*  deals:"LD"
*....
* }
* above config key value pair will appear on panel' urls (gateway, settings..) as url params
* eg: https://www.amazon.com/gp/ubppf/gateway?........&modes=smile,prime&deals=LD
*
* */

var factory = function(QueryStringMap) {
    var ExtensionConfig = function() {};

    ExtensionConfig.prototype = {
        config:{
            supportedModes:"smile"
        },
        getSupportedParams: function(){
            var queryStringMap = new QueryStringMap({
                queryParams:this.config
            });
            var queryString = queryStringMap.toQueryString({ withSearchDelimiter: false });
            return "&" + queryString;
        }

    };

    return new ExtensionConfig();
};

if ( typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("bit/commons/query-string-map"));
} else if ( typeof define !== "undefined") {
    define(["bit/commons/query-string-map"], factory);
}

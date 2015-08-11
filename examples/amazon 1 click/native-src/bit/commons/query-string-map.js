var factory = function(_, $options) {
    

    /**
     * QueryStringMap
     * ==============
     *
     *
     * Responsibility
     * --------------
     * QueryStringMap is responsible for parsing and caching a map query parameters.
     *
     * NOTE: Does not support nested objects, only supports one level of key/value pairs
     * 
     *
     * Initialize:
     * -----------
     * It can be created in three ways:
     * 
     * 1) Sets itself up when provided with a 'queryString' string: 
     *     
     *     var queryStringMap = new QueryStringMap({
     *         queryString: "?foo=bar&minion=Fred"
     *     });
     *
     *   The '?' search delimiter at the beginning of the 'queryString' is optional.
     *
     * 2) Sets itself up when provided with a 'queryParams' hash of key/value pairs: 
     * 
     *     var queryStringMap = new QueryStringMap({
     *         queryParams: {
     *             foo: "bar",
     *             minion: "Fred"
     *         }
     *     });
     *
     * 3) When no arguments are passed in during initialization, an empty QueryStringMap is created
     *
     *     var queryStringMap = new QueryStringMap();
     *
     * NOTES:
     *     1) If duplicate keys are passed in, QueryStringMap will use the last value that was provided
     *     e.g.
     *
     *     var queryStringMap = new QueryStringMap({
     *         queryString: "?foo=bar&minion=Fred&foo=coffee&foo=batman"
     *     });
     *     => {
     *         foo: "batman",
     *         minion: "Fred"
     *     }
     *
     *
     * Methods:
     * --------
     * QueryStringMap has 5 public facing methods:
     *
     * 1) get:
     * 
     * Once QueryStringMap is initialized, we can use QueryStringMap.get() to retrieve the value
     * of a named parameter, as follows:
     *
     *      queryStringMap.get("foo");
     *
     * The above expression returns "bar".
     *
     * 
     * 2) getOrElse:
     *
     * Once QueryStringMap is initialized, we can use QueryStringMap.getOrElse() to retrieve the value
     * of a named parameter, however, this method accepts a second argument that is the default value 
     * returned if the specified key is not found in this QueryStringMap.
     *
     *      queryStringMap.getOrElse("headphones", "batman");
     *
     * The above expression returns "batman".
     *
     * 3) set:
     * 
     * Once QueryStringMap is initialized, we can use QueryStringMap.set() to add a value to the 
     * QueryStringMap.
     *
     *      queryStringMap.set("headphones", "batman");
     *
     * 4) toMap:
     *
     * QueryStringMap.toMap() returns a 
     *
     *      var queryStringMap = new QueryStringMap({
     *          queryString: "?foo=bar&minion=Fred"
     *      });
     *
     *      queryStringMap.toMap();
     *      => {
     *          foo: "bar",
     *          minion: "Fred"
     *      }
     *
     * 5) toQueryString:
     *
     * QueryStringMap.toQueryString() returns a serialzed string of the query parameters map. By
     * default the option 'withSearchDelimiter' is set to true.
     *
     *      var queryStringMap = new QueryStringMap({
     *          queryParams: {
     *              foo: "bar",
     *              minion: "Fred"
     *          }
     *      });
     *
     *      queryStringMap.toQueryString();
     *      => "?foo=bar&minion=Fred"
     * 
     *      queryStringMap.toQueryString({ withSearchDelimiter: false });
     *      => "foo=bar&minion=Fred"
     * 
     */    
    var QueryStringMap = function() {
        this.initialize.apply(this, arguments);
    };
    
    _.extend(QueryStringMap.prototype, {
        initialize : function(opts) {
            opts = $options.fromObject(opts);

            var queryString = opts.getOrElse('queryString', null);
            var queryParams = opts.getOrElse('queryParams', null);

            if(!queryString && !queryParams) {
                this._map = {};

            } else if( queryString ) {
                if(queryString.indexOf("?") === 0) {
                    queryString = queryString.substr(1);
                }

                this._map = {};

                var pairs = queryString.split("&");
                for ( pairIndex in pairs ) {
                    var pair = pairs[pairIndex].split("=");
                    var paramKey = decodeURIComponent(pair[0]);

                    if( paramKey.length > 0 ) {
                        this._map[paramKey] = "";
                        if( pair.length === 2  ) {
                            var paramValue = pair[1];
                            this._map[paramKey] = decodeURIComponent(paramValue);
                        }
                    }
                }

            } else if( queryParams ) {
                this._map = queryParams;

            } else {
                throw new Error("Could not initialize QueryStringMap");
            }
        },

        get: function (name) {
            return this._map[name];
        },

        getOrElse: function (name, defaultValue) {
            return this._map[name] || defaultValue;
        },

        set: function( key, value ) {
            this._map[key] = value;
        },

        toQueryString: function(opts) {
            opts = $options.fromObject(opts);

            var withSearchDelimiter = opts.getOrElse('withSearchDelimiter', true);

            var queryString = serialize(this._map);
            if( withSearchDelimiter ) {
                queryString = '?' + queryString;
            }

            return queryString;
        },

        toMap: function() {
            return this._map;
        }
    });

    // No array support
    var serialize = function(obj) {
        var params = [];

        for( objKey in obj ) {
            var paramKey = objKey;
            var paramValue = obj[objKey];

            params.push(encodeURIComponent(paramKey) + "=" + encodeURIComponent(paramValue));
        }

        return params.join("&");
    };

    // Implement someday if we need it
    // var deserialize = function(queryString) {};


    return QueryStringMap;
};

if ( typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/commons/options"));
} else if ( typeof define !== "undefined") {
    define(["underscore", "bit/commons/options"], factory);
}
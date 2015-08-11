define([
    "underscore",
    "bit/commons/options",
    "bit/commons/query-string-map"
], function(
    _,
    $options,
    QueryStringMap
) {
    var ProductCompassFrame = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ProductCompassFrame.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);

            var endpoint = opts.getOrError('endpoint');
            var locale = opts.getOrElse('locale', 'Us');
            
            var params = opts.getOrElse('params', {});
            var queryStringMap = new QueryStringMap({
                queryParams: params
            });
            queryStringMap.set('locale', locale);

            var source = endpoint + queryStringMap.toQueryString();

            this._iframe = document.createElement('iframe');
            this._iframe.style.display = 'none';
            this._iframe.src = source;
        },

        getFrame: function() {
            return this._iframe;
        },

        getPort: function() {
            return this._iframe.contentWindow;
        }
    });

    return ProductCompassFrame;
});

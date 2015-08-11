var factory = function(_, $lang, $options, Flow) {
    var LazyMap = function() {
        this.initialize.apply(this, arguments);
    };
    _.extend(LazyMap.prototype, {
        initialize : function(opts) {
            opts = $options.fromObject(opts);
            this._populateFn = opts.getOrError("populateFn");
            this._map = null;
        },
        get : function(key) {
            if (this._map === null) {
                this._map = this._populateFn() || {};
            }
            return this._map[key];
        },
        getAsync : function(key, cb) {
            cb = cb || $lang.noop;
            Flow.getInstance().nextTick(_.bind(function() {
                if (this._map === null) {
                    this._map = this._populateFn() || {};
                }
                cb(this._map[key]);
            }, this));
        }
    });
    return LazyMap;
};

if ( typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("underscore"), require("bit/commons/lang"), require("bit/commons/options"), require("bit/commons/flow"));
} else if ( typeof define !== "undefined") {
    define(["underscore", "bit/commons/lang", "bit/commons/options", "bit/commons/flow"], factory);
}

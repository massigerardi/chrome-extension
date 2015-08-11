var factory = function(
    _
) {
    var Options = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Options.prototype, {
        initialize: function(opts) {
            this._opts = opts;
        },
        getOrError: function(attr) {
            if (typeof this._opts[attr] === "undefined" || this._opts[attr] === null) {
                throw new Error("Option required but not found: " + attr);
            }
            return this._opts[attr];
        },
        getOrElse: function(attr, defaultVal) {
            if (typeof this._opts[attr] === "undefined" || this._opts[attr] === null) {
                return defaultVal;
            } else {
                return this._opts[attr];
            }
        }
    });

    Options.fromObject = function(obj) {
        return new Options(obj);
    }

    return Options;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore")
    );
} else if (typeof define !== "undefined") {
    define(["underscore"], factory);
}



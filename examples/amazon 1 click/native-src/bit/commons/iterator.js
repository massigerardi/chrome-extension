var factory = function() {

    var Iterator = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Iterator.prototype, {
        initialize: function(elements) {
            this._current = 0;
            this._elts = elements;
        },
        hasNext: function() {
            return (this._current < this._elts.length);
        },
        next: function() {
            if (this._current >= this._elts.length) {
                throw new Error("Called next past end of iterator");
            }
            return this._elts[this._current++];
        }
    });

    return Iterator;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore")
    );
} else if (typeof define !== "undefined") {
    define(["underscore"], factory);
}

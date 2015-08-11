/**
 * @exports WindowedStack class
 */
var factory = function() {
	var WindowedStack = function() {
        this.initialize.apply(this, arguments);
    };

    WindowedStack.prototype = {
        initialize: function(maxItems) {
            this._maxItems = maxItems;
            this._items = [];
        },

        push: function(item) {
            this._items.push(item);
            this._trimItems();
        },

        pop: function() {
            return this._items.pop();
        },

        _trimItems: function() {
            if (this._items.length > this._maxItems) {
                this._items = this._items.slice(this._items.length - this._maxItems);
            }
        },

        toArray: function() {
            return this._items.slice(0);
        }


    };

    return WindowedStack;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}

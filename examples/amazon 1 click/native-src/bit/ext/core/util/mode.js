var factory = function(
    _
) {

    /* Mode is interface used for handling 1BA branding. */
    var Mode = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Mode.prototype, {
        initialize: function(val) {
            this._isSet = false;
        },
        /**
        *  Dummy enable method, used when derived class doesn't override this method.
        */
        enable: function(options){
            return false;
        },
        /**
        *  Dummy disable method, used when derived class doesn't override this method.
        */
        disable: function(options){
            return true;
        }

    });

    return Mode;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore")
    );
} else if (typeof define !== "undefined") {
    define(["underscore"], factory);
}

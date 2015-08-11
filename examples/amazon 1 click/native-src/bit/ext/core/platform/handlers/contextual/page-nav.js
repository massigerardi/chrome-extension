var factory = function(
    _,
    $options
) {
    var PageNavHandler = function() {
        this.initialize.apply(this, arguments);
    }

    _.extend(PageNavHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            _.bindAll(this, "_notify");
            this._registrationCount = 0;
            this._platformMessageBus = opts.getOrError("platformMessageBus");
            this._platformMessageBus.subscribe(this._notify);
        },
        _notify: function(msg) {
            if (!this._registryCtx) {
                return;
            }

            if (msg.mType === "platformEvent" &&
                msg.eventName === "Contextual.PageTurn") {
                this._registryCtx.notify(msg.eventName, msg.args);
            }
        },
        wasRegistered: function(registryCtx, api) {
            this._registryCtx = registryCtx;
            this._registrationCount++;
        },
        wasDeregistered: function(registryCtx, api) {
            this._registrationCount--;
            if (this._registrationCount === 0) {
                this._registryCtx = null;
            }
        },
        handle: function(ctx, api, argsObj, cb) {

        }
    });

    return PageNavHandler;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options")
    );
} else if (typeof define !== "undefined") {
    define(["underscore", "bit/commons/options"], factory);
}



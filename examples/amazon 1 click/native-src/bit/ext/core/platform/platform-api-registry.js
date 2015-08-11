var factory = function(
    _,
    $options,
    $lang,
    Flow
) {
    var Registry = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Registry.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._clientNotifierFun = opts.getOrError("clientNotifier");
            this._ctx = {
                notify: this._clientNotifierFun
            };
            this._handlers = {};
        },

        register: function(api, delegate, cb) {
            if (this._handlers[api]) {
                Flow.getInstance().nextTick($lang.partiallyApply(cb, new Error("Attempting to double-register handler for API: " + api)));
                return;
            }
            this._handlers[api] = delegate;
            if (delegate.wasRegistered) {
                delegate.wasRegistered(this._ctx, api);
            }
            Flow.getInstance().nextTick(cb);
        },

        deregister: function(api, cb) {
            if (this._handlers[api]) {
                var delegate = this._handlers[api];
                this._handlers[api] = null;
                if (delegate.wasDeregistered) {
                    delegate.wasDeregistered(this._ctx, api);
                }
            }
            Flow.getInstance().nextTick(cb);
        },

        invoke: function(ctx, mType, msg, cb) {
            if (!mType === "callPlatformAPI") {
                // Nothing to do!
                return;
            }
            // TODO: Remove
            console.log(arguments);
            var api = msg.api, args = msg.args;
            if (this._handlers[api]) {
                this._handlers[api].handle(ctx, api, args, function(err, result) {
                    if ($lang.cbOnErr(cb, err)) {
                        return;
                    }

                    cb(null, {
                        mType: "callPlatformAPIResponse",
                        result: result
                    });
                });
            } else {
                Flow.getInstance().nextTick($lang.partiallyApply(cb, new Error("No handler for platform API")));
            }
        }
    });

    return Registry;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/commons/lang"),
        require("bit/commons/flow")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/commons/lang",
        "bit/commons/flow"
    ], factory);
}

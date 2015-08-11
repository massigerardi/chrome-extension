var factory = function(
    _,
    $options,
    FilteringDispatcher
) {
    var SimpleStorageHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(SimpleStorageHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._platformMessageBus = opts.getOrError("platformMessageBus");
            this._runtime = opts.getOrError("runtime");
            this._delegate = opts.getOrError("delegate");
            this._registryCount = 0;
            this._registryCtx =  null;
            this._dispatcher = new FilteringDispatcher({
                namespace: "Storage",
                delegate: this
            });
            
            _.bindAll(this, "_notify");

            this._platformMessageBus.subscribe(this._notify);
        },
        _notify: function(msg) {
            if (!this._registryCtx) {
                return;
            }
            if (msg.mType === "platformEvent" &&
                msg.eventName === "Storage.OnChange") {
                this._registryCtx.notify(msg.eventName, msg.args);
            }
        },
        wasRegistered: function(registryCtx) {
            this._registryCount++; //increment the registry count, (used in wasDeregistered)
            this._registryCtx = registryCtx; //assign the ctx.
        },

        wasDeregistered: function(registryCtx) { //<-- ask what this parameter is.
            this._registryCount--; //decrement the count
            if (this._registryCount === 0) this._registryCtx = null; //and assign registryctx to null if count == 0
        },
        handle: function(ctx, api, argsObj, cb) {
            this._dispatcher.dispatch(ctx, api, argsObj, cb);
        },
        onMsgGet: function(ctx, args, cb) {
            this._delegate.get(args,cb);
        },
        onMsgSet: function(ctx,args,cb) {
            this._delegate.set(args,args.value,cb);
        },
        onMsgGetAvailableMemory: function (ctx,args,cb) {
            this._runtime.getAvailableExtensionStorageSpace(cb);
        }
    });

    return SimpleStorageHandler;
};



if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/ext/core/platform/handlers/util/filtering-dispatcher")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/ext/core/platform/handlers/util/filtering-dispatcher"
    ], factory);
}



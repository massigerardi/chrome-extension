var factory = function(
    _,
    $options,
    MessageExchange,
    MessageDispatcher,
    CheramiService,
    PlatformAPIRegistry
) {
    var PlatformService = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(PlatformService.prototype, CheramiService.prototype, {
        initialize: function(opts) {
            CheramiService.prototype.initialize.apply(this, arguments);

            opts = $options.fromObject(opts);

            _.bindAll(this, "notifyClients");
            this._registry = new PlatformAPIRegistry({
                clientNotifier: this.notifyClients
            });

        },

        onMsgUnhandled: function(ctx, msg, cb) {
            // Forward unhandled messages to the registry, where other handlers
            // may have registered interest.
            return this._registry.invoke(ctx, msg.mType, msg, cb);
        },

        notifyClients: function(eventName, args) {
            this.broadcast({
                mType: "platformNotification",
                eventName: eventName,
                args: args
            });
        },

        registry: function() {
            return this._registry;
        }
    });

    return PlatformService;
};



if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options"),
        require("bit/messaging/message-exchange"),
        require("bit/messaging/message-dispatcher"),
        require("bit/cherami/cherami-service"),
        require("bit/ext/core/platform/platform-api-registry")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options",
        "bit/messaging/message-exchange",
        "bit/messaging/message-dispatcher",
        "bit/cherami/cherami-service",
        "bit/ext/core/platform/platform-api-registry"
    ], factory);
}

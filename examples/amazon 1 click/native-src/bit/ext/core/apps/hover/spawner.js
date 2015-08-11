var factory = function(
    _,
    Promise,
    $options,
    RemoteProcess
) {

    /**
     * Spawner for Hover
     */
    var HoverSpawner = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(HoverSpawner.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._sandboxDelegate = opts.getOrError("sandboxDelegate");
            this._transportStyle = opts.getOrError("transportStyle");
            this._transportStrategyOptions = _.extend({}, opts.getOrError("transportStrategyOptions"), {
                inboundFilter: function(msg) {
                    // Accept incoming messages from both
                    // the hover-remote-process-delegate (which responds to health checks)
                    // and the RemotePlatform:RemoteProcessDelegate (which is the RemotePlatform
                    // client for PlatformService).
                    return msg.origin === "RemotePlatform:RemoteProcessDelegate:Hover" || msg.origin === "hover-remote-process-delegate"
                }
            });
            this._identity = opts.getOrElse("identity", "hover-remote-process");
        },

        /**
         * Spawns the RemoteProcess pointing at the RemoteProcessDelegate SPA.
         *
         * @param args.url - URL of the RemoteProcessDelegate SPA.
         */
        spawn: function(args, cb) {
            opts = $options.fromObject(args);
            return Promise.bind(this)
            .then(function() {
                var processUrl = opts.getOrError("url");
                return new RemoteProcess({
                    url: processUrl,
                    identity: this._identity,
                    transportStyle: this._transportStyle,
                    transportStrategyOptions: this._transportStrategyOptions,
                    sandboxDelegate: this._sandboxDelegate
                });
            })
            .nodeify(cb);
        }
    });

    return HoverSpawner;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/os/internals/remote-process")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/os/internals/remote-process"
    ], factory);
}

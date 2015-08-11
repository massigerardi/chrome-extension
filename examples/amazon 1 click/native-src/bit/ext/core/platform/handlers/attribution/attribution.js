var factory = function(
    _,
    Promise,
    $options,
    $lang,
    FilteringDispatcher
) {

    var AttributionHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(AttributionHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            // No peer controller!
            this._attributionDelegate = opts.getOrError("attributionDelegate");
            this._modeDelegate = opts.getOrError("modeDelegate");
            this._dispatcher = new FilteringDispatcher({
                namespace: "Attribution",
                delegate: this
            });
        },
        handle: function(ctx, api, argsObj, cb) {
            this._dispatcher.dispatch(ctx, api, argsObj, cb);
        },
        // Returns only information necessary for remote endpoint to
        // determine attribution data. Does not include ref or tag values
        onMsgGetRemoteAttributionParameters: function(ctx, args, cb) {
            Promise.bind({
                attributionHandler: this
            }).then(function() {
                // Step 1: Get the attribution parameters.
                return this.attributionHandler._attributionDelegate
                    .getRemoteAttributionParametersAsync();
            }).then(function(params) {
                // Step 2: Set the initial set of params, get the Modes.
                this.params = params;
                return this.attributionHandler._modeDelegate.getModeStatusAsync({});
            }).then(function(modeStatus) {
                // Step 3: Set the modes in the params.
                var activeModes = [];
                _.map(modeStatus, function(status, mode) {
                    if (status === "true") {
                        activeModes.push(mode);
                    }
                });
                if (activeModes.length) {
                    this.params.modes = activeModes.join(",");
                }
                return this.params;
            }).nodeify(cb);
        }
    });

    return AttributionHandler;
};



if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/lang"),
        require("bit/ext/core/platform/handlers/util/filtering-dispatcher")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/lang",
        "bit/ext/core/platform/handlers/util/filtering-dispatcher"
    ], factory);
}
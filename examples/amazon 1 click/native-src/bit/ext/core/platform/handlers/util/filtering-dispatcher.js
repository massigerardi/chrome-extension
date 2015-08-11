var factory = function(
    _,
    $options
) {

    /**
     * FilteringDispatcher - useful for auto-dispatching method calls based on
     * the LLPAPI eventName. See sandbox.js for example usage.
     */
    var FilteringDispatcher = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(FilteringDispatcher.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._namespace = opts.getOrError("namespace");
            this._delegate = opts.getOrError("delegate");
        },

        // Given a message of the following format:
        // {
        //     mType: "platformEvent",
        //     eventName: "Contextual.CreateSandbox",
        //     args: {
        //         externalId: 123,
        //         sandboxSpecification: {}
        //     }
        // }
        // #dispatch will filter based on the prefix of the eventName
        // (Contextual === this._namespace), and if the postfix is defined
        // as a method (onMsgCreateSandbox), will call the defined
        // method with the .args and cb.
        dispatch: function(ctx, api, argsObj, cb) {
            var parts = api.split("."),
                namespace = parts[0],
                command = parts[1],
                handlerName = this._delegateHandlerFromCommand(command);

            if (namespace && namespace == this._namespace &&
                handlerName && typeof this._delegate[handlerName] == "function") {
                this._delegate[handlerName](ctx, argsObj, cb);
            }
        },
        _delegateHandlerFromCommand: function(command) {
            if (!command) {
                return;
            }
            var handlerPrefix = "onMsg";
            return handlerPrefix + command.charAt(0).toUpperCase() + command.substr(1)
        }
    });

    return FilteringDispatcher;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/options")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/options"
    ], factory);
}


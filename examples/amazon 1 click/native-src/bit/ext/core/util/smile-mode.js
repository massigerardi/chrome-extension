var factory = function(
    _,
    Promise,
    $options,
    Mode
) {

    /* This class handles smile mode related functionality */

    var CONSTANTS = {
        UBP_ROOT_STORAGE_KEY : "options.ubp_root"
    };

    var SmileMode = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(SmileMode.prototype, Mode.prototype, {

        initialize: function(opts) {
            Mode.prototype.initialize.apply(this, arguments);
            opts = $options.fromObject(opts);
            this._extension = opts.getOrError("extension");
        },
        enable: function(options, cb) {
            var opts    = $options.fromObject(options);
            var storage = opts.getOrError("storage");
                runtime = opts.getOrError("runtime");
                modeConfig = opts.getOrError("modeConfig");

            return Promise.bind(
                this
            ).then(function(){
                /* change ubp_root with ubp_smile_root for valid locales */
                if(modeConfig.smile && modeConfig.smile.ubp_root){
                    return storage.setAsync(CONSTANTS.UBP_ROOT_STORAGE_KEY, modeConfig.smile.ubp_root);
                } else {
                    throw new Error("SmileMode.enable, Error ubp_smile_root is missing in modeConfig.");
                }
            }).then(function(){
                runtime.bindOnBeforeNavigate(
                    null,
                    this._extension.webPageRedirect,
                    this._extension.options
                );
            }).nodeify(cb);

        },
        disable: function(options, cb) {
            var opts    = $options.fromObject(options);
            var storage = opts.getOrError("storage");
                runtime = opts.getOrError("runtime");
                modeConfig = opts.getOrError("modeConfig");
            return Promise.bind(
                this
            ).then(function(){
                /* change ubp_smile_root with ubp_root for valid locales */
                if(modeConfig.noMode && modeConfig.noMode.ubp_root){
                    return storage.setAsync(CONSTANTS.UBP_ROOT_STORAGE_KEY, modeConfig.noMode.ubp_root);
                } else {
                    throw new Error("SmileMode.disable. Error ubp_root is missing in modeConfig.");
                }
            }).then(function(){
                return runtime.unbindOnBeforeNavigate(
                    null,
                    this._extension.webPageRedirect,
                    this._extension.options
                );
            }).nodeify(cb);
        }

    });
    Promise.promisifyAll(SmileMode.prototype);
    return SmileMode;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/ext/core/util/mode")
    );
} else if (typeof define !== "undefined") {
    define(["underscore", "bluebird", "bit/commons/options", "bit/ext/core/util/mode"], factory);
}

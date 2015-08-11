var factory = function(
    _,
    Promise,
    $lang,
    $options
) {

    "use strict";

    var CONSTANTS = {
        UBP_MODE_STORAGE_KEY : "options.ubp_mode"
    };
    /**
     * ModeManger
     *
     * This module uses remote configuration (stored in S3).
     *It provides current mode status through through the ModeManger.getModeStatus() API.
     *
     * This module handles user personalization or branding
     *
     * You can create a ModeManager as follows:
     * var modeMgr = new ModeManager({
     *   configMgr: new  ConfigurationManager({
     *       config: ModeLocalConfig  => S3 config
     *   }),
     *   modes: { "smile" : new SmileMode({extension: new SmileModeExtension()})}, => list of valid modes
     *   runtime : new ChromeRuntime(), => Browser's runtime
     *   localeDelegate : Helper, => Helper function
     *   storage : $simpleStorage  => handler to local storage
     * });
     *
     */
    var ModeManger = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ModeManger.prototype, {

        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._configMgr = opts.getOrError("configMgr");
            this._modes = opts.getOrError("modes");
            this._runtime = opts.getOrError("runtime");
            this._localeDelegate = opts.getOrError("localeDelegate");
            this._storage = opts.getOrError("storage");
            this._configMgr.start();
        },

        /**
         * return mode value for input mode, return 'undefined' for a invalid mode,
         * Valid mode are passed at time of initiation of ModeManger
         */

        _isValidMode: function(mode) {
            return !!this._modes[mode];
        },

        /**
         * enable : Enables given mode
         * options - input object
         * e.g.
         * AmazonUBP.Modes.enable({
         *     mode: "smile",
         *     success: function(modeVale) {
         *              //Success callback
         *     },
         *     error: function(errMsg) {
                        //Error callback
         *     }
         * });
         */

        enable: function(options, cb) {
            //options.mode is mandatory input, Validation not required
            var mode = options.mode;

            if (!this._isValidMode(mode)){
                throw new Error("ModeManger: Invalid mode " + mode);
            }

            Promise.bind({modeMgr:this})
            .then(function(){
                return this.modeMgr._localeDelegate.getLocaleAsync();
            }).then(function(locale){
                this.currentLocale = locale;
                return this.modeMgr._configMgr.getAsync("locales");
            }).then(function(localeConfig){
                return localeConfig[this.currentLocale];
            }).then(function(config){
                if(!config || !config.noMode || !config[mode]){
                    throw new Error("ModeManger: missing locale config.");
                }
                return this.modeMgr._modes[mode].enableAsync({
                    storage : this.modeMgr._storage,
                    runtime : this.modeMgr._runtime,
                    modeConfig  : config
                });
            }).then(function(){
                return this.modeMgr._storage.getAsync(CONSTANTS.UBP_MODE_STORAGE_KEY);
            }).then(function(modeObj){
                modeObj = modeObj || {};
                modeObj[mode] = 'true';
                this.modeMgr._storage.setAsync(CONSTANTS.UBP_MODE_STORAGE_KEY, modeObj);
                return modeObj[mode];
            }).nodeify(cb);
        },

        /**
         * disable : Disables given mode
         * options - input object
         * e.g.
         * AmazonUBP.Modes.disable({
         *     mode: "smile",
         *     success: function(modeVale) {
         *              //Success callback
         *     },
         *     error: function(errMsg) {
                        //Error callback
         *     }
         * });
         */

        disable: function(options, cb) {
            //options.mode is mandatory input, Validation not required
            var  mode = options.mode;
            if (!this._isValidMode(mode)){
                throw new Error("ModeManger: Invalid mode " + mode);
            }

            Promise.bind({modeMgr:this})
            .then(function(){
                return this.modeMgr._localeDelegate.getLocaleAsync();
            }).then(function(locale){
                this.currentLocale = locale;
                return this.modeMgr._configMgr.getAsync("locales");
            }).then(function(localeConfig){
                return localeConfig[this.currentLocale];
            }).then(function(config){
                if(!config){
                    throw new Error("ModeManger: missing locale config.");
                }
                return this.modeMgr._modes[mode].disableAsync({
                    storage: this.modeMgr._storage,
                    runtime: this.modeMgr._runtime,
                    modeConfig  : config
                });
            }).then(function(){
                return this.modeMgr._storage.getAsync(CONSTANTS.UBP_MODE_STORAGE_KEY);
            }).then(function(modeObj){
                modeObj = modeObj || {};
                modeObj[mode] = 'false';
                this.modeMgr._storage.setAsync(CONSTANTS.UBP_MODE_STORAGE_KEY, modeObj);
                return modeObj[mode];
            }).nodeify(cb);
        },

        /**
         * getModeStatus : get mode object like {'smile':'true','prime':'false'}
         * options - input object
         * e.g.
         * AmazonUBP.Modes.getModeStatus({
         *     success: function(modeObj) {
         *               //modeObj => {'smile':'true','prime':'false'}
         *               //Success callback
         *     },
         *     error: function(errMsg) {
                        //Error callback
         *     }
         * });
         */

        getModeStatus: function(options, cb) {
            //No validation required for options

            return Promise.bind(
                this
            ).then(function(){
                return this._storage.getAsync(CONSTANTS.UBP_MODE_STORAGE_KEY);
            }).then(function(modeObj){
                modeObj = modeObj || {};
                return modeObj;
            }).nodeify(cb);
        },

        /**
         * isModeEnabled : Get Mode value for valid given mode
         * options - input object
         * e.g.
         * AmazonUBP.Modes.isModeEnabled({
         *     mode: "smile",
         *     success: function(isModeEnabled) {
         *               //isModeEnabled => 'true' or 'false'}
         *               //Success callback
         *     },
         *     error: function(errMsg) {
                        //Error callback
         *     }
         * });
         */

        isModeEnabled: function(options, cb) {
            //options.mode is mandatory input, Validation not required
            var  mode = options.mode;

            if (!this._isValidMode(mode) ){
                throw new Error("ModeManger: Invalid mode " + mode);
            }

            return Promise.bind(
                this
            ).then(function(){
                return this._storage.getAsync(CONSTANTS.UBP_MODE_STORAGE_KEY);
            }).then(function(modeObj){
                modeObj = modeObj || {};
                var modeValue =  modeObj[mode];
                modeValue = (modeValue === undefined) ? "false" : modeValue;
                return modeValue;
            }).nodeify(cb);
        }
    });

    Promise.promisifyAll(ModeManger.prototype);
    return ModeManger;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/lang"),
        require("bit/commons/options")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/lang",
        "bit/commons/options"
    ], factory);
}

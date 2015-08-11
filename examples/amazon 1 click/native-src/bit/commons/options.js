var factory = function(
    _
) {
    var Options = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Options.prototype, {
        initialize: function(opts,errorDescription) {
            this._opts = opts;
            //Error Description is a string that helps devs determine where this
            //options block was called from, and for what reason.
            this.errorDescription = errorDescription;
        },

        /**
         * Returns the value associated with the provided `attr` key.
         */
        get: function(attr) {
            if (this._opts.hasOwnProperty(attr)) {
                return this._opts[attr];
            }
        },

        /**
         * Returns the value associated with the provided `attr` key.
         * If such a value is undefined or null, raises an exception.
         */
        getOrError: function(attr) {
            if (typeof this._opts[attr] === "undefined" || this._opts[attr] === null) {
                throw new Error("Option required but not found: " + attr + "\n From: " + this.errorDescription);
            }
            return this._opts[attr];
        },

        /**
         * Returns the value associated with the provided `attr` key.
         * If such a value is undefined or null, instead returns the
         * caller-supplied `defaultVal`. Negates the need for excessive
         * null-checking. An unnessarily overcomplicated example:
         *
         *   // By default, upcase incoming text.
         *   var DEFAULT_TRANSFORM_DELEGATE = function(msg) {
         *       return msg.toUpperCase();
         *   };
         *
         *   var Transformer = function() {
         *       this.initialize.apply(this, arguments);
         *   };
         *
         *   Transformer.prototype = {
         *       initialize: function(opts) {
         *           opts = $options.fromObject(opts);
         *           this._delegate = opts.getOrElse("transform", DEFAULT_TRANSFORM_DELEGATE)
         *       },
         *       transform: function(msg) {
         *           return this._delegate(msg);
         *       }
         *   };
         *
         *   // Default behavior
         *   var underscore_letters = new Transformer({
         *       transform: function(msg) {
         *           return msg.split("").join("_");
         *       }
         *   });
         *   console.log(underscore_letters("hello")); => "h_e_l_l_o";
         *
         *   // Default behavior
         *   var caps = new Transformer();
         *   console.log(caps("hello")); => "HELLO";
         *
         */
        getOrElse: function(attr, defaultVal) {
            if (typeof this._opts[attr] === "undefined" || this._opts[attr] === null) {
                return defaultVal;
            } else {
                return this._opts[attr];
            }
        },

        /**
         * Like `getOrElse`, returns the value associated with the provided `attr` key.
         * If such a value is undefined or null, instead returns the return value
         * of the evaluated `defaultValFun` function.
         *
         * This is useful if your fallback value requires instantiation or allocation
         * of objects which are expensive or otherwise complicated, as the evaluation
         * of such code is only evaluated if actually necessary, rather than as part of
         * the `getOrElse` method call evaluation. In other words, this allows you to
         * "fake" [non-strict evaluation][1] when providing the default value.
         *
         * [1]:http://www.haskell.org/haskellwiki/Non-strict_semantics
         *
         */
        getOrElseFn: function(attr, defaultValFun) {
            if (typeof this._opts[attr] === "undefined" || this._opts[attr] === null) {
                return defaultValFun();
            } else {
                return this._opts[attr];
            }
        },
    });

    Options.fromObject = function(obj,errorDescription) {
        return new Options(obj || {},errorDescription || "");
    }

    return Options;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore")
    );
} else if (typeof define !== "undefined") {
    define(["underscore"], factory);
}



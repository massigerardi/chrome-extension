var factory = function(
    _,
    Promise,
    $lang,
    $options,
    FilteringDispatcher,
    XHRClient,
    SDKRequestClient
    ) {

    var AmazonXhrRequestHandler = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(AmazonXhrRequestHandler.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._dispatcher = new FilteringDispatcher({
                namespace: "Network",
                delegate: this
            });
            this._simpleStorage = opts.getOrError("simpleStorage");
            this._networkClient = (typeof XMLHttpRequest === "undefined") ? new SDKRequestClient() : new XHRClient();

        },
        handle: function(ctx, api, argsObj, cb) {
            this._dispatcher.dispatch(ctx, api, argsObj, cb);
        },

        onMsgAmazonXhrRequest: function(ctx, args, cb) {
            this._request(args, cb);
        },

        onMsgAmazonXhrTimeObject: function(ctx,args,cb) {
            cb(null,this._networkClient.lastServerClientTimePairObject);
        },

        _request: function(opts, cb) {
            var opts = opts,
                cb = cb;

            Promise.bind(this)
            .then(function () {
                return this._simpleStorage.getAsync("options.ubp_root");
            })
            .then(function (root) {
                if (opts.uri) {
                    //adds a leading slash to uri if not already there
                    if (opts.uri[0] !== "/") {
                        opts.uri = "/" + opts.uri;
                    }
                    delete opts.url;
                    //parse root does a regexp for http(s) * .amazon. *
                    opts.url = this._parseRoot(root) + opts.uri;
                }
                var url = opts.url;
                var config = opts.config;

                var callback = function(error, response) {
                    if ($lang.cbOnErr(cb, error)) {
                        return;
                    }
                    if (!response) {
                        cb(new Error("Invalid response"));
                        return;
                    }
                    
                    cb(null, response);
                };

                config["success"] = function(response) {
                    callback(null, response);
                };

                config["error"] = function(error) {
                    callback(error, null);
                };

                this._networkClient.request(url, config);
            });
        },
        _parseRoot: function (root) {
            root = root || "";
            try {//This regexp tests it's an smile.amazon/amazon/s3.amazonaws domain. (http+https)
                var amazonAndAWSRegExp = /^https?:\/\/.*\.amazon(aws)?\.(co\.uk|co\.jp|fr|it|de|cn|es|ca|com)\/?$/;
                var isAmazonDomain = amazonAndAWSRegExp.test(root);
                if (isAmazonDomain) {
                    if (root[root.length - 1] === "/") {
                        root = root.slice(0,root.length-1);//take off trailing slash
                    }
                    return root;
                } else {
                    return "https://www.amazon.com";
                }
            } catch (e) {
                //do some dumb tests...?
                return "https://www.amazon.com";
            }
        }
    });

    return AmazonXhrRequestHandler;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/lang"),
        require("bit/commons/options"),
        require("bit/ext/core/platform/handlers/util/filtering-dispatcher"), 
        require("bit/clients/network/xhr-client"),
        require("bit/clients/network/sdk-request-client")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/lang",
        "bit/commons/options",
        "bit/ext/core/platform/handlers/util/filtering-dispatcher",
        "bit/clients/network/xhr-client",
        "bit/clients/network/sdk-request-client"
    ], factory);
}



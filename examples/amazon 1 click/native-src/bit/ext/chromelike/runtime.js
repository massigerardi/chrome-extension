var factory = function(
    _,
    Promise
) {

    var Runtime = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Runtime.prototype, {
        initialize: function() {},
        /*
        * Add onHeadersReceived and onBeforeSendHeaders request listener to page which match to filter urls, and call webPageRedirect before navigation starts
        * options:{
        *    filter:{urls: ["*://www.amazon.com/*"]},
        *    permission:["blocking"]
        * }
        */
        bindOnBeforeNavigate:function(ctx, webPageRedirect, options){
            if (arguments.length === 1) {
                webPageRedirect = ctx;
                ctx = {};
            }
            chrome.webRequest.onHeadersReceived.addListener(
                webPageRedirect,
                options.requestsRedirect.filter,
                options.requestsRedirect.permission
            );
            chrome.webRequest.onBeforeSendHeaders.addListener(
                options.webRequestHeaders,
                options.requestHeaders.filter,
                options.requestHeaders.permission
            );
        },
        /*
        * This method removes onHeadersReceived and onBeforeSendHeaders request listener for given callback
         */
        unbindOnBeforeNavigate:function(ctx, webPageRedirect, options){
            if (arguments.length === 1) {
                webPageRedirect = ctx;
                ctx = {};
            }
            chrome.webRequest.onHeadersReceived.removeListener(webPageRedirect);
            chrome.webRequest.onBeforeSendHeaders.removeListener(options.webRequestHeaders);
        },
        bindOnTabUpdated: function(ctx, callback) {
            if (arguments.length === 1) {
                callback = ctx;
                ctx = {};
            }
            return chrome.tabs.onUpdated.addListener(callback);
        },
        unbindOnTabUpdated: function(ctx, callback) {
            if (arguments.length === 1) {
                callback = ctx;
                ctx = {};
            }
            return chrome.tabs.onUpdated.removeListener(callback);
        },
        bindOnMessage: function(ctx, callback) {
            if (arguments.length === 1) {
                callback = ctx;
                ctx = {};
            }
            return chrome.runtime.onMessage.addListener(callback);
        },
        unbindOnMessage: function(ctx, callback) {
            if (arguments.length === 1) {
                callback = ctx;
                ctx = {};
            }
            return chrome.runtime.onMessage.removeListener(callback);
        },
        getActiveTabId: function(cb) {
            try {
                chrome.tabs.query({
                    active:true,
                    lastFocusedWindow:true
                }, function(result) {
                    if (result && result.length > 0) {
                        cb(null, result[0].id);
                    }
                });    
            } catch (e) {
                cb(new Error("ERROR: runtime.getActiveTabId returned error: "+ e));
            }
        },
        sendMessage: function(ctx, tabId, message, cb) {
            if (arguments.length === 3) {
                cb = message;
                message = tabId;
                tabId = ctx;
                ctx = {};
            }

            chrome.tabs.sendMessage(tabId, message, function(response) {
                if (!arguments.length) {
                    cb(new Error("" + chrome.runtime.lastError));
                } else {
                    cb(null, response);
                }
            });
        },
        executeScript: function(ctx, tabId, scriptFile, cb) {
            if (arguments.length === 3) {
                cb = scriptFile;
                scriptFile = tabId;
                tabId = ctx;
                ctx = {};
            }

            chrome.tabs.executeScript(tabId, {
                file: scriptFile,
                allFrames: false,
                runAt: "document_idle"
            }, function(args) {
                cb();
            });
        },
        getAvailableExtensionStorageSpace: function (ctx,cb) {
            if (arguments.length === 1) {
                cb = ctx;
                ctx = {};
            }

            chrome.storage.local.getBytesInUse(function (bytesInUse) {
                if (!bytesInUse && chrome.runtime.lastError) {
                    cb(new Error(chrome.runtime.lastError.message));
                } else {
                    //Amount of space avaiable is equal to the total (quota) minus in-use bytes
                    var freeSpaceInBytes = chrome.storage.local.QUOTA_BYTES - bytesInUse;
                    cb(null,freeSpaceInBytes);
                }
            });
        },

        //Returns a promise that resolves to an array of id's that are unique to each extension the user has installed.
        //Input : nothing
        //Output (promise) : array of extension id's the user has installed.
        getAddonsAsync : function (ctx) {
            if (arguments.length === 0) {
                ctx = {};
            }
            return new Promise(function (fulfill,reject) {
                chrome.management.getAll(function (installedExtensions) {
                    var arrayOfIds = _.pluck(installedExtensions,'id');
                    fulfill(arrayOfIds);
                });
            });
        },

        //intersectAddonLists takes the array of addon id's returned by getAddonsAsync (passed in as the installed_addons
        //property of paramsObj) and the toUninstall object from the AddonUninstaller (an object of key-value pairs in
        //the form of <addon_alias> : <addon_id>) and returns an object that contains key-value pairs of the addons the
        //user currently has installed of the form <addon_alias> : <addon_id>. It's used for tracking
        //which addons the user has installed at start-up. Since Chrome's uninstall API uses just the id, that's all we store.
        //Input : parameters object with properties to_uninstall and installed_addons
        //Output : An object of addon_alias:addon_id key-value pairs.
        intersectAddonLists : function (ctx,paramsObj) {
            if (arguments.length === 1) {
                paramsObj = ctx;
                ctx = {};
            }
            var aliasAddonObj = paramsObj.to_uninstall,
                arrayOfIds = paramsObj.installed_addons;
            //for each element in the list of extensions to be uninstalled
            //  if the extension isn't in the array of installed extension:
            //      remove it from the object of alias:id pairs.
            for (var alias in aliasAddonObj) {
                if (!_.contains(arrayOfIds,aliasAddonObj[alias])) {
                    delete aliasAddonObj[alias];
                }
            }
            return aliasAddonObj;
        },

        //Calls the native Chrome API for uninstalling an extension.
        //Input : the ID for the addon ('addon' in the arguments), and a callback ('cb')
        //Output : nothing (calls the system's uninstall function, and executes callback upon selection of either cancel or confirm in dialog)
        uninstallAddon : function (ctx,addon,cb) {
            if (arguments.length === 2) {
                cb = addon;
                addon = ctx;
                ctx = {};
            }
            chrome.management.uninstall(addon,{showConfirmDialog:true},function () {
                cb();
            });
        },

        //registers an event listener that is executed each time an extension is uninstalled.
        //The id of the uninstalled extension is passed as a argument. 
        //Input : callback with signature fn(id_of_addon_uninstalled)
        //Output : nothing.
        registerUninstallListener: function (ctx,cb) {
            if (arguments.length === 1) {
                cb = ctx;
                ctx = {};
            }

            chrome.management.onUninstalled.addListener(function (id) {
                cb(id);
            });
        },


        //Sets the alerts badge (the little thing on the 1BA button that tells you how 
        //many unread notifications you have) 
        setAlertsBadgeCount: function (ctx,count) {
            if (arguments.length === 1) {
                count = ctx;
                ctx = {};
            }
            chrome.browserAction.setBadgeBackgroundColor({color:"#FF8000"});
            //if count === 0 then the badge text will be the null string (what we want).
            //however, if you pass in "0", then it'll be a badge icon with "0" displayed.
            //please pass in a number (JS type "number"), and not string.
            chrome.browserAction.setBadgeText({text: count?count.toString():""});
        },

        //Returns the extension version returned by the browser's addon API.
        //Input: none
        //Output: version num.
        getExtensionVersion : function(ctx) {
            var details = chrome.app.getDetails();
            return details.version;
        }
    });


    return Runtime;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/events")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/events"
    ], factory);
}

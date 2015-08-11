/* addon-uninstaller.js
* NOTE: addon, add-on, and extension are all synonymous.
****************
*   This file contains a general purpose Addon Uninstaller. The Uninstaller requires runtime specific functions
    and variables, which are passed in at instantiation. A breakdown of the objects/functions needed is listed later on. 
****************
* The general flow of the Uninstaller is as follows:
*   1) The uninstaller gets the addons that are to be uninstalled from the server. These are organized in an
*   .  object with the keys as the addon aliases to be used internally and ids that are specific to how the
*   .  browser uniquely identifies addons as the values.
*   2) The uninstaller sets up its message subscriber using the bus passed in. This allows it to respond to 
*   .  external events relevant to it. It also calls any addon-specific functions passed in.
*   3) The uninstaller checks what addons the user has installed, and then performs an intersection of the
*   .  addons to be uninstalled and the ones that the user actually has installed. The object returned uses
*   .  the same alias as the key, but the values are whatever is needed to call the native uninstall API.
*   4) Based on what addons are actually present, the uninstall manager performs some setup. In the case of UW,
*   .  that setup is setting the application-state to its appropriate values, so that the external context is
*   .  aware of any special states the 1BA may be in.
*   5) At this point, the uninstaller is ready, and reacts to external messages passed in. When a call to
*   .  uninstall an addon is made, it invokes the native API. The uninstall event listener implements a call
*   .  to removeAddon, which in turn will handle any addon specific code (such as a ping for UW).
*****************
*/
var factory = function( _ , Promise, $options, $ajax, TaskManager) {

    "use strict";

    var AU_GET_ADDONS_ENDPOINT = '/gp/ubp/json/AU/addons',
        AU_GET_ADDONS_INITIAL_RETRY_INTERVAL = 1000 *60 *2, //2 minutes
        AU_GET_ADDONS_NUM_RETRIES = 10,
        AU_GET_ADDONS_BACKOFF_FACTOR = 1.5; //less than the typical value of 2, since the initial retry is so long.

    var Uninstaller = function () {
        this.initialize.apply(this,arguments);
    };

    _.extend(Uninstaller.prototype, {
        /*
    the runtime provides the following functions
        getAddonsAsync : function ()
            getAddonsAsync returns a Promise that resolves as an array representing the installed addons.

        intersectAddonLists : function ({installed_addons: whatever getAddonsAsync returns, to_uninstall: {...} })
            intersectLists takes whatever is returned by getAddons along with whatever is returned by the server
            to be uninstalled, and returns an object with the format {addon-alias : something-i-can-call-uninstall-on}.
            It essentially performs an intersection of what the user has installed and what we want to uninstall,
            such that the result is an object containing only addons that are both installed and that we want to uninstall.
            The returned object is stored internally under a property named _installed_addons (this is slightly confusing, but
            makes sense, since it is an object that holds the installed addons we care enough about to keep around...)

        uninstallAddon : function(what,cb)
            uninstall is a straightforward function, which gets passed a value in the _installed_addons object
            and a callback. Currently the uninstaller does not use the callback function (_onFinishedUninstall)
            however in the future there might be some use case.

        registerUninstallListener : function (args)
            This registers the passed in listener that will get called when the browser dispatches an uninstall event. 

    Each extension we wish to uninstall should implement the following interface:
        onRemoveAddon() : Called when the addon is uninstalled

        messageBusListener(message) : Executed each time the addon-uninstaller gets a message via the message bus.

        setupContext(isInstalled) : Called initially when the 1BA start up. isInstalled is true if that extension is installed.
       */

        initialize : function(opts) {
            opts = $options.fromObject(opts);

            this._messageBus = opts.getOrError('messageBus');
            this._getRootDelegate = opts.getOrError('getRootDelegate');
            this._runtime = opts.getOrError('runtime');
            this._networkClient = opts.getOrError('networkClient');

            //This object contains all extension specific functions we need to use. 
            //The methods for this object get called inside of the _setupContext, _removeAddon, and _setupMessageBus
            //See any of those to understand better how/when the methods get called. 
            this._extensionSpecificFunctions = opts.getOrElse('extensionSpecificFunctions',{}); 

            this._toUninstall = opts.getOrElse('toUninstall', {}); //for debugging, pass in yourself

            //These are all callbacks, and so to maintain the 'this' context as the uninstaller object
            //we bind them here. Prevents us from having to write _.bind(method,this) every time. 
            _.bindAll(this,'_onFinishUninstall');

            this._installedAddons = {};
        },

        /* start calls the functions necessary for startup. Programmatically called, so that
         * instantiation is separate from actually setting up the uninstaller. 
         */
        start : function () {
            Promise.bind(this)
            // The following block is commented out pending hardcoded extension ID change. 
            /* 
                .then(function(){
                    if (this._toUninstall === undefined) {
                        return this._getAddonsFromJSONAsync(AU_GET_ADDONS_INITIAL_RETRY_INTERVAL,AU_GET_ADDONS_NUM_RETRIES);
                    } else {
                        return;
                    }
                }) 
            */
            .then(function () {
                //setup the message bus, register the uninstall listener, and get the installed addons.
                this._setupMessageBus();
                this._registerUninstallListener();
                //resolves once the addon-uninstaller knows which extensions are installed
                return this._getItemsToUninstall();
            })
            .then(function () {
                //setupContext needs to know which extensions are installed
                this._setupContext();
            });
        },

        /* _getAddonsFromJSON gets addons that the Uninstaller should look to uninstall. If a toUninstall object
         * is provided at instantiation, this function is never called (see start()). 
         */
        _getAddonsFromJSONAsync : function (delayMs,numRetries) {
            return Promise.bind(this)
            .then(function () {
                return this._getRootDelegate.getRootAsync(AU_GET_ADDONS_ENDPOINT);
            })
            .then(function (completeURL) {
                return this._makeRequestForJSONAsync(completeURL);
            })
            .then(function (jsonResponse) {
                if (jsonResponse !== null || typeof jsonResponse !== 'undefined') {
                    //jsonRespose could be null per the FF-addon Request-api,
                    //or jsonResponse is simply undefined for whatever reason.
                    this._toUninstall = jsonResponse;
                } else {
                    //default to empty object 
                    this._toUninstall = {};
                }
            })
            .catch(function (error) {
                //if there are any errors, just start over, after a delay,
                //and make sure there's exponential backoff. stop after a certain
                //number of retries
                return Promise.bind(this)
                .then(function () {
                    --numRetries;
                    if (numRetries < 0) {
                        throw new Error('getAddonsFromJSONAsync has failed too many times and used all of its retries.');
                    }
                })
                .delay(delayMs) //since FF addons has its own setTimeout, this should be tested thoroughly in FF.
                .then(function () {
                    return this._getAddonsFromJSONAsync(delayMs*AU_GET_ADDONS_BACKOFF_FACTOR,numRetries);
                });
            });
        },

        _makeRequestForJSONAsync : function (url) {
            return new Promise(_.bind(function(fulfill,reject) {
                var networkClientConfig = {
                    http_method : "GET",
                    success : fulfill,
                    error : reject,
                    responseType : "json"
                };
                this._networkClient.request(url,networkClientConfig);
            },this));
        },

        /* _getItemsToUninstall calls getAddons, and then passes in the necessary arguments to intersectLists. Also updates the value
         * of this._installed_addons to the object returned by intersectLists
         */
        _getItemsToUninstall : function () {
            return Promise.bind(this)
            .then(function () {
                return this._runtime.getAddonsAsync();
            })
            .then(function (installedAddons) {
                this._installedAddons = this._runtime.intersectAddonLists({installed_addons:installedAddons,
                    to_uninstall:this._toUninstall});
            });
        },

        /* _setupMessageBus calls subscribe on the bus passed in, so that we can 
         * handle any messages from the external context (e.g. when addonuninstall is called), 
         * and call the message handlers for each of the extension-specific functions
         */
        _setupMessageBus : function () {
            this._messageBus.subscribe(_.bind(function (message) {
                if (message.mType === 'Event.AddonUninstallConfirmation') {
                    //A message type that means the user has pressed "confirm uninstall" on 1BA's
                    //uninstall page. (not to be confused with a system call). 
                    if (message.args.addonAlias) {
                        this.doUninstall(message.args.addonAlias);
                    }
                }
                for (var addonAlias in this._toUninstall) {
                    if (this._extensionSpecificFunctions.hasOwnProperty(addonAlias)) {
                        //E.g. _wishlist.messageBusListener(message) will get executed if
                        //wishlist is a property of the _toUninstall obj and this._wishlist exists.
                        //These functions are so that the extension specific functions can receive messages
                        //via the addon-uninstaller.
                        this._extensionSpecificFunctions[addonAlias].messageBusListener(message);
                    }
                }
            },this));
        },

        /* _setupContext calls the setupContext function for all of the extensions we want to uninstall.
         * Passes in whether or not that extension is installed.
         */
        _setupContext : function () {
            for (var addonAlias in this._toUninstall) {
                if (this._extensionSpecificFunctions.hasOwnProperty(addonAlias)) {
                    //Calls each of the addon-specific setupContext methods. Again, the way this is done
                    //is by looping through each property of _toUninstall, and then checking if the _extensionSpecificFunctions object
                    //has a property for <addon_alias>. Anything that refers to addon-specific stuff uses the
                    //addon alias for that extension. 
                    //E.g. for the wishlist extension, we call this._extensionSpecificFunctions.wishlist.setupContext(isInstalled);
                    //this._installedAddons.hasOwnProperty(addonAlias) returns true if that extension is in our
                    //_installedAddons object, which keeps track of which extensions (that we care about i.e. are defined in _toUninstall)
                    //are installed on the user's browser. 
                    this._extensionSpecificFunctions[addonAlias].setupContext(this._installedAddons.hasOwnProperty(addonAlias));
                }
            }
        },

        /* doUninstall calls the uninstall function based on the alias passed in. It is a wrapper
         * for the native uninstall function which is passed in at object instantiation (via runtime). 
         */
        doUninstall : function (addonAlias) {
            if (this._installedAddons.hasOwnProperty(addonAlias)) {//check that we won't return an undefined value if we try to uninstall
                //and then make a system API call to uninstall that addon
                this._runtime.uninstallAddon(this._installedAddons[addonAlias],this._onFinishUninstall);
            }
        },

        /* _onFinishUninstall is a callback that is executed after the call the native
         * uninstall function is made. Currently it is a NOOP, but in the future that
         * could change. 
         */
        _onFinishUninstall : function () {},

        /* removeAddon is called inside the uninstallListener. It will remove the addon from the 
         * _installed_addons object, as well as perform any addon specific functions. Only called
         * once there's a system event broadcasting the extension was uninstalled.
         */
        _removeAddon : function (addonAlias) {
           /* Previously this checked if the addon was in the _installedAddons object. 
            * There are two reasons to use _toUninstall:
            * a) This mimicks how the other extension-specific get called. We iterate through the _toUnistall
            *    object and then call the respective method.
            * b) Technically the system can get into a state where the 1BA thinks that the extension is uninstalled,
            *    when in reality it's installed. The reason behind this is that we don't have any install listeners, and so if
            *    the user uninstalls and then re-installs the extension (and never restarts the browser), then the addon-uninstaller
            *    will never add that extension back to the _installedAddons object. This is totally fine for our current business/functional
            *    needs, since we only bother the user once about uninstalling the addon. However, if we still want that extension's onRemoveAddon
            *    function to get called upon the second uninstallation, we have to use the _toUninstall object and not _installedAddons.
            *    This is a weird, rare edge-case, but given that onRemoveAddon for the uninstall wish list object contains no customer-visible
            *    output or behavior, it is acceptable (currently sends a ping saying that the wishlist extension has been uninstalled).
            */
            //same style as in setupContext and messageBusListener for calling the addon-specific functions. 
            if (this._toUninstall.hasOwnProperty(addonAlias)) {
                if (this._extensionSpecificFunctions.hasOwnProperty(addonAlias)) {
                    this._extensionSpecificFunctions[addonAlias].onRemoveAddon();
                }
                delete this._installedAddons[addonAlias];
            }
        },

        /* _registerUninstallListener registers the uninstall listener, which calls removeAddon
         * if that id is in our list of extensions to uninstall.
         */
        _registerUninstallListener : function () {
            this._runtime.registerUninstallListener(_.bind(function (id) {
                //looks complicated, but quite simple:
                //we first check if that id is present as a value in our _toUninstall object
                //if it is, we then call removeAddon passing in the key associated with that value (hence the invert).
                //Since each addon_alias maps to one, unique addon id, this is OK.
                if ( _.contains(_.values(this._toUninstall),id) ) {
                    this._removeAddon(_.invert(this._toUninstall)[id]);
                }
            },this));
        }
    });
    return Uninstaller;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/ajax"),
        require("bit/commons/task-manager")
        );
} else if (typeof define !== "undefined") {
    define(["underscore","bluebird","bit/commons/options","bit/commons/ajax","bit/commons/task-manager"], factory);
}

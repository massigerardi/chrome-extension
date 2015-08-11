var factory = function (
    _,
    Promise,
    $options,
    $ajax,
    TaskManager
    ) {
//Internally, we use UW to refer to 'uninstall wish list'. This is how the module is identified, and many constants/method names
//contain the uw prefix. 

//Constants for the uninstall wishlist ping.
    var UW_PING_ENDPOINT = '/gp/ubp/oneButton/UW/atwlUninstalled',
        UW_PING_DELAY = 1000 *30, //30 seconds
        UW_PING_BACKOFF_FACTOR = 2,
        UW_PING_NUM_RETRIES = 10;

//Constants for the uninstall-wishlist's storage use.
    //SK = storage key
    var UW_ATTEMPTED_SK = 'options.uwAttempted',
        UW_PING_SENT_SK = 'options.uwPingSent';

    var UninstallWishListModule = function () {
        this.initialize.apply(this,arguments);
    };

    _.extend(UninstallWishListModule.prototype,{
        initialize : function(opts) {
            opts = $options.fromObject(opts);

            this._applicationState = opts.getOrError("applicationState");
            this._simpleStorage = opts.getOrError("simpleStorage");
            this._pingDelegate = opts.getOrError("pingDelegate");

        },
        //This is called each time 1BA initializes during the setup of the addon-uninstaller.
        setupContext : function (isInstalled) {
            return Promise.bind(this)
            .then(function () {
                //retrieve whether or not we stored an attempt to uninstall the wishlist
                //(This means that either:
                //  a) the uninstall wishlist popup was shown
                //  b) the user didn't have the wishlist extension installed when they installed 1BA)
                return this._simpleStorage.getAsync(UW_ATTEMPTED_SK);
            })
            .then(function (uwAttempted){
                if (uwAttempted || !isInstalled) { //usual case: we've already attempted to uninstall wishlist
                                                   //or this is the first time running setupContext and WL extension isn't installed 
                    this._applicationState.setCurrentState('doNotShowUninstallWishListPopup');//either way, don't show the uw popup in the panel.
                    if (!uwAttempted) { //then wishlist extension must not be installed AND we haven't attempted to uninstall it yet.
                        //so we save the fact that we attempted (since it wasn't installed, this counts as an 'attempt')
                        return this._simpleStorage.setAsync(UW_ATTEMPTED_SK,Date.now());
                    } else {//this means we've attempted to uninstall already, so we don't need to set the uwAttempted variable in storage.
                        //need to make sure that there aren't any pending UWPings.
                        //By definition, only 1BA's with uwAttempted set to true could have a ping pending.
                        return this._ifUWPingPendingThenSend();
                    }
                } else { //else if the wishlist extensions is installed, and we haven't already tried to uninstall it.
                    return this._applicationState.setCurrentState("showUninstallWishListPopup");
                }
            });
        },
        //checks if there's a ping pending, and tries to send it again if there is.
        _ifUWPingPendingThenSend : function () {
            return Promise.bind(this)
            .then(function () {
                return this._simpleStorage.getAsync(UW_PING_SENT_SK);
            })
            .then(function (uwPingSent) {
                if (typeof uwPingSent !== 'undefined' && uwPingSent === 'pending') {
                    return this._uwPingAsync();
                }
            })
            .catch(function (error) {
                //The ping wasn't successfully sent, even after 10 retries
                //for now we simply ignore the error, and stop pinging
                //since the 1BA will attempt another ping
                //the next time it start up.
                return;
            });
        },
        //Sends a ping that signifies that the user has uninstalled the add to wishlist extension after installing the 1BA.
        _uwPingAsync : function () {
            return Promise.bind(this)
            .then(function () {
                return this._simpleStorage.setAsync(UW_PING_SENT_SK,'pending');
            })
            .then(function () {
                //Even though the final two parameters are the defaults for the ping manager,
                //We want to make sure that even if the default values change, that this ping won't change behavior
                //(unless we explicitly change the constants above)
                return this._pingDelegate.otherPingWithRetriesAsync(UW_PING_ENDPOINT,UW_PING_DELAY,UW_PING_NUM_RETRIES,UW_PING_BACKOFF_FACTOR);
            })
            .then(function () {
                //This block only gets executed upon a successful ping request.
                //error propagates to caller.
                return this._simpleStorage.setAsync(UW_PING_SENT_SK,Date.now());
            });
        },

        //this function gets called each time addon-uninstaller gets a message
        messageBusListener : function (message) { 
            if (message.mType === 'Event.UninstallWishListPopupShown') {
                //Message type indicates that the uninstall wish list popup
                //has been shown for this client, and so we shouldn't ever show it
                //again.
                //Reflect the change in application state,
                this._applicationState.setCurrentState("doNotShowUninstallWishListPopup");
                //store in extension storage that we've shown them the popup for uninstall wishlist
                //even though we don't expect the outer context to receive this promise, 
                //I'll return it anyway just in case future users do want to consume the
                //return value.
                return this._simpleStorage.setAsync(UW_ATTEMPTED_SK,Date.now());
            }
        },

        onRemoveAddon : function () { //bind not needed
            return Promise.bind(this)
            .then(function () {
                return this._uwPingAsync();
            })
            .catch(function (error) {
                //The ping wasn't successfully sent.
                //for now we simply ignore the error,
                //since the 1BA will attempt another ping
                //the next time it start up.
                return;
            });
        }
    });

    return UninstallWishListModule;
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
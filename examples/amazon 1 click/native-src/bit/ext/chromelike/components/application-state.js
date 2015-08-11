define([
    "underscore"
], function(
    _
    ) {        
    var ApplicationStateManager  = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(ApplicationStateManager.prototype , {
        _states : {
                "initial": {
                    productComparisonEnabled : false,
                    alertsEnabled : false,
                    sessionTrackingEnabled : false,
                    showOemFirstrun : false,
                    showUpgradePrompt : false,
                    updateUBPRoot : false, // this is only for install, when extension selects locale as per config
                    showUninstallWishListPopup : false 
                },
                "organicInstall": {
                    productComparisonEnabled : true,
                    alertsEnabled : true,
                    sessionTrackingEnabled : true,
                    showOemFirstrun : false,
                    showUpgradePrompt : false,
                    updateUBPRoot : true,
                },
                "oemInstall": {
                    productComparisonEnabled : false,
                    alertsEnabled : false,
                    sessionTrackingEnabled : false,
                    showOemFirstrun : true,
                    showUpgradePrompt : false,
                    updateUBPRoot : true,
                },
                "termsOfUsageAccepted": {
                    productComparisonEnabled : true,
                    alertsEnabled : true,
                    sessionTrackingEnabled : true,
                    showOemFirstrun : false,
                    showUpgradePrompt : false,
                    updateUBPRoot : false,
                },
                "termsOfUsageAcceptancePending": {
                    productComparisonEnabled : false,
                    alertsEnabled : false,
                    sessionTrackingEnabled : false,
                    showUpgradePrompt : false,
                    showOemFirstrun : true,
                    updateUBPRoot : false,
                },
                "stableState": {
                    productComparisonEnabled : true,
                    alertsEnabled : true,
                    sessionTrackingEnabled : true,
                    showUpgradePrompt : false,
                    showOemFirstrun : false,
                    updateUBPRoot : false,
                },
                "upgradeFromBookmark": {
                    productComparisonEnabled : true,
                    alertsEnabled : true,
                    sessionTrackingEnabled : true,
                    showUpgradePrompt : true,
                    showOemFirstrun : false,
                    updateUBPRoot : false,
                },
                "doNotShowUninstallWishListPopup" : {
                    showUninstallWishListPopup : false
                },
                "showUninstallWishListPopup" : {
                    showUninstallWishListPopup : true
                }
        },

        initialize : function() {
                         this._currentState  = _.extend({},this._states["initial"]);
        },
        setCurrentState : function(state) {
                          this._currentState = _.extend(this._currentState,this._states[state]);
        },
        getStateProperty : function(state_property) {
                          return this._currentState[state_property];
        },
        isProductComparisonEnabled : function() {
                          return this._currentState.productComparisonEnabled;
        },
        isAlertsEnabled : function() {
                          return this._currentState.alertsEnabled;
        },
        isSessionTrackingEnabled : function() {
                          return this._currentState.sessionTrackingEnabled;
        },
        shouldShowUpgradePrompt : function() {
                          return this._currentState.showUpgradePrompt;
        },
        shouldShowOemFirstrun : function() {
                          return this._currentState.showOemFirstrun;
        },
        shouldUpdateUBPRoot : function() {
                          return this._currentState.updateUBPRoot;
        }
    });

    return ApplicationStateManager;

});

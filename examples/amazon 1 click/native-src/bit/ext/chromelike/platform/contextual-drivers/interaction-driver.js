/**
 * Please see the HOWTO on how these drivers should be organized. In order to 
 * aid the visual organization, I'll add separators with headers, however these
 * will undoubtedly be meaningless (or appear arbitrary) without first reading
 * the HOWTO.
 */
(function() {

    "use strict";
    
// PREPARE: Check that the necessary dependencies are present, and simply exit if not.
    if (!window.UBPAPISupport.InteractionManager) {
        return;
    }

    var extensionMessageProxy = function(msg) {
        chrome.runtime.sendMessage(null, {
            mType: "UBPExternalMessage",
            data: msg
        });
    };
// STEP ONE: Create an instance of the manager class, and assign to a property
//           on the window object. This will overwrite the previous object if
//           one existed.
    window.UBPInteractionManagerInstance = new window.UBPAPISupport.InteractionManager({
        doc: window.document,
        onEvent: extensionMessageProxy
    });

// STEP TWO: Prior to creating the Driver object, we must first check if one has
//           already been created, thus allowing us to infer whether or not this
//           is the first time we're injecting onto this tab.
    var firstInjection = !window.UBPInteractionDriver;

// STEP THREE: Create/overwrite the previous Driver, which is a property on the
//             window object.
    window.UBPInteractionDriver = {
        handler : function(msg, sender, cb) {
            if (msg.mType === "UBPInteractionRegisterPageBodyClick") {
                var handle = window.UBPInteractionManagerInstance.registerPageBodyClick();
                cb(handle);
            } else if (msg.mType === "UBPInteractionDeregisterMultipleEvents") {
                window.UBPInteractionManagerInstance.deregisterMultipleEvents({
                    handle: msg.handle
                });
                cb();
            }
        }
    };

// STEP FOUR: If this is the first time we're injecting a CS onto the page,
//            then we need to register our anonymous function which will
//            always refer to the latest objects in memory. Doing this
//            also means that we aren't preventing these objects from being
//            garbage collected (although is by no means a guarantee that they
//            will be).   
    if (firstInjection) {
        chrome.runtime.onMessage.addListener(function () {
            window.UBPInteractionDriver.handler.apply(window.UBPInteractionDriver,arguments);
        });
    }
}());
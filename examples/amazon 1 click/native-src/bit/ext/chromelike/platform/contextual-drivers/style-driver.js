/**
 * Please see the HOWTO on how these drivers should be organized. In order to 
 * aid the visual organization, I'll add separators with headers, however these
 * will undoubtedly be meaningless (or appear arbitrary) without first reading
 * the HOWTO.
 */
(function() {

    "use strict";

// PREPARE: Check that the necessary dependencies are present, and simply exit if not.
    if (!window.UBPAPISupport.StyleManager) {
        return;
    }

// STEP ONE: Create an instance of the manager class, and assign to a property
//           on the window object. This will overwrite the previous object if
//           one existed.
    window.UBPStyleManagerInstance = new window.UBPAPISupport.StyleManager(window.document);

// STEP TWO: Prior to creating the Driver object, we must first check if one has
//           already been created, thus allowing us to infer whether or not this
//           is the first time we're injecting onto this tab.
    var firstInjection = !window.UBPStyleDriver;

// STEP THREE: Create/overwrite the previous Driver, which is a property on the
//             window object.
    window.UBPStyleDriver = {
        handler : function(msg, sender, cb) {
            if (msg.mType === "UBPStyleApplyStyle") {
                var handle = window.UBPStyleManagerInstance.applyStyle(msg.styleSpec);
                cb(handle);
            } else if (msg.mType === "UBPStyleResetStyle") {
                window.UBPStyleManagerInstance.resetStyle({
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
        chrome.runtime.onMessage.addListener(function (){
            window.UBPStyleDriver.handler.apply(window.UBPStyleDriver,arguments);
        });
    }
}());
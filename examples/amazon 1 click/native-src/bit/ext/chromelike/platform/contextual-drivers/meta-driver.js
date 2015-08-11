/**
 * Please see the HOWTO on how these drivers should be organized. In order to 
 * aid the visual organization, I'll add separators with headers, however these
 * will undoubtedly be meaningless (or appear arbitrary) without first reading
 * the HOWTO.
 */
(function() {
    
    "use strict";

// PREPARE: Check that the necessary dependencies are present, and simply exit if not.
    if (!window.UBPAPISupport.MetaManager) {
        return;
    }

// STEP ONE: Create an instance of the manager class, and assign to a property
//           on the window object. This will overwrite the previous object if
//           one existed.
    window.UBPMetaManagerInstance = new window.UBPAPISupport.MetaManager(window);

// STEP TWO: Prior to creating the Driver object, we must first check if one has
//           already been created, thus allowing us to infer whether or not this
//           is the first time we're injecting onto this tab.
    var firstInjection = !window.UBPMetaDriver;

// STEP THREE: Create/overwrite the previous Driver, which is a property on the
//             window object.
    window.UBPMetaDriver = {
        handler : function(msg, sender, cb) {
            if (msg.mType === "UBPMetaGetPageLocationData") {
                cb({
                    windowLocation: window.UBPMetaManagerInstance.getWindowLocation(),
                    documentReferrer: window.UBPMetaManagerInstance.getDocumentReferrer()
                });
            } else if (msg.mType === "UBPMetaGetPerformanceTimingData") {
                cb({
                    performanceTiming: window.UBPMetaManagerInstance.getPerformanceTiming()
                });
            } else if (msg.mType === "UBPMetaGetPageDimensionData") {
                cb({
                    windowOuterWidth: window.UBPMetaManagerInstance.getWindowOuterWidth()
                });
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
            window.UBPMetaDriver.handler.apply(window.UBPMetaDriver,arguments);
        });
    }
}());

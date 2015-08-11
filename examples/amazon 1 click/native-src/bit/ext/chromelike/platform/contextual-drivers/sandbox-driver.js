/**
 * Please see the HOWTO on how these drivers should be organized. In order to 
 * aid the visual organization, I'll add separators with headers, however these
 * will undoubtedly be meaningless (or appear arbitrary) without first reading
 * the HOWTO.
 */
(function() {
// PREPARE: Check that the necessary dependencies are present, and simply exit if not.
    if (!window.UBPAPISupport || !window.UBPAPISupport.SandboxLibrary) {
        //we can't do anything without these objects being present.
        return;
    }

// STEP ONE: Create an instance of the manager class, and assign to a property
//           on the window object. This will overwrite the previous object if
//           one existed.
    window.UBPSandboxManagerInstance = (function(){

        var SandboxManager         = window.UBPAPISupport.SandboxLibrary.SandboxManager,
            IFrameCreationStrategy = window.UBPAPISupport.SandboxLibrary.IFrameCreationStrategy;

        // Allows the SandboxManager to surface "external messages" to
        // extension.
        var extensionMessageProxy = function(msg) {
            chrome.runtime.sendMessage(null, {
                mType: "UBPExternalMessage",
                data: msg
            });
        };

        // The strategy encapsulates frame creation and modification
        var strategy = new IFrameCreationStrategy(document),
            // SoundManager encapsulates creation and handshake of sandboxes
            sandboxManager = new SandboxManager({
                strategy: strategy,
                onMessage: extensionMessageProxy,
                whitelistedOrigins: []
            });


        return sandboxManager;
    }());

// STEP TWO: Prior to creating the Driver object, we must first check if one has
//           already been created, thus allowing us to infer whether or not this
//           is the first time we're injecting onto this tab.
    var firstInjection = !window.SandboxDriver;//true if this is the first time the CS is being injected.
    
// STEP THREE: Create/overwrite the previous Driver, which is a property on the
//             window object.
    window.SandboxDriver = {
        handler : function(msg, sender, cb){
            if (msg.mType === "UBPSandboxCreateSandbox") {
                var sandboxSpec = msg.sandboxSpecification,
                    handle = window.UBPSandboxManagerInstance.createSandbox(sandboxSpec);
                cb({handle: handle});
            } else if (msg.mType === "UBPSandboxAddWhitelistedOrigin") {
                var origin = msg.origin;
                window.UBPSandboxManagerInstance.addWhitelistedOrigin(origin);
                cb();
            } else if (msg.mType === "UBPSandboxModifySandbox") {
                var sandboxSpec = msg.sandboxSpecification,
                    handle = msg.handle;

                window.UBPSandboxManagerInstance.modifySandbox(handle, sandboxSpec);
                cb();
            } else if (msg.mType === "UBPSandboxDestroySandbox") {
                var handle = msg.handle;
                window.UBPSandboxManagerInstance.destroySandbox(handle);
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
        window.addEventListener('message', function () {
            window.UBPSandboxManagerInstance.sandboxMessageHandler.apply(window.UBPSandboxManagerInstance,arguments);
        });

        // Wire up the messages to the UBPSandboxManagerInstance methods
        chrome.runtime.onMessage.addListener(function () {
            window.SandboxDriver.handler.apply(window.SandboxDriver,arguments);//will always reference the latest handler.
        });
    }
}());

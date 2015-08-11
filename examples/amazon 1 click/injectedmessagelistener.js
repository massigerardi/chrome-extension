(function() {
    "use strict";
    var port = chrome.extension.connect({name: "UBPAppsChromeInjected"});
    port.onMessage.addListener(function(response) {
        window.UBPMessageAPIChrome.UBPMessage.messageResponse(response);
    });
    
    var UBPPlatformMessageAPI = {
        sendMessage: function(type, options) {
            var message = window.UBPMessageAPIChrome.UBPMessage.messageDispatch(type, options);
            port.postMessage(message);
        }
    };
    
    window.UBPInjectedMessageAPI = UBPPlatformMessageAPI;

    // Check whether UBPMessageAPIChrome is present (created in ubpmessage.js)
    return !!window.UBPMessageAPIChrome;
}());

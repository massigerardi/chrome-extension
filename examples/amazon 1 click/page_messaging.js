(function() {
    "use strict";

    var port = chrome.extension.connect({name: "UBPAppsChromePage"});
    port.onMessage.addListener(function(response) {
        window.postMessage(response, '*');
    });

    var receiveMessage = function(message) {
        if (message.data && message.data.UBPMessageType === "UBPMessage") {
            delete message.error;
            delete message.success;
            port.postMessage(message.data);
        }
    };
    window.addEventListener('message', receiveMessage, false);

    /**
     * Dispathching an event on web page dom to inform 1BA/UBP presence.
     * This (page_messaging.js) file runs at document_start. So dispatching the event after dom ready.
     */
    var detail = {type: "UBPMessageListenerReady"};
    var UBPMessageCustomeEvent = window.document.createEvent("CustomEvent");
    UBPMessageCustomeEvent.initCustomEvent("UBPMessageResponse", true, true, detail);
    window.document.addEventListener("DOMContentLoaded", function(){
       window.document.dispatchEvent(UBPMessageCustomeEvent);
    });

}());

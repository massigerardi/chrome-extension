var port = chrome.extension.connect({name: "UBPAppsChromePanel"});
port.onMessage.addListener(function(response) {
    if (response.type == 'Options_reload') {
        // Create the iframe and add it with setTimeout 0 so
        // the UI doesn't get blocked and the panel can open
        // immediately
        var iframe = document.createElement('iframe');
        iframe.id = "UBPOneButtonAppsFrame";
        iframe.style.cssText = "margin: 0px; padding: 0px; border: 0px; border-style: none; width: 100%; height: 100%;";
        setTimeout(function(){
            window.document.body.appendChild(iframe);
            iframe.src = src = response.url;
        }, 0);
    }
    if (response.id) {
        document.getElementById('UBPOneButtonAppsFrame').contentWindow.postMessage(response, '*');
    }
});

var receiveMessage = function(message) {
    delete message.error;
    delete message.success;
    port.postMessage(message.data);
};
window.addEventListener('message', receiveMessage, false);

(function() {
    port.postMessage({
        "type": "Chrome_optionsload"
    });
}());

var port = chrome.extension.connect({name: "UBPAppsChromePanel"});
port.onMessage.addListener(function(response) {
    if (response.type === 'Application_resize') {
        if (response.height > 596) {
            response.height = 596;
        }
        document.body.style.height = response.height + 'px';
        document.body.style.width = response.width + 'px';
        delete response.type;
        delete response.width;
        delete response.height;
    }
    else if (response.type == 'Application_reload') {
        document.getElementById('UBPOneButtonAppsFrame').src = response.url;
        delete response.type;
        delete response.url;
    }
    else if (response.type === 'Application_hide') {
        window.close();
    }
    else if (response.type === 'Chrome_apptype') {
        if (response.value === 'bookmark_button') {
            window.close();
        }
        else {
            // Create the iframe and add it with setTimeout 0 so
            // the UI doesn't get blocked and the panel can open
            // immediately
            var width = 1, height = 1;
            if(response.width && response.height) {
                width = response.width;
                height = response.height;
            }
            document.body.style.width = width + 'px';
            document.body.style.height = height + 'px';
            var iframe = document.createElement('iframe');
            iframe.id = "UBPOneButtonAppsFrame";
            iframe.style.cssText = "margin: 0px; padding: 0px; border: 0px; border-style: none; width: 100%; height: 100%; overflow: hidden;";
            setTimeout(function(){
                window.document.body.appendChild(iframe);
                port.postMessage({
                    type: 'Chrome_loadIframe'
                });
            }, 0);
        }
    }
    if (response.id || response.type === 'Application_autonavigate') {
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
        "type": "Chrome_apptype"
    });
}());

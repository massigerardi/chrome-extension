chrome.browserAction.onClicked.addListener( function() {
    chrome.tabs.executeScript( { 
        code = "var script = document.createElement('script')" 
             + "script.src = 'http://localhost:8080/examples/js/inject.js"
             + "document.body.appendChild(script)'"

    } );
});
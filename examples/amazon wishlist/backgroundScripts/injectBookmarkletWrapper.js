chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.executeScript(tab.id, {
          file: "contentScripts/inject_bookmarklet.js"  });
});

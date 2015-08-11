var App = (function (my) {

  var enabled = false;

  my.init = function() {
    enabled = localStorage.enabled === undefined ? true : localStorage.enabled === 'true';
    my.setIcon(enabled);
    chrome.browserAction.onClicked.addListener(function(tab) {
      my.toggleState(enabled);
    });
    my.initMessaging();
  };

  my.toggleState = function() {
    enabled = !enabled;
    localStorage.enabled = enabled;
    my.setIcon(enabled);
    my.updateCScriptState();
  };

  my.setIcon = function(on) {
    var icon = 'img/off128.png';
    if (on) icon = 'img/on128.png';
    chrome.browserAction.setIcon({path: icon});
  };

  my.initMessaging = function() {
    chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        if (request.type === 'getState') {
          sendResponse(enabled);
        }
      });
  };

  my.updateCScriptState = function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {type: "updateState", data: enabled}, function(response) {});
    });
  };

  return my;

})(App || {});


App.init();

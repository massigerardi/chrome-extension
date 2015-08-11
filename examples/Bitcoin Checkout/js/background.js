
//////////////////////////////////////////////////////////////////////
//
// This background page:
//
//   1) Holds the selected options and provides them
//      to the other scripts when requested
//
//   2) Registers and handles the right-click context menus
//
//   3) Receives and handles Ctrl-Shift-M notifications from the 
//      content scripts
//
//////////////////////////////////////////////////////////////////////

var baseGmailUrl = "https://mail.google.com/";
var mailtoUrlSuffix = "mail/?extsrc=mailto&url=";
var knownPorts = [];

function makeGmailDomainUrl() {
  var gmailUrl = baseGmailUrl;
  var domainName = window.localStorage["domainName"];
  if ((typeof domainName != "undefined") && (domainName != "")) {
    gmailUrl += "a/" + domainName + "/";
  }
  return gmailUrl;
}

// Send message to the mailto script to update its cached gmail url and other options.
// We also use it to add or remove the context menus
// Note: the options page sends this on save
chrome.extension.onConnect.addListener(function(port) {
  if (port.name != "GmailUrlConn")
    return;

  port.onMessage.addListener(function(msg) {
    if (msg.req == "OptionsPlease") {
      port.postMessage({
        gmailDomainUrl: makeGmailDomainUrl() + mailtoUrlSuffix,
        windowOptions: window.localStorage["gmail_window_options"],
        enableShortcut: !(window.localStorage["enable_shortcut"] == "off")
      });
      addToKnownPorts(port);
    } else if (msg.req == "OptionsChanged") {
      sendToKnownPorts({
        gmailDomainUrl: makeGmailDomainUrl() + mailtoUrlSuffix,
        windowOptions: window.localStorage["gmail_window_options"],
        enableShortcut: !(window.localStorage["enable_shortcut"] == "off")
      });
      refreshContextMenus();
    } else if (msg.req == "EmailThisPage") {
      console.log(port);
      openGmail(port.sender.tab.url, port.sender.tab.title);
    } else {
      console.log("Unsupported req on valid port");
    }
  });
});

function addToKnownPorts(port) {
  knownPorts.push(port);
  port.onDisconnect.addListener(function (p) {
    var i = knownPorts.indexOf(p);
    if (i == -1)
      console.log("What? Disconnected from an unknown port?");
    else knownPorts.splice(i,1);
  });
}

function sendToKnownPorts(msg) {
  knownPorts.forEach(function(p) { p.postMessage(msg); });
}



// Context menu callbacks
function menuClicked(type, info, tab) {
  var emailStr = "";
  var emailSubj = "";
  var extraParam = "";
  var addPage = true;
  switch (type) {
  case 'page':
    emailStr = info.pageUrl;
    emailSubj = tab.title;
    addPage = false;
    break;
  case 'selection':
    emailStr = info.selectionText;
    emailSubj = tab.title;
    break;
  case 'selection-rich':
    emailSubj = tab.title;
    extraParam = "&selid=" + selectionId;
    addPage = false;
    break;    
  case 'link':
    emailStr = info.linkUrl;
    emailSubj = "A nice link";
    break;
  default:
    emailStr = info.srcUrl;
    emailSubj = "A nice " + type;
  }
  if (addPage)
    emailStr += "\nFrom: " + info.pageUrl;
  openGmail(emailStr, emailSubj, extraParam);
}
function openGmail(emailStr, emailSubj, extraParam) {
  // Build the Gmail URL
  var gmailFullUrl = makeGmailDomainUrl() + "mail/?view=cm&fs=1&tf=1&su=" + encodeURIComponent(emailSubj) + "&body=" + encodeURIComponent(emailStr) + extraParam;

  // Open the composition window/tab
  window.open(gmailFullUrl,"_blank",window.localStorage["gmail_window_options"]);
}
function creationCallback() {
  if (chrome.extension.lastError)
    console.log("Error creating context menu: ", chrome.extension.lastError);
}


// Right-click menus registration
function refreshContextMenus() {
  chrome.contextMenus.removeAll();
  if (!(window.localStorage["enable_email_this"] == "off"))
    contextMenusAdd();
}

function contextMenusAdd() {
  chrome.contextMenus.create({ "title": "&Email this page address", "contexts": ['page'], 
    "onclick": function(info,tab) { menuClicked('page',info,tab) } }, creationCallback);
  //chrome.contextMenus.create({ "title": "&Email this as plain text", "contexts": ['selection'], 
  //  "onclick": function(info,tab) { menuClicked('selection',info,tab) } }, creationCallback);
  chrome.contextMenus.create({ "title": "&Email this selection", "contexts": ['selection'], 
    "onclick": function(info,tab) { menuClicked('selection-rich',info,tab) } }, creationCallback);
  chrome.contextMenus.create({ "title": "&Email this link", "contexts": ['link'], 
    "onclick": function(info,tab) { menuClicked('link',info,tab) } }, creationCallback);
  chrome.contextMenus.create({ "title": "&Email this image", "contexts": ['image'], 
    "onclick": function(info,tab) { menuClicked('image',info,tab) } }, creationCallback);
  chrome.contextMenus.create({ "title": "&Email this video", "contexts": ['video'], 
    "onclick": function(info,tab) { menuClicked('video',info,tab) } }, creationCallback);
  chrome.contextMenus.create({ "title": "&Email this audio clip", "contexts": ['audio'], 
    "onclick": function(info,tab) { menuClicked('audio clip',info,tab) } }, creationCallback);
}

refreshContextMenus();


// store selections so context menu clicks can use them
var selectionHtml = "";
var selectionId   = 0;

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.name == 'setSelection') {
    console.log('setSelection ' + message.id)
    selectionHtml = message.data;
    selectionId   = message.id;
  }
  else if (message.name == 'getSelection') {
    console.log('getSelection ' + message.id)
    if (selectionId == message.id) {
      sendResponse(selectionHtml);
    }
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.name == 'log') {
    console.log('content: ' + message.data)
  }
});


//
// Install | Update | Startup
//

// add content script manually upon first run (just installed/enabled)
chrome.tabs.query({}, function (tabs) {
  tabs.forEach(runMailto);
});

function runMailto(tab) {
  if (/^chrome/.test(tab.url)) return;
  chrome.tabs.executeScript(tab.id, {
      file: "js/mailto.js",
      allFrames: true
  });
}

// show thank you page upon first install 
// check for event & setting cause only one of these is not sufficient
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason == 'install' && localStorage.thank_you_shown != 'true') {
    localStorage.thank_you_shown = 'true';
    localStorage.update_2_shown  = 'true'; // only show welcome if it's a new install
    chrome.tabs.create({
        url: chrome.extension.getURL('thank_you.html'),
        selected: true
     });
  }
  else if (details.reason == 'update' && localStorage.update_2_shown != 'true') {
    localStorage.update_2_shown = 'true';
    chrome.tabs.create({
        url: chrome.extension.getURL('update.html'),
        selected: true
    });
  }

});

/*
chrome.runtime.onInstalled.addListener(function (details) {
  var not_too_young = +new Date - localStorage.install_date > 48*60*60*1000;
  if (not_too_young && details.reason == 'update') {
    if (!localStorage.promo_shown_downloadr) {
      chrome.runtime.onMessage.addListener(promoListener);
    }
  }
});

function promoListener(message, sender, sendResponse) {
  if (message == "promo-shown") {
    localStorage.promo_shown_downloadr = "true";
  } else if (message == "promo-ready" && !localStorage.promo_shown_downloadr) {
    var support_enabled = (localStorage.support == "true");
    sendResponse(support_enabled);
  }
}
*/
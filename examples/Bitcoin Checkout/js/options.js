
var optionsForNewWindow = "resizable=yes,scrollbars=yes,status=yes";
window.onload = doinit;

function doinit() {
	loadSavedOptions();
  document.getElementById('form').addEventListener("change", saveOptions, true);
  document.getElementById('options_save').onclick = saveOptions;

	document.getElementById('optGoogleApps').innerHTML = chrome.i18n.getMessage('optGoogleApps');
	document.getElementById('optDomain').innerHTML = chrome.i18n.getMessage('optDomain');
	document.getElementById('optConsumerGmail').innerHTML = chrome.i18n.getMessage('optConsumerGmail');
	document.getElementById('optOpenNewWindow').innerHTML = chrome.i18n.getMessage('optOpenNewWindow');
	document.getElementById('optInTab').innerHTML = chrome.i18n.getMessage('optInTab');
	document.getElementById('optInWin').innerHTML = chrome.i18n.getMessage('optInWin');
	document.getElementById('optEmailThis').innerHTML = chrome.i18n.getMessage('optEmailThis');
	document.getElementById('optEnableShortcut').innerHTML = chrome.i18n.getMessage('optEnableShortcut');
	//document.getElementById('optNoteReload').innerHTML = chrome.i18n.getMessage('optNoteReload');
	document.getElementById('options_save').value = chrome.i18n.getMessage('optSave');
}

function loadSavedOptions() {
  if (window.localStorage == null) {
    alert("LocalStorage must be enabled for managing options.");
    return;
  }
  var domainName = localStorage["domainName"];
  var windowOptions = localStorage["gmail_window_options"];
  if (typeof domainName != "undefined") {
    document.getElementById('domain_info').value = domainName;
  }
  document.getElementById('open_new_tab').checked = (windowOptions != optionsForNewWindow);
  document.getElementById('open_new_window').checked = (windowOptions == optionsForNewWindow);
  document.getElementById('email_this').checked = !(localStorage["enable_email_this"] == "off");
  document.getElementById('enable_shortcut').checked = !(localStorage["enable_shortcut"] == "off");
  document.getElementById("dontsupport").checked = (localStorage.support == "false");///
}

function saveOptions() {
  var domainVal = document.getElementById('domain_info').value; 
  if ((domainVal != "") && (domainVal.indexOf('.') == -1)) {
    alert(chrome.i18n.getMessage("optDomainError", domainVal));
  } else {
    window.localStorage["domainName"] = domainVal;
  }
  localStorage["gmail_window_options"] = document.getElementById('open_new_window').checked ? optionsForNewWindow : "";
  localStorage["enable_email_this"] = document.getElementById('email_this').checked ? "on" : "off";
  localStorage["enable_shortcut"] = document.getElementById('enable_shortcut').checked ? "on" : "off";
  localStorage.support = !(document.getElementById("dontsupport").checked);///

  // Notify the background page
  var bgPort = chrome.extension.connect({name: "GmailUrlConn"});
  bgPort.postMessage({req: "OptionsChanged"});
}
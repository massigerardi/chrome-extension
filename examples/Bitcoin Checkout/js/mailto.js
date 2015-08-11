// Copyright (c) 2009 The Chromium Authors. All rights reserved.
// Copyright (c) 2010 Jacopo Corbetta. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var cachedGmailUrl = "";
var windowOptions  = "";

var bgPort = chrome.extension.connect({name: "GmailUrlConn"});
bgPort.postMessage({req: "OptionsPlease"});
bgPort.onMessage.addListener(function(msg) {

  cachedGmailUrl = msg.gmailDomainUrl;
  windowOptions  = msg.windowOptions;

  if (msg.enableShortcut)
    window.addEventListener("keyup", keyupListener, true);
  else
    window.removeEventListener("keyup", keyupListener, true);
});

// document click listener
document.addEventListener("click", function(e) {
  var el = findLinkAncestor(e.target);
  if (el && isMailLink(el.href)) {
    var composeUrl = cachedGmailUrl + encodeForMailto(el.href);
    window.open(composeUrl, "_blank", windowOptions);
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

// key listener
function keyupListener(ev) {
  if (ev.ctrlKey && ev.shiftKey && (ev.keyCode == 77))
    bgPort.postMessage({req: "EmailThisPage"});
}


//
// Helpers
//

function findLinkAncestor(el) {
  do {
    if (el.href) return el;
  } while (el = el.parentNode);
}

function isMailLink(url) {
  return url.indexOf('mailto:') == 0;
}

function encodeForMailto(inUrl) {
  // GMail unescapes most of the string in the first step,
  // so "%2B" would get replaced with "+". Unfortunately,
  // the next step still tries to decode the string, and
  // plus is interpreted as space.
  // The same is true for "#" (interpreted as start of fragment)
  // Workaround: double encoding for + and #.
  inUrl = inUrl.replace(/\+/g,"%2B", "g")
  inUrl = inUrl.replace(/#/g,"%23", "g")
  return encodeURIComponent(inUrl);
}

// unused for now
function rewriteMailtoToGMailUrl(url) {
  var gmailUrl = cachedGmailUrl + "&to=";
  url = url.replace("?", "&");
  url = url.replace(/subject=/i, "su=");
  url = url.replace(/CC=/i, "cc=");
  url = url.replace(/BCC=/i, "bcc=");
  url = url.replace(/Body=/i, "body=");
  url = url.replace("mailto:", gmailUrl);
  return url;
}



//
// Rich Text Selection
//

function onSelect(e) {
  chrome.extension.sendMessage({ name: 'log', data: 'mouseup ' + e.which  });///
  if (e.which != 3) // right mouse
    return;
  chrome.extension.sendMessage({ name: 'log', data: 'right mouse' });///
  var s = window.getSelection();
  if (!s || !s.rangeCount)
    return;
  chrome.extension.sendMessage({ name: 'log', data: 'got range' });///
  var r = s.getRangeAt(0);
  var f = r.cloneContents();
  var el = document.createElement('div');
  el.appendChild(f);
  addSourceUrl(el);
  normalizeParagraphs(el);
  var selectionHtml = wrapSelection(el.innerHTML);
  chrome.extension.sendMessage({ name: 'log', data: 'sent' });///
  chrome.extension.sendMessage({
    name: 'setSelection',
    data: selectionHtml,
    id: Date.now()
  });
}

//document.addEventListener("mouseup", onSelect, true);
document.addEventListener("contextmenu", onSelect, true);

function normalizeParagraphs(root) {
  var paras = root.getElementsByTagName('p');
  for (var i = paras.length; i--;)
    paras[i].style.cssText += "; margin: 1.25em 0;";
}

function addSourceUrl(root) {
  var fromPara = document.createElement('p');
  var fromLink = '<a href="' + document.URL + '">' + document.URL + '</a>';
  fromPara.innerHTML = '<i>From: ' + fromLink + '</i>';
  root.appendChild(fromPara);
}

function wrapSelection(selectionHtml) {
  var style = "width:33em !important; line-height:1.5 !important; " +
              "padding:0 10px 10px; font-size:16px;";
  return '<div style="' + style + '">' + selectionHtml + '</div>';
}
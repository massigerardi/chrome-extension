// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

//http://www.amazon.de/gp/product/B00QTY5IUI/


/**
 * Get the current URL.
 *
 * @param {function(string)} callback - called when the URL of the current tab
 *   is found.
 */
function getCurrentTabUrl(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    callback(tabs[0]);
  });

}

var code;
var amount;
var currency;
var bitcoin;

function renderStatus(tab) {
  var urlRegex = /^https?:\/\/(?:[^\.]+\.)?amazon\.de/;
  var url = tab.url
  if (urlRegex.test(url)) {
      chrome.tabs.sendMessage(tab.id, { text: "prepare_code" }, null);
      chrome.tabs.sendMessage(tab.id, { text: "get_price" }, renderPrice);
      chrome.tabs.sendMessage(tab.id, { text: "get_product" }, renderProduct);
      chrome.tabs.sendMessage(tab.id, { text: "get_code" }, renderCode);
//      chrome.tabs.sendMessage(tab.id, { text: "get_image" }, renderImage);
  }

}

function renderCode(product) {
  document.getElementById('code').textContent = product.code;
  document.getElementById('desc').textContent = product.desc;
}

function renderPrice(value) {
  euro = value
  currency = euro.substring(0, 3)
  amount = euro.substring(4, euro.lenght).replace(",",".")
  document.getElementById('euro').textContent = amount;
  var searchUrl = 'https://blockchain.info/tobtc?currency='+currency+'&value='+amount
  var x = new XMLHttpRequest();
  x.open('GET', searchUrl);
  x.onload = function() {
    bitcoin = x.responseText
    document.getElementById('bitcoin').textContent = bitcoin;
  }
  x.send()

}

function renderProduct(product) {
  document.getElementById('title').textContent = product;
}

function renderImage(imageUrl) {
  var imageResult = document.getElementById('image-result');
      imageResult.src = imageUrl;
      imageResult.hidden = false;
}


document.addEventListener('DOMContentLoaded', function() {
  
  getCurrentTabUrl(function(url) {
    renderStatus(url);
  });
});

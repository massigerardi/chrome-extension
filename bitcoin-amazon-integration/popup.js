// Copyright (c) 2014 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

//http://www.amazon.de/gp/product/B00QTY5IUI/

getCurrentTabUrl(function(url) {
  renderStatus(url);
});

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
      chrome.runtime.onConnect.addListener(function (port) {
        port.onMessage.addListener(function (msg) {
          if (msg.product != null) {
            console.log(msg.product)
            renderProduct(msg.product);
          }
        });
    });
    chrome.tabs.sendMessage(tab.id, { text: "get_product" }, null);
  }

}

function renderProduct(product) {
  $('#code').text(product.code);
  $('#desc').text(product.desc);
  $('#title').text(product.title);
  renderPrice(product.price)
  renderImage(product.image)
}

function renderPrice(value) {
  euro = value
  currency = euro.substring(0, 3)
  amount = euro.substring(4, euro.lenght).replace(",",".")
  $('#euro').textContent = amount;
  var searchUrl = 'https://blockchain.info/tobtc?currency='+currency+'&value='+amount
  var x = new XMLHttpRequest();
  x.open('GET', searchUrl);
  x.onload = function() {
    bitcoin = x.responseText
    $('#bitcoin').text(bitcoin);
  }
  x.send()

}

function renderImage(imageUrl) {
  var imageResult = $('#image-result');
  imageResult.attr('src', imageUrl);
  imageResult.show();
}

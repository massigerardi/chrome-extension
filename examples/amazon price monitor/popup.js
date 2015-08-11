// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var first_run = false;
if (!localStorage['ran_before']) {
  first_run = true;
  localStorage['ran_before'] = '1';
}

if (first_run) localStorage['user_id'] = makeid();

var req ;

if (localStorage['amazon_asin'] == "" && localStorage['ebay_product'] == "")
 {
    loadRequest();
 }
 else if (localStorage['amazon_asin'] != "")
 {
    req = new XMLHttpRequest();
    req.open(
        "GET",
        "http://pricemono.com/bestdeal/add_chrome_user_products/" + localStorage['user_id'] +"/"+ localStorage['amazon_asin']+"/" + localStorage['amazon_country'] ,
        true);
    req.onload = loadRequest;
    req.send(null);
 
 }
 else if (localStorage['ebay_product'] != "")
 {
    req = new XMLHttpRequest();
    req.open(
        "GET",
        "http://pricemono.com/ebay/add_product/" + localStorage['user_id'] +"/"+ localStorage['ebay_product']+"/" + localStorage['ebay_country'] ,
        true);
    req.onload = loadRequest;
    req.send(null);
 
 }


function loadRequest(){
    req = new XMLHttpRequest();
    req.open(
        "GET",
        "http://pricemono.com/bestdeal/load_iframe_chrome/" + localStorage['user_id'] ,
        true);
    req.onload = showProducts;
    req.send(null);

}

function showProducts() {
    chrome.browserAction.setBadgeText ( { text: "" } );

    var response = req.responseText;

    document.getElementById("monitor").innerHTML = response;
  
}


function makeid()
{
    var text = "";
    var possible = "0123456789";

    for( var i=0; i < 17; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

// Listen for any changes to the URL of any tab.

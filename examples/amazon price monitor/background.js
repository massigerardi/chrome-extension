// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Called when the url of a tab changes.
function checkForValidUrl(tabId, changeInfo, tab) {
	getCurrentInfo(tab);
};

function getCurrentInfo(tab)
{
  if (tab.url.indexOf('www.amazon') > -1 && tab.url.indexOf('gp/product') > -1 ) {

     chrome.browserAction.setBadgeText ( {text: "+"} );
     
     var country = tab.url.substring( (tab.url.indexOf("amazon")+7), tab.url.indexOf("/",tab.url.indexOf("amazon")));
     var asin = tab.url.substring( tab.url.indexOf("gp/product/")+11, tab.url.indexOf("gp/product/") +21);
     
     localStorage['amazon_country'] = country;
     localStorage['amazon_asin'] = asin;
     localStorage['ebay_product']= "";
     localStorage['ebay_country'] = "";
  }
  else if (tab.url.indexOf('www.amazon') > -1 && tab.url.indexOf('dp/') > -1 ) {

     chrome.browserAction.setBadgeText ( {text: "+"} );
     
     var country = tab.url.substring( (tab.url.indexOf("amazon")+7), tab.url.indexOf("/",tab.url.indexOf("amazon")));
     var asin = tab.url.substring( tab.url.indexOf("dp/")+3, tab.url.indexOf("dp/") +13);
     
     localStorage['amazon_country'] = country;
     localStorage['amazon_asin'] = asin;
     localStorage['ebay_product']= "";
     localStorage['ebay_country'] = "";
  }
  else if (tab.url.indexOf('www.ebay') > -1 && findEbayProductLink(tab.url)!=null)
  {
      chrome.browserAction.setBadgeText ( {text: "+"} );
      var country = tab.url.substring( (tab.url.indexOf("ebay")+5), tab.url.indexOf("/",tab.url.indexOf("ebay")));
      localStorage['ebay_product']= findEbayProductLink(tab.url);
      localStorage['ebay_country'] = country;
      localStorage['amazon_country'] = "";
      localStorage['amazon_asin'] = "";
  }
  else
  {
     chrome.browserAction.setBadgeText ( {text: ""} );
     localStorage['amazon_country'] = "";
     localStorage['amazon_asin'] = "";
     localStorage['ebay_product']= "";
     localStorage['ebay_country'] = "";
  }
};


function findEbayProductLink(address)
{
    var arrayaddress = address.split("/");
    
    for (var i=2;i<arrayaddress.length;i++)
    { 
        var textArray = arrayaddress[i].split('')
        if (textArray==null)
            continue;
        
        var charCounter = -1;
        var found = false;
        for (var x=0;x<textArray.length;x++)
        { 
             var singleChar = textArray[x];
             if (singleChar == null) continue;
             var number = singleChar.match("[0-9]");
             
             if (number != null && number.length >0 && number[0]!="")
                 charCounter++;
             else if (found == false)
                 break;
             else
             {   
                var returnString = arrayaddress[i].substring(0, x );
                return returnString;
             }
             
             if (x == charCounter && x == textArray.length - 1 && textArray.length> 8)
             {
                var returnString = arrayaddress[i].substring(0, x + 1);
                return returnString;
             }
             
             if (x == 8 && charCounter !=8)
                 break; // not found
             
             if (x == 8 && charCounter ==8)
                 found = true; 
        }
    }
    
    if ( address.indexOf("?item=") >-1)
      return address.substring(address.indexOf("?item=") +6, address.indexOf("&", address.indexOf("?item=")))
    
    return null;
}



function onActivated(activeInfo)
{
	chrome.tabs.get(activeInfo.tabId, currentTab);
};

function currentTab(tab)
{
	getCurrentInfo(tab);
};


// Listen for any changes to the URL of any tab.
chrome.tabs.onUpdated.addListener(checkForValidUrl);
chrome.tabs.onActivated.addListener(onActivated);

document.addEventListener('DOMContentLoaded', function () {
    init_background();
});


var intervalID;
function init_background() {

    checkPriceDrop();
    update_interval = 1000*60*60*4;
    clearInterval(intervalID);
    
    intervalID = setInterval(
        function () {
            checkPriceDrop()
        },
        update_interval);

}

function checkPriceDrop()
{
          
  var get_product_url = "https://pricemono.com/api/drop/"+localStorage['user_id'];
 // var get_product_url = "https://pricemono.com/api/product/"+localStorage['amazon_asin']+"/"+localStorage['amazon_country'];
  $.ajax({
      "url": get_product_url,
      "dataType": "jsonp",
      "success": function(data) {       
        send_notification(data);
      }
  });

}

function send_notification(data)
{
  if (data == "No Products") return;
  $.each( data, function( key, value ) {
    //var linkDrop = 'http://www.pricemono.com/monitor/notify_drop/'+value.asin+'/'+value.country+'/'+localStorage['user_id'];
    var opt = {
	  type: "basic",
	  title: "Price Drop Notification",
	  message: value.title +" just dropped in price",
	  iconUrl: "icon-48.png"
	}    
	
	chrome.notifications.create( "notID", opt, creationCallback);
	chrome.notifications.onClicked.addListener(notClicked);
	chrome.notifications.onClosed.addListener(notClosed);
	
	function creationCallback(notID){

	}

	function notClicked(notID) {
	   	var newURL = value.detail_page_url;
	    chrome.tabs.create({ url: newURL });
 	    chrome.notifications.clear(notID, notCleared);
	}
	
	function notClosed(notID)
	{
		chrome.notifications.clear(notID, notCleared);
	}
	
	function notCleared(notID)
	{
	
	}
	
  });

}
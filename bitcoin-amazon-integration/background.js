
function checkForValidUrl(tabId, changeInfo, tab) {
    getCurrentInfo(tab);
};

function getCurrentInfo(tab) {
    if (tab.url.indexOf('www.amazon') > -1 && tab.url.indexOf('gp/product') > -1 ) {
        if ($.trim($("#twister_feature_div").html())=='') {
            chrome.browserAction.setBadgeText ( {text: "+"} )
        } else {
            chrome.browserAction.setBadgeText ( {text: "?"} )
        }
    } else {
        chrome.browserAction.setBadgeText ( {text: ""} )
    }

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

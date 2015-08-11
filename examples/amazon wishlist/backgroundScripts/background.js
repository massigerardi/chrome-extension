var doRequest = function(url,callback) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function(state) {
        if(req.readyState === 4 && (req.status === 200 || req.status === 0)) {
            callback(req.responseText);               
        }
    };
    req.open("GET", url, true);
    req.overrideMimeType('text/plain; charset=us-ascii');
    req.send(null);
};

var updatePushDownDate = function(reset) {
    var settings = AMZUWLXT.Settings.get();		
    var deltaDays = [0, 30, 90, 180, 300];		
    var defaultDelta = 30;
      
    var curPushInterval = settings.pushInterval;
    var newPushInterval;
    if (reset) {
        newPushInterval = "1";
    } else if (curPushInterval == deltaDays.length - 1) {
        newPushInterval = curPushInterval;
    } else {
        var curPushIntervalInteger = parseInt(curPushInterval) || 0;
        newPushInterval = curPushIntervalInteger + 1;
    }
                         
    AMZUWLXT.Settings.set({"pushInterval" : newPushInterval});	
    
    var nextDate = new Date();		
    var deltaDuration = (typeof deltaDays[newPushInterval] !== "undefined") ? deltaDays[newPushInterval] : defaultDelta;
    nextDate.setDate(nextDate.getDate() + deltaDuration);
    AMZUWLXT.Settings.set({"pushDate" : nextDate});	
};

var updateBadge = function(tabId) {
                chrome.browserAction.setBadgeBackgroundColor({ color : [9,175,216,255],
                                                               tabId: tabId});
                chrome.browserAction.setBadgeText({ text : "+",
                                                    tabId : tabId});

};

var updateBrowserAction = function(tabId) {
    var canvas = document.createElement("canvas");
    var srcImage = new Image();
    var settings = AMZUWLXT.Settings.get();
    srcImage.onload = function() {

        canvas.width = 19;
        canvas.height = 19;
        var context = canvas.getContext('2d');
        
        var frameNumber = 0;
        var runFrame = function(i) {
            context.clearRect(0,0,21,21);
            context.drawImage(srcImage,i * 21 + 0 ,0,19,19,0,0,19,19);
            var iData = context.getImageData(0,0,19,19);
            chrome.browserAction.setIcon({ imageData : iData,
                                           tabId : tabId});

            if((i + 1) * 21 < srcImage.width) {
                setTimeout(function() {
                    runFrame(i+1);
                },50);
            } else {
                updateBadge(tabId);
            }
            context.restore();
            
        };

        if(settings.notify) {
            runFrame(0);
        }
    };

    srcImage.src = chrome.extension.getURL("images/glow.png");
};


chrome.extension.onRequest.addListener(

    function(request, sender, sendResponse) {
        var settings = AMZUWLXT.Settings.get();

        if(request.command === "localeData") {
            sendResponse(
                {
                    "lang" : AMZUWLXT.Locale.getLanguageMapping(),
                    "domain" : AMZUWLXT.Locale.getLocaleDomain()
                }
            );
            updatePushDownDate(true); 
        }

        if(request.command === "shouldMessage") {
            sendResponse(settings.notify ||
                         settings.push ||
                         !settings.pushed);
        }

        if(request.command === "markPushed") {
            AMZUWLXT.Settings.set( {"pushed" : true } );
            updatePushDownDate(false); 
        }

        if(request.command === "detailPageNotify") {
            updateBrowserAction(sender.tab.id);
            if(settings.push || !settings.pushed || settings.pushDate < new Date()) {
                chrome.tabs.executeScript(sender.tab.id,
                                          {file : 'contentScripts/pushDownContent.js'});
                chrome.tabs.executeScript(sender.tab.id,
                                          {file : 'contentScripts/pushDownRun.js'});
            }
        }

        if(request.command === "pushdown") {

            doRequest(chrome.extension.getURL("pushdown.html"), function(pushdownHTML) {
                doRequest(chrome.extension.getURL("expander.html"), function(expanderHTML) {
                    doRequest(chrome.extension.getURL("linktemplate.html"), function(linkHTML) {
                        var domain = AMZUWLXT.Locale.getLocaleDomain();
                        var vars = {"ext-path" : chrome.extension.getURL(""),
                                    "wishlist-link" : 
                                    AMZUWLXT.Strings.process(
                                        linkHTML,
                                        {
                                            "href" : "https://" + domain + "/wishlist/ref=cm_wlext_chr_pd_wl",
                                            "body" : AMZUWLXT.Strings.lookup("uwl-ext-chrome-pushdown-content-linktext")
                                        }
                                    )};

                        pushdownHTML = AMZUWLXT.Strings.process(
                            pushdownHTML,
                            vars);


                        sendResponse({ "pushDownHtml" : pushdownHTML,
                                       "expanderHtml" : expanderHTML});

                        var pushDownRequest = "https://" + domain + "/gp/wishlist/ajax/log-extension-call.html/ref=cm_wlext_chr_pdown";
                        doRequest(pushDownRequest, function(emptyParm) {
			});

                    });
                });
            })
        }
    }
);




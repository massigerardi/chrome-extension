if(window.AMZUWLXT === undefined) {
    AMZUWLXT = {};
}

AMZUWLXT.getLocale = function() {
    if(!AMZUWLXT.Settings.get().locale) {
        AMZUWLXT.setLocale(false);
    }

    return AMZUWLXT.Settings.get().locale;
};

AMZUWLXT.setLocale = function(openLandingPage) {
    AMZUWLXT.getRecentUrls(function(urls) {
        var myLocale = AMZUWLXT.Locale.guessLocaleFromURLs(urls);
        if(!myLocale) {
            myLocale = AMZUWLXT.Locale.getDefaultLocale(navigator.language);
        }

        AMZUWLXT.Settings.set({"locale" : myLocale});

        if(openLandingPage) {
            var domain = AMZUWLXT.Locale.getLocaleDomain();

            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://' + domain + '/wishlist/install/ref=cm_wlext_i_chr?ext=chr', true);                  
            xhr.send(null);
            chrome.tabs.create({url : "https://" + domain + "/wishlist/ext-landing/ref=cm_wlext_pi_chr"});
        }
    });
};

AMZUWLXT.getRecentUrls = function(callback) {
    chrome.windows.getAll(undefined, function(windows) {
        var window_ids = [];
        for(var i = 0; i < windows.length; i++) {
            window_ids.push(windows[i].id);
        }

        var called_back = 0;
        var urls = [];

        for(var i = 0; i < window_ids.length; i++) {
            chrome.tabs.getAllInWindow(window_ids[i], function(tabs) {
                for(var j = 0; j < tabs.length; j++) {
                    if(tabs[j] && tabs[j].url) {
                        urls.push(tabs[j].url);
                    }
                }

                called_back++;

                if(called_back == window_ids.length) {
                    callback(urls);
                }
            });
        }
    });
};



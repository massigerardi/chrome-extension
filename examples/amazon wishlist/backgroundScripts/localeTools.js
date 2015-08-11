if(window.AMZUWLXT === undefined) {
    AMZUWLXT = {};
}

AMZUWLXT.Locale = {
    _locale_defaults : {
        "US" : "us",
        "DE" : "de",
        "FR" : "fr",
        "GB" : "uk",
        "CA" : "ca",
        "CN" : "cn",
        "JP" : "jp",
        "IT" : "it",
        "ES" : "es"
    },
    _lang_defaults : {
        "en" : "us",
        "ja" : "jp",
        "fr" : "fr",
        "de" : "de",
        "zh" : "cn",
        "it" : "it",
        "es" : "es"
    },
    _bookmarklet_langs : {
        "us" : "",
        "ca" : "enCA",
        "de" : "deDE",
        "fr" : "frFR",
        "cn" : "zhCN",
        "jp" : "jaJP",
        "uk" : "enGB",
        "it" : "itIT",
        "es" : "esES"
    },
    _locale_lang : {
        "us" : "en",
        "ca" : "en",
        "de" : "de",
        "fr" : "fr",
        "uk" : "en",
        "cn" : "zh",
        "jp" : "ja",
        "it" : "it",
        "es" : "es"
    },
    _lang_locale : {
        "en" : "us",
        "ja" : "jp",
        "fr" : "fr",
        "de" : "de",
        "zh" : "cn",
        "it" : "it",
        "es" : "es"
    },
    _locale_domain : {
        "us" : "www.amazon.com",
        "ca" : "www.amazon.ca",
        "de" : "www.amazon.de",
        "fr" : "www.amazon.fr",
        "uk" : "www.amazon.co.uk",
        "cn" : "www.amazon.cn",
        "jp" : "www.amazon.co.jp",
        "it" : "www.amazon.it",
        "es" : "www.amazon.es"
    },
    _domain_locale : {
        "amazon.com" : "us",
        "amazon.ca" : "ca",
        "amazon.de" : "de",
        "amazon.fr" : "fr",
        "amazon.co.uk" : "uk",
        "amazon.cn" : "cn",
        "amazon.co.jp" : "jp",
        "amazon.it" : "it",
        "amazon.es" : "es"
    },
    guessLocaleFromURLs : function(urls) {
        for(var i = 0; i < urls.length; i++) {
            var noProtocol = urls[i].replace(/http(s)?:\/\//,"");
            var domainPart = noProtocol.split("/")[0].replace("www.","");
            if(this._domain_locale[domainPart]) {
                return this._domain_locale[domainPart];
            }
        }
        return;
    },
    getDefaultLocale : function(browserLang) {
        var locale = browserLang || "us";

        var localeParts = locale.split("-");
        var browserLocale;
        if(localeParts.length > 1) {
            browserLocale = this._locale_defaults[localeParts[1].toUpperCase()];
            if(browserLocale) { return browserLocale; }
        }

        browserLocale = this._lang_defaults[localeParts[0]];
        if(browserLocale) { return browserLocale; }

        return "us";
    },
    getLanguageMapping : function() {
        var locale = AMZUWLXT.getLocale();
        var bookmarkletLang = this._bookmarklet_langs[locale]
            || this._bookmarklet_langs.us;
        return bookmarkletLang;        
    },
    getLocaleDomain : function() {
        var locale = AMZUWLXT.getLocale();
        var domain = this._locale_domain[locale]
            || this._locale_domain.us;
        return domain;
    },
    getLanguageFromLocale : function() {
        var locale = AMZUWLXT.getLocale();
        var language = this._locale_lang[locale]
            || this._locale_lang.us;
        return language;
    }
};

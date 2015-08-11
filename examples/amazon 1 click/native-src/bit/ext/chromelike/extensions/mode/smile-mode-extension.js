var factory = function(
    _,
    QueryStringMap
) {

    var requestIDMap = {};
    var addRefToRedirectURl = function (url){
        //TODO: To generate this REF marker server side and plumb it in through localStorage
        var refTag =  'bit_abba-chrome_1ba-cr_rdirct';
        // Url having ref marker are of two types
        // 1: http://www.amazon.com/s/ref=nb_sb_ss23232_c_1_6?url=search-alias&field-keywords=kindle&sprefix=kindle
        // 2:  http://www.amazon.com/b?ie=UTF8&node=365206031&ref_=sns_sc

        //check if url has search delimiter, if not add and return new url
        var searchDelimiterIndex = url.indexOf("?");
        if(searchDelimiterIndex === -1){
            //if no search delimiter found, attach ref tag directly at the end
            //Edge case: Url of type amazon.com/gp/abc/ref=oldrefmarker will be redirected to amazon.com/gp/abc/ref=oldrefmarker?ref_=bit_abba-chrome_1ba-cr_rdirct
            return url + "?ref_=" + refTag;
        } else {
                var host = url.substr(0, searchDelimiterIndex);
                var queryParamsWithSeachDelimiter = url.substr(searchDelimiterIndex);
                var queryStringMap = new QueryStringMap({
                    queryString:queryParamsWithSeachDelimiter
                });
                if (queryStringMap.get("ref_")){
                    //Case: when url has ref_=
                    // When both /ref=<ref marker> and ref_=<ref marker> exist in same url, ref_=<ref marker> will be give higher precedence
                    queryStringMap.set("ref_",refTag);
                    return host + queryStringMap.toQueryString();
                } else if (host.indexOf("\/ref=") > -1){
                    //case: when url has host/ref=<some ref>?key=value
                    var refIndex = host.indexOf("\/ref=");
                    var hostWithoutRefTag = host.substr(0,refIndex);
                    return hostWithoutRefTag + "/ref=" + refTag + queryParamsWithSeachDelimiter;
                } else {
                    //No ref present
                    queryStringMap.set("ref_", refTag);
                    return host + queryStringMap.toQueryString();
                }
        }

    };
    var SmileModeExtension = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(SmileModeExtension.prototype, {
        initialize: function() {},
        _requestsToRedirect:{},
        options:{
            requestHeaders:{
                filter:{urls: ["*://www.amazon.com/*","*://pre-prod.amazon.com/*"]},
                permission:["requestHeaders", "blocking"]
            },
            requestsRedirect:{
                filter:{urls: ["*://www.amazon.com/*","*://pre-prod.amazon.com/*"]},
                permission:["responseHeaders", "blocking"],
            },
            webRequestHeaders: function(details){
                /* get current referrer, to be consumed  in webPageRedirect */
                var length = details.requestHeaders.length;
                for (var itr = 0; itr < length; itr++) {
                    if (details.requestHeaders[itr].name === 'Referer') {
                        requestIDMap['referer'] = details.requestHeaders[itr].value;
                        return;
                    }
                }
            }
        },
        webPageRedirect: function(details) {
            /* don't redirect if page's has referrer (excluding links from PComp) 
            * PComp review link have referrer as amazon.com/gp/ubp/oneButton/PC/popover? and amazon.com/gp/ubp/oneButton/PC/stripe?
            * So above two referrer are allowed to redirect
            */
            if(requestIDMap['referer'] && requestIDMap['referer'].indexOf("oneButton\/PC\/") === -1){
                requestIDMap = {}; /* clear requestId list */
                return;
            }
            /*
                Latest changes: We have decided to drop redirect logic for now
                but we will redirect link only from PComp because PComp does not rely on ubp_root
            */

            if(details.url.indexOf("ref=bit_") === -1 && details.url.indexOf("ref_=bit_") === -1){
                //Return if link is not from PComp
                return;
            }

            /* url having sa-no-redirect= or redirect=true or redirect.html should not be redirect,
            * otherwise it may lead to infinite loop end with page will try to load forever,
            * if user is not signed-in cloudplayer and wishlist redirected to www.amazon.com which may again
            * end-up with loading forever because of an infinite redirect . When a page on smile-site is not  white listed for non-recognized customer
            * then page is again redirect to www.amazon.com with pldnSite=1 so ignore redirect when pldnSite=1 is present in url
            * */
            /* Don't redirect pages that are in meets below filter */

            var filter = "(sa-no-redirect=)|(redirect=true)|(redirect.html)|(/gp/dmusic/cloudplayer)|(/gp/wishlist)|(pldnSite=1)";
            if (details.url.match(filter) !== null) {
                return;
            }
            var newUrl;
            if (details.url.indexOf("www.amazon.com") !== -1 ){
                var match = details.url.match(/^(http|https):\/\/www.amazon.com\/([\S\s]*)/);
                newUrl = match[1] + "://smile.amazon.com/" + match[2];
                //Uncomment below for ref marker modification in redirected url
                //newUrl = addRefToRedirectURl(newUrl);
                return {redirectUrl:newUrl};
            } else if (details.url.indexOf("pre-prod.amazon.com") !== -1){
                var match = details.url.match(/^(http|https):\/\/pre-prod.amazon.com\/([\S\s]*)/);
                var newUrl = match[1] + "://smile-preprod.amazon.com/" + match[2];
                //Uncomment below for ref marker modification in redirected url
                //newUrl = addRefToRedirectURl(newUrl);
                return {redirectUrl:newUrl};
           }
        }
    });
    return SmileModeExtension;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/query-string-map")
    );
} else if (typeof define !== "undefined") {
    define([ "underscore", "bit/commons/query-string-map" ], factory);
}



var getFirstChild = function(n) {
    for(var i = 0; i < n.childNodes.length;i++) {
        if(n.childNodes[i].nodeType === 1) {
            return n.childNodes[i];
        }
    }
};
       
var getNodesFromHTML = function(html) {
    var d = document.createElement("div");
    if(document.doctype &&
       document.doctype.publicId &&
       document.doctype.publicId.match(/xhtml/i) &&
       document.doctype.publicId.match(/strict/i)) {

        html = html.replace(/<img(.*)?>/ig,"<img$1/>");
        html = html.replace(/<br(.*?)>/ig,"<br$1/>");
        html = html.replace(/&nbsp;/ig,"&#160;");

    }
    d.innerHTML = html;
    return getFirstChild(d);
};

if(!window.location.toString().match(/^chrome-extension/) &&
      AMZUWLXT.canPushDown(document.body,{})) {

    chrome.extension.sendRequest({command : "pushdown"}, function(response) {
        var pushDownDiv = getNodesFromHTML(response.pushDownHtml);
        var expanderDiv = getNodesFromHTML(response.expanderHtml);
        AMZUWLXT.runPushDown(window,
                             document,
                             pushDownDiv,
                             expanderDiv,
                             function() {
                                 chrome.extension.sendRequest({
                                     command : "markPushed"
                                 });
                             });
    });
}


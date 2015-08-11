var notifyIsDetail = function() {
    chrome.extension.sendRequest(
        {
            "command" : "detailPageNotify"
        }
    );
};

chrome.extension.sendRequest(
    {
        "command" : "shouldMessage"
    },
    function(run) {
        if(run) {
            AMZUWLXT.runPage(window,notifyIsDetail);

        }
    }
);


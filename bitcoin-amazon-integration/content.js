chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

    if (msg.text ) {
        
        if (msg.text == "get_product") {
            var scr = document.createElement('script')
            document.body.appendChild(scr).src = chrome.extension.getURL('inject.js');
            window.addEventListener("BitcoinProductDescription", handleEvent );
            scr.parentNode.removeChild(scr);
        }
    }   

});

function handleEvent(e) {
    var product = populate(e.detail.passback);
    console.log(product)
    chrome.runtime.connect().postMessage({ product: product })
}

function populate(product) {
    if (product) {
        product.price = $('#priceblock_ourprice').text()
        product.title = $('#productTitle').text()
        product.image = $('#imageBlock').find('img').attr('src')
    }
    return product   
}
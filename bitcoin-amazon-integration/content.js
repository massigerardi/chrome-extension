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
    chrome.runtime.connect().postMessage({ product: product })
}

function populate(product) {
    if (product) {
        product.title = $('#productTitle').text()
        if ($('#priceblock_ourprice').length) {
            product.price = $('#priceblock_ourprice').text()
        } else if ($('.offer_price').length) {
            product.price = $('.offer_price').text()
        } else if ($('#priceblock_saleprice').length) {
            product.price = $('#priceblock_saleprice').text()
        } else if ($('#priceblock_dealprice').length) {
            product.price = $('#priceblock_dealprice').text()
        } else {
            product.active = false
        } 
        if ($('#imageBlock').length && $('#imageBlock').find('img')) {
            product.imagesrc = $('#imageBlock').find('img').attr('src')
        } else {
            product.imagesrc = chrome.extension.getURL('images/wrong.png')
        }
    }
    return product
}
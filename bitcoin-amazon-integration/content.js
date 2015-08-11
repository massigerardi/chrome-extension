chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

    if (msg.text ) {
        
        if (msg.text == "prepare_code") {
            
        }

        if (msg.text == "get_code") {
            document.body.appendChild(document.createElement('script')).src='http://localhost:8080/examples/js/inject.js'
            
            var product = {
                desc: document.getElementById('bitcoin_desc').textContent,
                code: document.getElementById('bitcoin_asin').textContent
            }
            sendResponse(product);
        }


        if (msg.text == "get_price") {
            sendResponse(document.getElementById('priceblock_ourprice').textContent);
        }

        if (msg.text == "get_product") {
            sendResponse(document.getElementById('productTitle').textContent);
        }

        if (msg.text == "get_image") {
            sendResponse(document.getElementById('landingImage').src);
        }
    }   

});
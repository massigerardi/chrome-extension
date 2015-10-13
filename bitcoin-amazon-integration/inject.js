
var product = getProductDescription()

var event = document.createEvent("CustomEvent");  
event.initCustomEvent("BitcoinProductDescription", true, true, {"passback":product});
window.dispatchEvent(event);

function getProductDescription() {
    var descriptions = {}
    var active = true
    var cartCode = document.getElementById('ASIN').value;
    if (typeof twisterController != "undefined") {
        var code = twisterController.twisterModel.twisterState.currentASIN
        if (cartCode != code) {
            active = false
        } else {
            var ddm = twisterController.twisterModel.viewHandle.dimensionDisplayMap;
            var dimvals = twisterController.twisterVariationsData.dimensionValuesDisplay[twisterController.twisterModel.twisterState.currentASIN];
            for (var i=0;i<ddm.length;i++){
                descriptions[ddm[i]] = dimvals[i];
            };
        }
    }
    var product = {
        active: active,
        descriptions: descriptions,
        code: cartCode,
        price: 'EUR 0.0',
        btcprice: 0.0,
        title: '',
        imagesrc: '',
        url: ''
    }
    return product
}
    
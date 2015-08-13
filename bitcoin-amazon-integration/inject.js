
var product = getProductDescription()

var event = document.createEvent("CustomEvent");  
event.initCustomEvent("BitcoinProductDescription", true, true, {"passback":product});
window.dispatchEvent(event);

function getProductDescription() {
    var mmap = ""
    var code = ""
    var active = true
    var message = ''
    var cartCode = document.getElementById('ASIN').value;
    if (typeof twisterController != "undefined") {
        code = twisterController.twisterModel.twisterState.currentASIN
        if (cartCode != code) {
            code = ''
            message = 'Please, select a valid product'
            active = false
        } else {
            var ddm = twisterController.twisterModel.viewHandle.dimensionDisplayMap;
            var dimvals = twisterController.twisterVariationsData.dimensionValuesDisplay[twisterController.twisterModel.twisterState.currentASIN];
            for (var i=0;i<ddm.length;i++){
                mmap += ("\n"+ddm[i]+": "+dimvals[i]);
            };
        }
    } else {
        code = cartCode
    }
    var product = {
        active: active,
        desc: mmap,
        code: code,
        price: 'EUR 0.0',
        title: '',
        image: '',
        message: message

    }
    return product
}
    
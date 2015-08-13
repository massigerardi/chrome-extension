
var product = getProductDescription()

var event = document.createEvent("CustomEvent");  
event.initCustomEvent("BitcoinProductDescription", true, true, {"passback":product});
window.dispatchEvent(event);

function getProductDescription() {
    var ddm = twisterController.twisterModel.viewHandle.dimensionDisplayMap;
    var dimvals = twisterController.twisterVariationsData.dimensionValuesDisplay[twisterController.twisterModel.twisterState.currentASIN];
    var mmap = "";
    for (var i=0;i<ddm.length;i++){
        mmap += ("   " + ddm[i]+": "+dimvals[i]+"\n");
    };
    var code = twisterController.twisterModel.twisterState.currentASIN
    var product = {
        desc: mmap,
        code: code,
        price: 'EUR 0.0',
        title: '',
        image: ''

    }
    return product
}
    
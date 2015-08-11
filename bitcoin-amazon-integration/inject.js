console.log("I am in")        
var ddm = twisterController.twisterModel.viewHandle.dimensionDisplayMap;
var dimvals = twisterController.twisterVariationsData.dimensionValuesDisplay[twisterController.twisterModel.twisterState.currentASIN];
var mmap = "";
for (var i=0;i<ddm.length;i++){
    mmap += ("   " + ddm[i]+": "+dimvals[i]+"\n");
};
var desc = document.createElement("span")
desc.textContent = mmap
desc.id = "bitcoin_desc"
var asin = document.createElement("span")
asin.id = "bitcoin_asin"
asin.textContent = twisterController.twisterModel.twisterState.currentASIN
document.body.appendChild(desc)
document.body.appendChild(asin)
(function() {
var version = "1.0.0.10";

if( localStorage ) {

   if(!localStorage["uwlVersion"]) {
       localStorage["uwlVersion"] = version;
       AMZUWLXT.Settings.set({"pushInterval" : 0});
       AMZUWLXT.Settings.set({"pushDate" : new Date()});

       AMZUWLXT.setLocale(true);

   } else if( localStorage["uwlVersion"] != version ) {
       localStorage["uwlVersion"] = version;
   }

}
})();

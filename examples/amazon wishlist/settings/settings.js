
window.onload = function() {

    var content = document.getElementById("content");

    content.innerHTML = 
        AMZUWLXT.Strings.process(
            content.innerHTML,
            {
                "language" : AMZUWLXT.Locale.getLanguageFromLocale(),
                "locale" : AMZUWLXT.Settings.get().locale
            });


    var titleEncoder = document.createElement("div")
    titleEncoder.innerHTML = AMZUWLXT.Strings.process(document.title);
    document.title = titleEncoder.textContent;



    var submit = document.getElementById("submit");
    var saved = document.getElementById("saved");

    var stagedSettings = AMZUWLXT.Settings.get();
    var settingsMapping = {
        notify : document.getElementById("notify"),
        push : document.getElementById("push"),
        pushed : document.getElementById("pushed"),
      	pushInterval : document.getElementById("pushInterval"),
        pushDate : document.getElementById("pushDate"),
        locale : document.getElementById("locale")
    };

    var updateSubmitDisplay = function() {
        if(AMZUWLXT.Settings.equals(stagedSettings)) {
            submit.style.cursor = "default";
            submit.style.opacity = 0.5;
            submit.disabled = true;
        } else {
            submit.style.cursor = "pointer";
            submit.style.opacity = 1;
            submit.disabled = false;
        }
    };

    var elementChange = function() {
        if(this.type == "checkbox") {
            stagedSettings[this.id] = this.checked;
        } else {
            stagedSettings[this.id] = this.value;
        }
        updateSubmitDisplay();
        saved.style.display = "none";
    };

    var localeChanged = function(oldLocale) {
        var settings = AMZUWLXT.Settings.get();
        if(!settings.localeChanged) {

            var domain = AMZUWLXT.Locale.getLocaleDomain();
            var xhr = new XMLHttpRequest();


            xhr.open('GET', 'https://' + 
                     domain + 
                     '/wishlist/uwlhit/localechange/ref=cm_wlext_dc_chr_' +
                     oldLocale + 
                     '?ext=chr', true);

            xhr.send(null);
            AMZUWLXT.Settings.set({"localeChanged" : true});
        }
        var hasSubmitted = AMZUWLXT.Settings.get().localeChanged;
    };

    var submitForm = function() {
        if(!submit.disabled) {
            var before = AMZUWLXT.Settings.get();
            AMZUWLXT.Settings.set(stagedSettings);

            if(before.locale !== stagedSettings.locale) {
                localeChanged(before.locale);
            }

            stagedSettings = AMZUWLXT.Settings.get();

            updateSubmitDisplay();
            saved.style.display = "inline";
        }
    };

    for(var i in stagedSettings) {
        if(stagedSettings.hasOwnProperty(i) && settingsMapping[i]) {
            if(settingsMapping[i].type == "checkbox") {
                settingsMapping[i].checked = stagedSettings[i];
            }

            if(settingsMapping[i].tagName.match(/select/i) || settingsMapping[i].type == "text") {
                
                settingsMapping[i].value = stagedSettings[i];
            }
            settingsMapping[i].onchange = elementChange;
        }
    }



    submit.onclick = submitForm;
    updateSubmitDisplay();

};





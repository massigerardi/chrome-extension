
if(window.AMZUWLXT === undefined) {
    AMZUWLXT = {};
}

AMZUWLXT.Settings = {

    defaults : {
        "pushed" : {
                    "type" : "boolean",
                    "value" : false
        },
        "push" : {
                  "type" : "boolean",
                  "value" : false
        },
        "pushDate" : {
                      "type" : "date",
                      "value" : ""
        },
        "pushInterval" : {
                       "type" : "number",
                       "value" : 0
        },
        "notify" : {
                    "type" : "boolean",
                    "value" : true
        },
        "locale" : {
                    "type" : "string",
                    "value" : "us"
        },
        "localeChanged" : {
                           "type" : "boolean",
                           "value" : false
        },
    },
    validation : {
        "locale" : {
            "us" : 1,
            "de" : 1,
            "fr" : 1,
            "ca" : 1,
            "jp" : 1,
            "uk" : 1,
            "cn" : 1,
            "it" : 1,
            "es" : 1
        }
    },
    get : function() {
        var settings = {};

        if(localStorage.settings) {
            settings = JSON.parse(localStorage.settings);
        }

        for(var i in this.defaults) {
            if( this.defaults.hasOwnProperty(i)) {
                if(settings[i] === undefined) {
                    settings[i] = this.defaults[i].value;
                }
                if(this.validation[i]) {
                    if(!this.validation[i].hasOwnProperty(settings[i])) {
                        settings[i] = this.defaults[i].value;
                    }
                } else if (this.defaults[i].type == "date") {
                    settings[i] = new Date(settings[i]); 
                } else if (this.defaults[i].type == "number") {
                } else {
                    settings[i] = (settings[i] ? true : false);
                }
            }
        }

        return settings;

    },

    set : function(writeSettings) {
        var currentSettings = this.get();

        for(var i in this.defaults) {
            if( this.defaults.hasOwnProperty(i) ) {
                if(writeSettings[i] !== undefined) {
                    if(this.validation[i] && this.validation[i].hasOwnProperty(writeSettings[i])) {
                        currentSettings[i] = writeSettings[i];
                    } else if ((this.defaults[i].type == "date") || (this.defaults[i].type == "number")) {
                        currentSettings[i] = writeSettings[i];
                    } else {
                        currentSettings[i] = (writeSettings[i] ? true : false);
                    }
                }
            }
        }

        localStorage.settings = JSON.stringify(currentSettings);
    },

    equals : function(compareSettings) {
        var curSettings = this.get();
        for(var i in this.defaults) {
            if( this.defaults.hasOwnProperty(i) ) {

                if (this.defaults[i].type == "date") {
                    if (compareSettings[i] != curSettings[i].toString()) {
                        return false;
                    }
                } else if (compareSettings[i] != curSettings[i]) {
                    return false;
                }
            }
        }
        return true;
    }
};





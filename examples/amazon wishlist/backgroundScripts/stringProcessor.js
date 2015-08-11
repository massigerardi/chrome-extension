
if(window.AMZUWLXT === undefined) {
    AMZUWLXT = {};
}

if(AMZUWLXT.Strings === undefined) {
    AMZUWLXT.Strings = {};
}


AMZUWLXT.Strings.process = function(content, vars) {

    var locale = AMZUWLXT.getLocale();
    
    if(vars === undefined) {
        vars = {};
    }
    var stringRegex = /string\((.*?)\)/gm;
    var results = content.replace(stringRegex, function(s) {
        var str = AMZUWLXT.Strings.lookup(
                /string\((.*?)\)/m.exec(s)[1]);
        return str;
    });

    results = results.replace(/\$(?:\{|%7B)(.*?)(?:\}|%7D)/gm, function(v) {
            var key = /\$(?:\{|%7B)(.*?)(?:\}|%7D)/m.exec(v)[1];
            return ((vars && vars[key]) || ":NO_VAR:");
    });

    return results;
};


AMZUWLXT.Strings.lookup = function(string) {
    var str = AMZUWLXT.Strings.strings &&
        AMZUWLXT.Strings.strings[string];

    var language = AMZUWLXT.Locale.getLanguageFromLocale();

    return (typeof str === "string" && str) ||
        str && str[language] ||
        ":ERROR:" + string;
};






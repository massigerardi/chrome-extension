var factory = function() {
    return {
        "localeRegex": "www\.amazon\.(com|ca|co\.uk|it|fr|es|de|cn|co\.jp)"
    };
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}

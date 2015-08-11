var factory = function(
    $lang
) {

    var ProcessState = $lang.pojoKlass([
        "pid",
        "process",
        "healthChecker",
        "healthCheckListener"
    ]);

    return ProcessState;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("bit/commons/lang")
    );
} else if (typeof define !== "undefined") {
    define([
        "bit/commons/lang"
    ], factory);
}

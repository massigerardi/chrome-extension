var factory = function() {
    var uuid = {
        // See: http://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_.28random.29
        v4: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0;

                // r & 0x3 | 0x8 coerces any R value to one of:
                // 0b01000 (0x8)
                // 0b01001 (0x9)
                // 0b01010 (0xA)
                // 0b01011 (0xB)
                //
                // Because:
                // 0x3       = 0b00011
                // 0x8       = 0b01000
                // 0x3 | 0x8 = 0b01011
                // r & 0x3   = (0b00000 | 0b00001 | 0b00010 | 0b00011)

                var v = (c == 'x' ? r : (r & 0x3 | 0x8));
                return v.toString(16);
            });
        }
    };
    return uuid;
};


if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}

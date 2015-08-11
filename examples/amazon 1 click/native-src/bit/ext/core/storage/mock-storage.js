/*
Provides a mock native-storage for unit testing. 

Uses a JS object to store key value pairs. Using . notation within the key doesn't nest,
simply means the key contains a '.'. E.g. set('options.a','string1') and set('options.b','string2') will results in an object of
{
    'options.a' : 'string1' , 'options.b' : 'string2'
}
For some tests this is fine, but not OK for others. Please make sure your tests are compatible with this.

The API conforms to the interface that is defined in simple-storage.js:
    get(key, cb)
        cb has signature:
            cb(result)
    set(key, value, cb)
        cb has signature:
            cb()
    clear()
Additionally, a remove method is added for convenience. 
    remove(key,cb)
    cb has signature:
            cb()

usage: 

var mockNS = new MockNativeStorage ({somePredefinedKey : 'value', AnotherKey : 'and more values'});
mockNS.get('somePredefinedKey',function(err,result) {
    if (result['somePredefinedKey'] === 'value') {
        console.log('this will print');
    } else {
        console.log('this will not');
    }
});

*/

var factory = function() {

    var MockNativeStorage = function() {
        this.initialize.apply(this, arguments);
    };

    MockNativeStorage.prototype = {
        initialize: function(map) {
            //pass in a map to initialize what's in storage
            this._storage = map || {};
        },
        get: function(k, cb) {
            var value = undefined,
                data = {};
            if (this._storage.hasOwnProperty(k)) {
                value = this._storage[k];
            }
            data[k] = value;
            cb(data);
        },

        set: function(m, cb) {
            for (var key in m) {
                this._storage[key] = m[key];
            }
            cb();
        },

        remove : function (k,cb) {
            if (this._storage.hasOwnProperty(k)) {
                delete this._storage[k];
            }
            cb();
        },

        clear : function () {
            this._storage = {};
        }
    };

    return MockNativeStorage;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}



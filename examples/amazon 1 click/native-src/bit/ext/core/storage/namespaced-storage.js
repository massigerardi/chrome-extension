/*
    Usage:

    var namespacedStorage = new NamespacedStorage({namespace: "Dr-Seuss",simpleStorage:$simpleStorage});

    namespacedStorage.getMultipleAsync(['oneFish','twoFish','redFish','blueFish'])
    .then(function (object){
        console.log(object['oneFish']); //logs whatever the value for 'oneFish' is.
    })

    .then(function () {
        return namespacedStorage.setMultipleAsync({'oneFish':141511, 'twoFish':false});
    })
    .then(function () {
        return namespacedStorage.getAsync('oneFish');
    })
    .then(function (value) {
        console.log(value); //logs '141511'
    });
    
    Inside of the native-storage object, the keys will actually all be prefixed with "Dr-Seuss."
    
    If you want stuff from a namespace other than your own, then this isn't what you want to use. 

    @exports NamespacedStorage class

*/

var factory = function(
    _,
    Promise,
    $options
    ) {

    var NamespacedStorage = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(NamespacedStorage.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts,"Instantiating NamespacedStorage");
            this._simpleStorage = opts.getOrError("simpleStorage");
            this._namespace = opts.getOrError("namespace");
        },
        get: function(k, cb) {
            this._simpleStorage.get(this._makeKeyObject(k),cb);
        },
        getMultiple: function (keys,cb) {
            //keys looks like: [keystring1,keystring2,keystring3...]
            var promiseGetArray = [];
            var keysLength = keys.length;

            for (var keyIndex = 0 ; keyIndex < keysLength ; keyIndex++) {
            //  Insert each getAsync promise to the end of the promise array.
                promiseGetArray.push(
                    this._simpleStorage.getAsync(
                        this._makeKeyObject(keys[keyIndex])
                ));
            }

            Promise.all(promiseGetArray).bind(this)
            .then(function (results) {
                //results contains an array of all the values
                cb(null,_.object(keys,results));
            })
            .catch(function (err) {
                cb(err);
            })
        },

        set: function(k, v, cb) {
            this._simpleStorage.set(this._makeKeyObject(k),v,cb);
        },

        setMultiple: function (keyValueCollection,cb) {
            //keyValueCollection looks like: {keyName1 : value1, keyName2 : value2, etc...}
            var promiseSetArray = [];

            for (var key in keyValueCollection) {
                promiseSetArray.push(
                    this._simpleStorage.setAsync(
                        this._makeKeyObject(key) , keyValueCollection[key]
                ));
            }

            Promise.all(promiseSetArray).bind(this)
            .then(function (){
                cb(null);
            })
            .catch(function (err) {
                cb(err);
            });
        },

        _makeKeyObject: function (key) {
            return {namespace: this._namespace, key: key};
        },

        getNamespace: function () {
            return this._namespace;
        }

    });

    Promise.promisifyAll(NamespacedStorage.prototype);
    return NamespacedStorage;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options")

    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options"
    ], factory);
}



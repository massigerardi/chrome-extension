var factory = function(
    _,
    Promise,
    $options,
    $uuid 
) {
    "use strict";
    
    var GUIDManager = function () {
        this.initialize.apply(this, arguments);
    };

    _.extend(GUIDManager.prototype, {
        initialize : function(opts) {
            opts = $options.fromObject(opts);
            this.simpleStorage = opts.getOrError("simpleStorage");
            this._guid = undefined;
        },
        getGUIDAsync : function () {
            return Promise.bind(this)
            .then(function () {
                if (this._guid) {
                    //If we have the guid, just return it.
                    return this._guid;

                } else {
                    //start a new promise chain.
                    return Promise.bind(this)
                    .then(function () {
                        //check if the guid is in storage under the normal storage location
                        return this.simpleStorage.getAsync('guid');
                    })
                    .then(function(guid){
                        if (guid) {
                            //if it is, set our internal variable, and then return.
                            //this concludes the current Promise chain 
                            this._guid = guid;
                            return this._guid;//This breaks out of current Promise chain.
                        }
                        //If the guid isn't in the normal storage location, then start a new workflow
                        //that first checks if it's stored in the legacy firefox location, or doesn't exist.
                        return Promise.bind(this)
                        .then(function(){
                            //check the firefox guid storage location
                            return this.simpleStorage.getAsync('GUID');
                        })
                        .then(function(ffGUID){
                            if (ffGUID) {
                                //if the legacy FF guid is there, save it to the internal variable
                                this._guid = ffGUID;
                            }
                            return;
                        })
                        .then(function (){
                            if (this._guid === undefined) {
                                //if there was no ffGUID, then generate a new one.
                                this._guid = $uuid.v4();
                            }
                            //regardless of whether we just made one, or got it from the legacy storage location,
                            //save it to the new location
                            return this.simpleStorage.setAsync('guid',this._guid);
                        })
                        .then(function (){
                            //once stored, return it.
                            return this._guid;
                        });
                    });
                }
            });
        }
    });
    return GUIDManager;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/uuid")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/uuid"
    ], factory);
}
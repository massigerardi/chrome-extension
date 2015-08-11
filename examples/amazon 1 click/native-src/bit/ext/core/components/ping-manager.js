/*
Ping-manager is responsible for handling all the logic necessary for determining if a ping should be sent
after its respective method is called. Main.js implements firstClickPing, dailyPing, installPing, and ubpEngagementPing.
Ping-manager determines if the ping should be sent based on the conditions (e.g. installPing and firstClickPing
only occur if they've never occurred before). 
Ping-manager also contains general-purpose ping functions in case other modules wish to implement their own custom
pings, with options for exponential backoff and number of retries. 
*/
var factory = function(
    _,
    Promise,
    $options,
    TaskManager
) {

    "use strict";
//TODO: Change Promise chains to match the Promise.bind({..}) style
//Intervals and retries
    var TEST_PING_INTERVAL = 1000 *60 *10, //10 minutes 
        TEST_RETRY_BACKOFF_FACTOR = 1.2,
        TEST_PING_RETRY = 1000 *10; //10 seconds

    var MAX_RETRIES = 10;

    var NUM_HOURS_FOR_PING_INTERVAL = 24; // 24hr/1day for now <----change this
                        //1s  1m  1h
    var PING_INTERVAL = 1000 *60 *60 *NUM_HOURS_FOR_PING_INTERVAL; // <--- not this
    var POLL_INTERVAL = 1000 *60 *60 *5; //poll every five hours

    var NUM_MINUTES_FOR_RETRY = 1; // a minute for now. <---change this to tune retry 
                              //1s  1m
    var INITIAL_PING_RETRY_INTERVAL = 1000 *60 *NUM_MINUTES_FOR_RETRY; // not this <-----
    var PING_RETRY_BACKOFF_FACTOR = 2; 

    var STARTUP_CHECK_RETRY = 1000 *60 *3; //three minutes
/*
    INITIAL_PING_RETRY_INTERVAL = TEST_PING_RETRY;//<-- for testing
    PING_INTERVAL = POLL_INTERVAL = TEST_PING_INTERVAL; // <--uncomment to test [for testing]
    PING_RETRY_BACKOFF_FACTOR = TEST_RETRY_BACKOFF_FACTOR; //TESTING
*/
//end
//Endpoints
    var DAILY_PING_ENDPOINT = '/gp/ubp/misc/ping_pages/ping.html';

    var INCOMPLETE_INSTALL_PING_ENDPOINT = '/gp/ubp/misc/ping_pages/installationIncomplete_ping.html';

    var INSTALL_PING_ENDPOINT = '/gp/ubp/misc/ping_pages/install_ping.html';

    var FIRSTCLICK_PING_ENDPOINT = '/gp/ubp/misc/ping_pages/firstClick_ping.html';

    var UBP_ENGAGEMENT_ENDPOINT = '/gp/bit/metrics/log.html';
//end
//other constants
    var STORAGE_PREFIX = 'options';
//end
    var PingModule = function () {
        this.initialize.apply(this, arguments);
    };

    _.extend(PingModule.prototype, {

        initialize : function(opts) {
            opts = $options.fromObject(opts);
            this.getPingEndpointDelegate = opts.getOrError("getPingEndpointDelegate");
            this.simpleStorage = opts.getOrError("simpleStorage");
            this.xhrClient = opts.getOrError("xhrClient");
            this.messageBus = opts.getOrError("messageBus");

            this._nextDailyPingAttempt = undefined;
            this._nextInstallPingAttempt = undefined;
            this._nextFirstClickPingAttempt = undefined;

            _.bindAll(this,'dailyPing','installPing','firstClickPing','onStartUpCheck');

            this._setupMessageBus();
        },

        _convertLegacyStorageKeysToNewOnesAsync : function () {
            //copies over values from teh legacy storage locations to the new ones.
            //first get the old install ping stored under this storaged key for both FF and Chrome
            return this.simpleStorage.getAsync("options.install_ping").bind(this)
            .then(function(installPing) {
                if (this._isPopulated(installPing)) {
                    return this.simpleStorage.setAsync('options.installPing',installPing);
                }
            })
            .then(function () {
                return this.simpleStorage.getAsync('options.options.installPing');
            })
            .then(function(installPingIE) {
                if (this._isPopulated(installPingIE)) {
                    return this.simpleStorage.setAsync('options.installPing',installPingIE);
                }
            })
            .then(function () {
                return this.simpleStorage.getAsync('options.firstClick_ping');
            })
            .then(function(firstClickPingChrome) {
                //convert the old chrome first click ping storage location to the new one.
                if (this._isPopulated(firstClickPingChrome)) {
                    return this.simpleStorage.setAsync('options.firstClickPing',firstClickPingChrome);
                }
            })
            .then(function () {
                //first click storage key in FF
                return this.simpleStorage.getAsync('options.first_click');
            })
            .then(function(firstClickPingFF) {
                //do the same as the previous then block but for FF
                if (this._isPopulated(firstClickPingFF)) {
                    return this.simpleStorage.setAsync('options.firstClickPing',firstClickPingFF);
                }
            })
            .then(function () {
                //save the fact that we've exectued this function, and moved the ping info to new keys
                return this.simpleStorage.setAsync('options.movedOldStorageKeys',true);
            });
        },

        //This Promise workflow gets the firstClickPing and installPing vars
        //from storage and then calls the installPing or firstClickPing if either
        //are in a pending state.
        onStartUpCheck : function () {
            //check to see if we need to move to the old storage keys
            return this.simpleStorage.getAsync('options.movedOldStorageKeys').bind({
                pinger : this,
                params : {}
            })
            .then(function (movedOldStorageKeys) {
                if (movedOldStorageKeys === true) return;
                //convert old storage keys to new ones if we haven't
                return this.pinger._convertLegacyStorageKeysToNewOnesAsync(); 
            })
            .then(function () {
                //get firstClickPing from storage
                return this.pinger.simpleStorage.getAsync("options.firstClickPing");
            })
            /*return this.simpleStorage.getAsync("options.firstClickPing").bind({
                pinger : this,
                params : {}
            })*/
            .then(function (firstClickPing) {
                //store the firstClickPing and get installPing
                this.params.firstClickPing = firstClickPing;
                return this.pinger.simpleStorage.getAsync("options.installPing");
            })
            .catch(function(error) {
                //If there are any errors, simply wait and retry later.
                TaskManager.scheduleTask(this.pinger.onStartUpCheck,STARTUP_CHECK_RETRY);
            })
            .then(function (installPing) {
                //Check if either are pending, and call their Ping methods if they are.
                //Start up the dailyPing
                if (this.params.firstClickPing === "pending") this.pinger.firstClickPing();
                if (!this.pinger._isPopulated(installPing) || installPing === "pending") this.pinger.installPing();
                return this.pinger.dailyPing();    
            });
        },

        sendPingAsync : function(taggedEndpoint,postData) { 
            //Promisifies the xhr client calls we need to do
            //in particular, a normal get request, as well as 
            //a POST with json-formatted data.
            return new Promise(_.bind(function(fulfill,reject) {
                var xhrClientConfig;
                if (postData) xhrClientConfig = {
                        http_method : "POST",
                        headers : {
                            'Content-Type' : 'application/x-www-form-urlencoded'
                        },
                        success : fulfill ,
                        error : reject ,
                        data : postData,
                        responseType : "text"
                };
                else xhrClientConfig = {
                    //the defaults are for a normal GET, and the other config
                    //values are also what we want. 
                        success : fulfill,
                        error : reject,
                        responseType : "text"
                };
                this.xhrClient.request(taggedEndpoint,xhrClientConfig);
            },this));
        },

        //Generic scheduler that uses the setTimeout methods. 
        //Optionally accepts a timeoutIdName, which can be used for tracking
        //previously setup timeoutId trackers
        _schedulePing : function(timoutIdName,delayMs,pingFunction) {
            if (timoutIdName !== undefined) {
                try {
                    if (this[timoutIdName]) TaskManager.cancelTask(this[timoutIdName]);
                } catch(e){}
                this[timoutIdName] = TaskManager.scheduleTask(pingFunction,delayMs);  
            }
            else {
                TaskManager.scheduleTask(pingFunction,delayMs);
            }
        },
        //This is for scheduling the next daily ping (not for retrying). 
        //Calls non-underscored dailyPing method.
        scheduleFutureDailyPing : function (delayMs) { //this is for when the daily ping succeeds
            this._schedulePing('_nextDailyPingAttempt', delayMs, this.dailyPing);
        },
        //This for actually retrying the daily ping, and calls the underscored versions (i.e. private method).
        scheduleDailyPing : function(delayMs) {//this is for retrying the daily ping
            this._schedulePing('_nextDailyPingAttempt',delayMs,_.bind(function(){
                this._dailyPing(delayMs*PING_RETRY_BACKOFF_FACTOR);
            },this));
        },
        //This is for retrying the install ping, and it is assumed that the setup has been called
        //beforehand. sets a timeout for _installPingSender.
        scheduleInstallPing : function (delayMs) {//this is for retrying the install ping
            this._schedulePing('_nextInstallPingAttempt',delayMs,_.bind(function(){
                this._installPingSender(delayMs*PING_RETRY_BACKOFF_FACTOR);
            },this));
        },
        //Same as previous method but for firstClick
        scheduleFirstClickPing : function (delayMs) {//this is for retrying the first click pings
            this._schedulePing('_nextFirstClickPingAttempt',delayMs,_.bind(function(){
                this._firstClickPingSender(delayMs*PING_RETRY_BACKOFF_FACTOR);
            },this));
        },

        //returns a Promise for a generic ping e.g. it's then-able'
        //user should have a then and catch block for any errors 
        _genericPingAsync : function (relativeUrl,includeTag,postData) {
            //setup default values for POST data and include tag var's
            includeTag = includeTag || false; //default is false
            postData = (postData === undefined) ? false : postData; //if it's undefined, then default to false. otherwise use
                                                                             //whatever was passed in.
            //return async get-ping-endpoint func
            return this.getPingEndpointDelegate.getPingEndpointAsync(relativeUrl,includeTag).bind({
                pinger : this
            })
            .then(function (taggedUrl){
                //if that succeeds, we have tagged url 
                return this.pinger.sendPingAsync(taggedUrl,postData);
                //any errors will propagate to the caller. 
            });
        },

        _shouldNotYetPing : function (lastDailyPing,endpoint,currentTime) {
            //if lastDailyPing is defined, and time left is gt than interval and the type
            //of the request is the same as the last time.
            return lastDailyPing && (currentTime - lastDailyPing.timeOf < PING_INTERVAL) && lastDailyPing.typeOf ===  endpoint;
        },
        dailyPing : function () {
            //all this does is call _dailyPing with its initial value.
            return this._dailyPing(INITIAL_PING_RETRY_INTERVAL);
        },

        //This function contains all the logic for determining if the daily ping should be sent or not, 
        //and sending it if it should be sent. 
        _dailyPing : function (delayMs) {
            //get the last daily ping time from storage
            return this.simpleStorage.getAsync("options.lastDailyPing").bind({
                pinger : this,
                params : {}
            })
            .then(function (lastDailyPing){
                //collect the last daily ping object (type and time), and then get if the user has accepted the terms of use
                this.params.lastDailyPing = lastDailyPing;
                return this.pinger.simpleStorage.getAsync("options.acceptedTermsOfUse");
            })
            .then(function (acceptedTermsOfUse){ //fulfill statement for the storage promises
                //save the endpoint in params
                //check if we shouldn't ping (b/c it hasn't been long enough)
                this.params.endpoint = (acceptedTermsOfUse === false) ? INCOMPLETE_INSTALL_PING_ENDPOINT : DAILY_PING_ENDPOINT;
                if (this.pinger._shouldNotYetPing(this.params.lastDailyPing,this.params.endpoint,Date.now())) { 
                    //if we shouldn't yet send the ping, schedule for some time in the future
                    var remainingTime = PING_INTERVAL - (currentTime - this.params.lastDailyPing.timeOf);
                    //similarly, function below is not then-able, but returning value
                    return this.pinger.scheduleFutureDailyPing((remainingTime < POLL_INTERVAL) ? remainingTime : POLL_INTERVAL);
                }
                //else if we're ping ready, send the ping
                //we start the then statements inside the else block
                //because we want the if block beforehand to be the last
                //executed block if the ping isn't yet ready to be sent. 
                return this.pinger._genericPingAsync(this.params.endpoint).bind({
                    pinger : this.pinger,
                    params : this.params
                })
                .then(function(pingResponse){
                    //we don't use the pingResponse, but pass it to show what the fulfilled
                    //response is. comes from sendPingAsync in _genericPingAsync
                    
                    //Here we store the time of day, and type of endpoint
                    return this.pinger.simpleStorage.setAsync("options.lastDailyPing",{
                        timeOf : Date.now(),
                        typeOf : this.params.endpoint 
                    });
                })
                .then(function(){
                    //if set returns successfully, we schedule our next daily ping.
                    //function below never returns an error or promise, but will return
                    //its value in case one day it is 'then-able', and we need its
                    //return value to propagate. 
                    return this.pinger.scheduleFutureDailyPing(POLL_INTERVAL);
                });
            })
            .catch(function (lastError) {
                //any problems, and we try again (with exponential backoff)
                this.pinger.scheduleDailyPing(delayMs);                
            });
        },

        oneTimePingSetupWithPendingState : function (pingName){
            //get installPing var from storage
            var storageKey = STORAGE_PREFIX + '.' + pingName,
                pingSenderName = '_' + pingName + 'Sender';
            return this.simpleStorage.getAsync(storageKey).bind({
                pinger : this
            })
            .then(function(storageVar){
                //if the installPing var is defined and not equal to pending, then we've succefully
                //recorded an install ping, and we're done.
                if (this.pinger._isPopulated(storageVar) && storageVar !== "pending") return;
                //nothing below here in this then block executes if the storageVar value isn't pending.
                //else we need to set the status to pending...
                return this.pinger.simpleStorage.setAsync(storageKey,"pending").bind({
                    pinger : this.pinger
                })
                .then(function(){
                    //... if we don't have any errors, then start pinging.
                    return this.pinger[pingSenderName](INITIAL_PING_RETRY_INTERVAL);
                });
            })
            .catch(function(lastError){
                //...and if we encounter any errors along with way, restart.
                TaskManager.scheduleTask(this.pinger[pingName],INITIAL_PING_RETRY_INTERVAL);
            });
        },

        _oneTimePingSender : function (delayMs,pingName,schedulerName,endpoint,includeTag,postData) {
            return this._genericPingAsync(endpoint,includeTag,postData).bind({
                pinger : this
            })
            .then(function(response){
                //we don't use response,but should be aware that that is what
                //is returned.
                var storageKey = STORAGE_PREFIX + '.' + pingName;
                return this.pinger.simpleStorage.setAsync(storageKey,Date.now());
            })
            .catch(function(lastError){
               this.pinger[schedulerName](delayMs); 
            });
        },

        installPing : function () {
            this.oneTimePingSetupWithPendingState("installPing");
        },
        _installPingSender : function (delayMs) {
            //XXX: IMPORTANT. PLEASE READ IF YOU ARE REFACTORING OR EDITING THIS CODE.
            //For install pings we need to include the tag for marketing attribution. Since the server-side logs
            //the hit as 'dataOnly', we are not unfairly stealing OPS via this inclusion.
            this._oneTimePingSender(delayMs,"installPing","scheduleInstallPing",INSTALL_PING_ENDPOINT,true);
        },
        firstClickPing : function () {
            this.oneTimePingSetupWithPendingState("firstClickPing");
        },
        _firstClickPingSender : function (delayMs) {
            this._oneTimePingSender(delayMs,"firstClickPing","scheduleFirstClickPing",FIRSTCLICK_PING_ENDPOINT,true);
        },

        //external API method. simply a wrapper. 
        otherPingAsync : function (endpoint,includeTag,postData) {
            return this._genericPingAsync(endpoint,includeTag,postData);
        },

        otherPingWithRetriesAsync : function (endpoint,delayMs,retries,exponentialBackoffFactor,includeTag,postData) {
            return new Promise (_.bind(function (fulfill,reject) {
                //set the defaults for retries and delayMs
                exponentialBackoffFactor = (exponentialBackoffFactor === undefined) ? PING_RETRY_BACKOFF_FACTOR : exponentialBackoffFactor;
                retries = (retries !== undefined && retries <= MAX_RETRIES) ? retries : MAX_RETRIES;
                delayMs = (delayMs === undefined) ? INITIAL_PING_RETRY_INTERVAL : delayMs;
                return this._genericPingAsync(endpoint,includeTag,postData).bind({
                    pinger : this
                })
                .then(function(response){
                    //if the request was successful, return the response
                    fulfill(response);
                })
                .catch(function(lastError){
                    //decrement retries
                    --retries;
                    if (retries < 0) {
                        //if we're all out of retries, then reject the promise
                        reject(new Error("Ping failed to send even after all retries. Value of retries is "+retries));
                        //this return statement breaks out of this catch block.
                        return;
                    }
                    //new Promise chain
                    Promise.delay(delayMs).bind({//delay is like setTimeout, but maintians chain state
                        pinger : this.pinger
                    })
                    .then(function (){
                        //recursive call
                        return this.pinger.otherPingWithRetriesAsync(endpoint,delayMs*exponentialBackoffFactor,retries,exponentialBackoffFactor,includeTag,postData);
                    })
                    //return the response of the recursive call
                    .then(function(response){
                        fulfill(response);
                    })
                    //or the error
                    .catch(function(error) {
                        reject(error);
                    });
                });
            },this));
        },

        ubpEngagementPing : function (postData) {
            //                                                 endpoint     delayMs   retries   backoff  tag   data
            return this.otherPingWithRetriesAsync(UBP_ENGAGEMENT_ENDPOINT,undefined,undefined,undefined,true,postData);
        },

        _setupMessageBus : function () {
            this.messageBus.subscribe(_.bind(function (message){
                this._handleMessage(message);
            },this));
        },

        _handleMessage : function (message) {
            //if message.args.params is undefined, then it means the caller only cares about hitting the endpoint with the default parameters
            if (!message['mType'] || !message['args'] || message['mType'] !== 'Event.PingRequest') return;//if we don't have everything we need, return 
            if (message.args['ubpEngagement']) {
                //However, since the UBP engagement endpoint is fundamentally useless without sending any parameters, we'll include control statements to 
                //stop the ping from being sent, and wasting network resources.  
                if (typeof message.args['params'] !== 'undefined') this.ubpEngagementPing(message.args.params); 
            } else if (message.args['relativeUrl']) {
                //Here, it's fine if there are no parameters defined, since maybe the caller only needs the default query params (version,tagbase,date,guid)
                this.otherPingWithRetriesAsync(message.args.relativeUrl,undefined,undefined,undefined,false,message.args['params']);
            } 
        },

        _isPopulated : function (value) {
            // Check if provided value (i.e. from storage) is populated
            return (typeof value !== "undefined") &&
                    (value !== null) &&
                    (value !== "");
        }
    });
    return PingModule;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/options"),
        require("bit/commons/task-manager")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/options",
        "bit/commons/task-manager"
    ], factory);
}
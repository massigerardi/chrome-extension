/*global UBPMessageWindowProxy: true, define: false */
(function() {
    "use strict";
    var UBPMessageAPI = {};

    var UBPMessageTypes = {
        Response : "Response",
        Core_getVersion : "Core_getVersion",
        Core_getToolbarId : "Core_getToolbarId",
        Core_getTagId : "Core_getTagId",
        Core_getRunId : "Core_getRunId",
        Util_getPageUrl : "Util_getPageUrl",
        Utils_getPageTitle : "Utils_getPageTitle",
        Util_getButtonId : "Util_getButtonId",
        Util_getXPathElements : "Util_getXPathElements",
        Util_getXPathContent : "Util_getXPathContent",
        Util_getXPathContentFromNode : "Util_getXPathContentFromNode",
        Util_updateButtonProperties : "Util_updateButtonProperties",
        Util_updateSearchTerms : "Util_updateSearchTerms",
        Util_setToolbarRoot : "Util_setToolbarRoot",
        Util_getToolbarRoot : "Util_getToolbarRoot",
        Util_setOEMTag : "Util_setOEMTag",
        Util_getOEMTag : "Util_getOEMTag",
        Util_replacePlaceholders : "Util_replacePlaceholders",
        Options_getOption : "Options_getOption",
        Options_setOption : "Options_setOption",
        Mode_enable : "Mode_enable",
        Mode_disable : "Mode_disable",
        Mode_getModeStatus : "Mode_getModeStatus",
        Mode_isModeEnabled : "Mode_isModeEnabled",
        Options_isDataCollectionEnabled : "Options_isDataCollectionEnabled",
        Options_setFirstRunOptions : "Options_setFirstRunOptions",
        Options_acceptTermsOfUse : "Options_acceptTermsOfUse",
        Options_rejectTermsOfUse : "Options_rejectTermsOfUse",
        Browser_showGadgetWindow : "Browser_showGadgetWindow",
        Browser_openWindow : "Browser_openWindow",
        Browser_injectJavaScriptFromURL : "Browser_injectJavaScriptFromURL",
        Browser_injectJavaScriptFromString : "Browser_injectJavaScriptFromString",
        Browser_getInjectionShim : "Browser_getInjectionShim",
        Browser_addPageTurnListener : "Browser_addPageTurnListener",
        Browser_addUrlChangeListener : "Browser_addUrlChangeListener",
        Browser_addTabChangedListener : "Browser_addTabChangedListener",
        Browser_crossDomainXHR : "Browser_crossDomainXHR",
        Browser_showNotification : "Browser_showNotification",
        Browser_hideNotification : "Browser_hideNotification",
        Search_checkStatus : "Search_checkStatus",
        Search_add : "Search_add",
        Search_remove : "Search_remove",
        Messaging_addMessageListener : "Messaging_addMessageListener",
        Messaging_postMessage : "Messaging_postMessage",
        ClientLogs_log_message : "ClientLogs_log_message",
        DebugLogs_log_message : "DebugLogs_log_message",
        Panel_hidePanel : "Panel_hidePanel",
        Panel_resizePanel : "Panel_resizePanel",
        Wishlist_wishlistComplete : "Wishlist_wishlistComplete",
        Alerts_toasterClicked : "Alerts_toasterClicked",
        PingRequest : "PingRequest"
    };
    var UBPBadMessage = function(message) {
        return new Error(message);
    };

    var UBPHashTable = function(obj) {
        this.length = 0;
        this.items = [];
        for (var p in obj) {
            this.items[p] = obj[p];
            this.length++;
        }

        this.setItem = function(key, value) {
            var previous;
            if (this.items[key]) {
                previous = this.items[key];
            } else {
                this.length++;
            }
            this.items[key] = value;
            return previous;
        };

        this.getItem = function(key) {
            return this.items[key] ? this.items[key] : undefined;
        };

        this.removeItem = function(key) {
            if (this.items[key]) {
                var previous = this.items[key];
                this.length--;
                delete this.items[key];
                return previous;
            } else {
                return undefined;
            }
        };

        this.keys = function() {
            var keys = [];
            for (var k in this.items) {
                keys.push(k);
            }
            return keys;
        };

        this.values = function() {
            var values = [];
            for (var k in this.items) {
                values.push(this.items[k]);
            }
            return values;
        };

        this.clear = function() {
            this.items = {};
            this.length = 0;
        };
    };

    var UBPMessage = {
        createMessage : function(type, options) {
            var message = {
                type : "Generic",
                version : "v1",
                id : "unknown",
                createTime : 0
            };
            message.id = UBPMessage.uuid();
            message.options = options;
            message.type = type;
            message.createTime = Date.now();
            if (type === UBPMessageTypes.Response) {
                message.to = 'remote';
            } else {
                message.to = 'local';
            }
            return message;
        },
        validateMessage : function(message) {
            if ( typeof (message) === "undefined") {
                throw new UBPBadMessage("message undefined");
            }
            if ( typeof (message.id) === "undefined" || message.id === "unknown") {
                throw new UBPBadMessage("id undefined");
            }
            if ( typeof (message.version) === "undefined" || message.version !== "v1") {
                throw new UBPBadMessage("message version undefined");
            }
            if ( typeof (message.type) === "undefined") {
                throw new UBPBadMessage("message type undefined");
            }
            var validType = false;
            for (var type in UBPMessageTypes) {
                if (UBPMessageTypes[type] === message.type) {
                    validType = true;
                }
            }
            if (!validType) {
                throw new UBPBadMessage("unknown message type: " + message.type);
            }
            if ( typeof (message.options) === "undefined") {
                throw new UBPBadMessage("unknown message type: " + message.type);
            }
            if ( typeof (message.options.success) !== "undefined" && typeof (message.options.success) !== "function") {
                throw new UBPBadMessage("success callback type must be function");
            }
            if ( typeof (message.options.error) !== "undefined" && typeof (message.options.error) !== "function") {
                throw new UBPBadMessage("error callback type must be function");
            }
            var options = message.options;

            /**
             * Validate the option block parameters
             */
            switch (message.type) {
                case UBPMessageTypes.Core_getVersion:
                    break;
                case UBPMessageTypes.Core_getToolbarId:
                    break;
                case UBPMessageTypes.Core_getTagId:
                    break;
                case UBPMessageTypes.Core_getRunId:
                    break;
                case UBPMessageTypes.Util_getPageUrl:
                    break;
                case UBPMessageTypes.Utils_getPageTitle:
                    break;
                case UBPMessageTypes.Util_getButtonId:
                    break;
                case UBPMessageTypes.Util_getXPathElements:
                    if ( typeof (options.xpath) === "undefined") {
                        throw new UBPBadMessage("error no xpath defined");
                    }
                    break;
                case UBPMessageTypes.Util_getXPathContent:
                    if ( typeof (options.xpath) === "undefined") {
                        throw new UBPBadMessage("error no xpath defined");
                    }
                    break;
                case UBPMessageTypes.Util_getXPathContentFromNode:
                    if ( typeof (options.node) === "undefined") {
                        throw new UBPBadMessage("error DOM Node undefined");
                    }
                    break;
                case UBPMessageTypes.Util_updateButtonProperties:
                    if ( typeof (options.properties) === "undefined") {
                        throw new UBPBadMessage("error button properties undefined");
                    }
                    break;
                case UBPMessageTypes.Util_updateSearchTerms:
                    if ( typeof (options.searchTerm) === "undefined") {
                        throw new UBPBadMessage("error searchTerm undefined");
                    }
                    break;
                case UBPMessageTypes.Util_setToolbarRoot:
                    if ( typeof (options.root) === "undefined") {
                        throw new UBPBadMessage("toolbar root undefined");
                    }
                    break;
                case UBPMessageTypes.Util_getToolbarRoot:
                    break;
                case UBPMessageTypes.Util_setOEMTag:
                    if ( typeof (options.oemid) === "undefined") {
                        throw new UBPBadMessage("oemid undefined");
                    }
                    break;
                case UBPMessageTypes.Util_getOEMTag:
                    break;
                case UBPMessageTypes.Util_replacePlaceholders:
                    if ( typeof (options.stringToExpand) === "undefined") {
                        throw new UBPBadMessage("string to expand undefined");
                    }
                    break;
                case UBPMessageTypes.Options_getOption:
                    if ( typeof (options.name) === "undefined") {
                        throw new UBPBadMessage("option name undefined");
                    }
                    break;
                case UBPMessageTypes.Options_setOption:
                    if ( typeof (options.name) === "undefined") {
                        throw new UBPBadMessage("option name undefined");
                    }
                    if ( typeof (options.value) === "undefined") {
                        throw new UBPBadMessage("option value undefined");
                    }
                    break;
                case UBPMessageTypes.Mode_enable:
                    if ( typeof (options.mode) === "undefined") {
                        throw new UBPBadMessage("option mode undefined");
                    }
                    break;
                case UBPMessageTypes.Mode_disable:
                    if ( typeof (options.mode) === "undefined") {
                        throw new UBPBadMessage("option mode undefined");
                    }
                    break;
                case UBPMessageTypes.Mode_getModeStatus:
                    break;
                case UBPMessageTypes.Mode_isModeEnabled:
                    if ( typeof (options.mode) === "undefined") {
                        throw new UBPBadMessage("option mode undefined");
                    }
                    break;
                case UBPMessageTypes.Options_isDataCollectionEnabled:
                    break;
                case UBPMessageTypes.Options_setFirstRunOptions:
                    break;
                case UBPMessageTypes.Options_acceptTermsOfUse:
                    break;
                case UBPMessageTypes.Options_rejectTermsOfUse:
                    break;
                case UBPMessageTypes.Browser_showGadgetWindow:
                    if ( typeof (options.url) === "undefined") {
                        throw new UBPBadMessage("url undefined");
                    }
                    if ( typeof (options.width) === "undefined") {
                        throw new UBPBadMessage("width undefined");
                    }
                    if ( typeof (options.height) === "undefined") {
                        throw new UBPBadMessage("height undefined");
                    }
                    break;
                case UBPMessageTypes.Browser_openWindow:
                    if ( typeof (options.url) === "undefined") {
                        throw new UBPBadMessage("url undefined");
                    }
                    if ( typeof (options.name) === "undefined") {
                        throw new UBPBadMessage("name undefined");
                    }
                    if ( typeof (options.features) === "undefined") {
                        throw new UBPBadMessage("features undefined");
                    }
                    break;
                case UBPMessageTypes.Browser_injectJavaScriptFromURL:
                    if ( typeof (options.jsurl) === "undefined") {
                        throw new UBPBadMessage("jsurl undefined");
                    }
                    if ( typeof (options.includeShim) === "undefined") {
                        throw new UBPBadMessage("shim undefined");
                    }
                    break;
                case UBPMessageTypes.Browser_injectJavaScriptFromString:
                    if ( typeof (options.jsstring) === "undefined") {
                        throw new UBPBadMessage("jsstring undefined");
                    }
                    if ( typeof (options.includeShim) === "undefined") {
                        throw new UBPBadMessage("shim undefined");
                    }
                    break;
                case UBPMessageTypes.Browser_getInjectionShim:
                    break;
                case UBPMessageTypes.Browser_addPageTurnListener:
                    if ( typeof (options.listener) === "undefined") {
                        throw new UBPBadMessage("listener undefined");
                    }
                    break;
                case UBPMessageTypes.Browser_addUrlChangeListener:
                    if ( typeof (options.listener) === "undefined") {
                        throw new UBPBadMessage("listener undefined");
                    }
                    break;
                case UBPMessageTypes.Browser_addTabChangedListener:
                    if ( typeof (options.listener) === "undefined") {
                        throw new UBPBadMessage("listener undefined");
                    }
                    break;
                case UBPMessageTypes.Browser_crossDomainXHR:
                    if ( typeof (options.method) === "undefined") {
                        throw new UBPBadMessage("method undefined");
                    }
                    if ( typeof (options.url) === "undefined") {
                        throw new UBPBadMessage("url undefined");
                    }
                    if ( typeof (options.success) === "undefined") {
                        throw new UBPBadMessage("success required");
                    }
                    if ( typeof (options.error) === "undefined") {
                        throw new UBPBadMessage("error required");
                    }
                    break;
                case UBPMessageTypes.Browser_showNotification:
                    if ( typeof (options.type) === "undefined") {
                        throw new UBPBadMessage("type undefined");
                    }
                    break;
                case UBPMessageTypes.Browser_hideNotification:
                    if ( typeof (options.id) === "undefined") {
                        throw new UBPBadMessage("id undefined");
                    }
                    break;
                case UBPMessageTypes.Search_checkStatus:
                    if ( typeof (options.name) === "undefined") {
                        throw new UBPBadMessage("name undefined");
                    }
                    break;
                case UBPMessageTypes.Search_add:
                    if ( typeof (options.name) === "undefined") {
                        throw new UBPBadMessage("name undefined");
                    }
                    if ( typeof (options.url) === "undefined") {
                        throw new UBPBadMessage("osd url undefined");
                    }
                    if ( typeof (options.setAsDefault) === "undefined") {
                        options.setAsDefault = false;
                    }
                    break;
                case UBPMessageTypes.Search_remove:
                    if ( typeof (options.name) === "undefined") {
                        throw new UBPBadMessage("name undefined");
                    }
                    break;
                case UBPMessageTypes.Messaging_addMessageListener:
                    if (typeof(options.listener) !== "function") {
                        throw new UBPBadMessage("options.listener is not a function");
                    }
                    break;
                case UBPMessageTypes.Messaging_postMessage:
                    if ( typeof (options.type) === "undefined") {
                        throw new UBPBadMessage("event type undefined");
                    }
                    break;
                case UBPMessageTypes.ClientLogs_log_message:
                    if ( typeof (options) === "undefined") {
                        throw new UBPBadMessage("log message undefined");
                    }
                    break;
                case UBPMessageTypes.DebugLogs_log_message:
                    if ( typeof (options) === "undefined") {
                        throw new UBPBadMessage("log message undefined");
                    }
                    break;
                case UBPMessageTypes.Panel_hidePanel:
                    break;
                case UBPMessageTypes.Panel_resizePanel:
                    break;
                case UBPMessageTypes.Wishlist_wishlistComplete:
                    break;
                case UBPMessageTypes.Alerts_toasterClicked:
                    break;
                case UBPMessageTypes.Alerts_ProductComparison:
                    break;
                case UBPMessageTypes.PingRequest:
                    break;
                default:
                    throw new UBPBadMessage("unknown message type: " + message.type);
            }
        },
        uuid : function() {
            var S4 = function() {
                return Math.floor(Math.random() * 0x10000 /* 65536 */
                ).toString(16);
            };
            return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
        },
        messageDispatch : function(type, options) {
            var message = new UBPMessage.createMessage(type, options);
            UBPMessage.validateMessage(message);
            UBPMessage.sendQueue.setItem(message.id, message);
            return message;
        },
        messageResponse : function(message) {
            var originalMessage = UBPMessageAPI.UBPMessage.sendQueue.removeItem(message.id);
            if (message.value) {
                if (originalMessage.options.success) {
                    originalMessage.options.success(message.value);
                }
            }
            else if (originalMessage.options.error) {
                originalMessage.options.error(message.error);
            }
        },
        sendQueue: new UBPHashTable([])
    };
    
    UBPMessageAPI.UBPMessage = UBPMessage;
    UBPMessageAPI.UBPHashTable = UBPHashTable;
    UBPMessageAPI.UBPBadMessage = UBPBadMessage;
    UBPMessageAPI.UBPMessageTypes = UBPMessageTypes;
    window.UBPMessageAPIChrome = UBPMessageAPI;

    return !!window.UBPMessageAPIChrome;
}());

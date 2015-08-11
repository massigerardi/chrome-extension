var factory = function() {

    "use strict";

    var InteractionManager = function() {
        this.initialize.apply(this, arguments);
    };

    var uuid = function() {
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
    };

    InteractionManager.prototype = {
        initialize: function(opts) {
            this._doc = opts.doc;
            this._onEventFun = opts.onEvent || function() {};

            this._handles = {};
            this._compositeHandles = {};
        },

        _getElement: function(opts) {
            var element;
            if (opts.selector === "getElementById") {
                element = this._doc.getElementById(opts.identifier);
            } else if (opts.selector === "getElementsByName") {
                element = this._doc.getElementsByName(opts.identifier)[opts.identifierIdx];
            } else if (opts.selector === "getElementsByTagName") {
                element = this._doc.getElementsByTagName(opts.identifier)[opts.identifierIdx];
            } else if (opts.selector === "getElementsByClassName") {
                element = this._doc.getElementsByClassName(opts.identifier)[opts.identifierIdx];
            }
            return element;
        },

        _generateHandleId: function() {
            return "UBPInteraction-" + uuid();
        },

        _generateCompositeHandleId: function() {
            return "UBPInteractionComposite-" + uuid();
        },

        _getNotification: function(opts) {
            return {
                mType: "UBPInteractionMessage",
                handle: opts.handle,
                eventName: opts.eventName,
                legacyEventName: opts.legacyEventName
            }
        },

        _getListener: function(opts) {
            var notification = this._getNotification(opts);
            var self = this;
            return function() {
                self._onEventFun(notification);
            };
        },

        registerEvent: function(opts) {

            var element = this._getElement(opts);

            if (!element) {
                return null;
            }

            var handle = this._generateHandleId();

            var listener = this._getListener({
                handle: handle,
                eventName: opts.eventName,
                legacyEventName: opts.legacyEventName
            });

            this._handles[handle] = {
                element: element,
                eventName: opts.eventName,
                legacyEventName: opts.legacyEventName,
                listener: listener
            };

            if (element.addEventListener) {
                element.addEventListener(opts.eventName, listener);
            } else if (element.attachEvent) {
                element.attachEvent(opts.legacyEventName, listener);
            } else {
                return null;
            }
            return handle;
        },

        deregisterEvent: function(opts) {
            var handleContent = this._handles[opts.handle];
            if (!handleContent) {
                return;
            }
            var element = handleContent.element;
            var eventName = handleContent.eventName || handleContent.legacyEventName;
            var listener = handleContent.listener;
            if (element.removeEventListener) {
                element.removeEventListener(eventName, listener);
            } else if (element.attachEvent) {
                element.detachEvent(eventName, listener);
            }
            delete this._handles[opts.handle];
        },

        registerMultipleEvents: function(opts) {
            var element = this._getElement(opts);

            if (!element) {
                return null;
            }

            var handle = this._generateCompositeHandleId();
            var handleObj = {
                element: element,
                listeners: []
            };
            for (var idx = 0; idx < opts.events.length; idx++) {
                var eventName = opts.events[idx].eventName,
                    legacyEventName = opts.events[idx].legacyEventName;
                var listener = this._getListener({
                    handle: handle,
                    eventName: eventName,
                    legacyEventName: legacyEventName
                });
                if (element.addEventListener) {
                    element.addEventListener(eventName, listener);
                } else if (element.attachEvent) {
                    element.attachEvent(legacyEventName, listener);
                } else {
                    continue;
                }
                handleObj.listeners.push({
                    listener: listener,
                    eventName: eventName,
                    legacyEventName: legacyEventName
                });
            }

            this._compositeHandles[handle] = handleObj;

            return handle;
        },

        deregisterMultipleEvents: function(opts) {
            var handleContent = this._compositeHandles[opts.handle];
            if (!handleContent) {
                return;
            }
            var element = handleContent.element;
            var listeners = handleContent.listeners;
            for (var idx = 0; idx < listeners.length; idx++) {
                var eventListener = handleContent.listeners[idx];
                var eventName = eventListener.eventName || eventListener.legacyEventName;
                var listener = eventListener.listener;
                if (element.removeEventListener) {
                    element.removeEventListener(eventName, listener);
                } else if (element.attachEvent) {
                    element.detachEvent(eventName, listener);
                }
            }
            delete this._compositeHandles[opts.handle];
        },

        registerPageBodyClick: function() {
            var handle = this.registerMultipleEvents({
                selector: "getElementsByTagName",
                identifier: "body",
                identifierIdx: 0,
                events: [{
                    eventName: "click",
                    legacyEventName: "onclick"
                }, {
                    eventName: "contextmenu",
                    legacyEventName: "oncontextmenu"
                }]
            });
            return handle;
        }
    };

    return InteractionManager;

};

if (typeof window !== "undefined") {
    window.UBPAPISupport = window.UBPAPISupport || {};
    window.UBPAPISupport.InteractionManager = factory();
}
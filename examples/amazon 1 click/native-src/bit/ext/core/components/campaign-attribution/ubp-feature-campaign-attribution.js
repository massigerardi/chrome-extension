/*global amznJQ: false, module: true, define: false, require: false, navigator: false  */
/**

    NOTE:   This file is also replicated in BITOneButtonCore. The file in UBPAppsJS
            should be considered canonical. The copy in BITOneButtonCore should
            be just that - a copy. Since we're dealing with transport protocols
            and message API formats, it's important that the server be authoritative.

    NOTE:   This library very purposefully bypasses the standard messaging API
            used throughout the rest of the application. The reason for this
            is not immediately obvious.

            Moving forward, we want to stop relying on User-Agent sniffing
            to determine things like which messaging channel shim to use.

            V2 attribution pushed us in this direction. Apps are now responsible
            for explicitly informing our services what app/platform they think
            they are. As part of a given app's (e.g., 1BA Chrome) startup process,
            the app phones home with this information, and the server replies with
            authoritative information.

            One of the pieces of authoritative information is the programCode, which
            is, today, determined from the tagbase, client-specified app (e.g., 1BA),
            and client-specified platform (e.g., IE). From this information alone, the
            service can determine a programCode. However, a service may provide
            additional information, such as a campaignCode, which helps refine the
            programCode to something more specific.

            For example, a tagbase of abba-ubp may imply a default programCode of "org"
            (organic), but a tagbase of abba-ubp AND a campaignCode of v0_d130610_ad_spk_nvm
            (Advertisement, Sparkle, NeverMiss) might imply a programCode of "p001",
            which is a logical child of "org" (a specific organic marketing tactic).

            Since this resolution happens at the same time as the canonical productCode (a tuple
            derived from appCode and platformCode), and produceCode will, in turn,
            determine things like which messaging library to use, we need a separate messaging
            protocol in order to prevent a circular dependency.

            This should adequately justify the existence of a separate messaging API - it exists
            in the application preamble, at a lower level.

            Additionally, I've introduced new control flow semantics for *how* messages are
            piped through the system. The existing messaging API doesn't provide strict enough
            control flow. It exists as a thin layer over the standard postMessage API, but makes no
            effort to explicitly enforce data flow. As a result, there are ad-hoc listeners forwarding
            whatever messages seem to make sense to the correct window objects.

            This is error-prone, hard to debug, and hard to audit.

            Instead, this code experiments with the idea of channel-based message flow. Channels have a
            very small API, and strongly enforce a few key things:

                1) Channels have only one owner, and only that owner may explicitly publish to the channel.
                   This keeps channels uni-directional, which in turn keeps message routing easy to debug
                   and reason about.

                   Additionally, this helps keep the size of the implicit interface small. An object wishing
                   to publish events must expose a channel, and an outside entity may or may not choose to listen.

                   This encourages components to be self-contained, with the coupling decided by the developer
                   using the component.

                2) A UBPCompositeChannel effectively allows multiple publishers by allowing other channels to "join" it. Any
                   message published to a joined channel will also be dispatched to the composite channel's listeners. Example:

                   Channel 1 Owner -> Channel 1 -    Composite Chan Owner    - Listener A
                                                 \            |            /
                                                  > - Composite Chan     -<
                                                 /                         \
                   Channel 2 Owner -> Channel 2 -                            - Listener B

                   Any message published to Channel 1, Channel 2, or to the Composite Channel itelf will be dispatched to
                   both Listeners A and B. This is useful for decoupling Listener A from Channel Owner 1 and its
                   corresponding channel (for example).
 

                3) A channel is message-format agnostic. It makes no assumptions about what the message
                   it's ferrying looks like. The dispatch mechanics are determined by how someone interacts
                   with a channel, rather than the format of a message. The one big caveat is that messages
                   should be JSON-serializable. That means no passing references to native components, such as
                   events. This is because:

                4) Channels should be transport-agnostic. A channel should make no assumptions about where
                   a consumer lives. It may exist within the same window, in another window, or on a completely
                   separate computer. In order to enable these use cases, message sent along a channel must be
                   serializable.

            Channels represent the lowest-level communication primitive. In order to make it easier to work
            with channels (especially in the case where an interested party is in a remote runtime), we've
            introduced a UBPMessageExchange. A UBPMessageExchange exists at potential runtime boundaries, and
            it *does* have message format assumptions, which it enforces internally between peer exchanges.

            Imagine, for example, that we have a FooService and a FooClient. Rather than try to wire up a FooClient's
            outbound messageChannel to a FooService's listeners directly, each of these components merely
            speaks to their own MessageExchange. MessageExchanges know how to talk to each other using their own
            message envelopes. In the case where all components are in the same runtime, it might look like this:

                [Foo Client]  <-->  [Foo Client Message Exchange]  <--> [Foo Service Message Exchange] <--> [Foo Service]

            We can maintain interface partity for remote services by stubbing out a local, in-memory "proxy service",
            which delegates to the actual remote service:

                [Foo Client]  <-->  [Foo Client Message Exchange]  <--> [Foo Service Proxy] <--> [Memory Boundary] <--> [Foo Client Proxy] <--> [Foo Service Exchange] <--> [Foo Service]

            This is how the following library is written today. An astute reader will note that this service cannot distinguish between
            connected clients, and that outbound messages from the service will be dispatched to all connected clients. This can be
            prevented by introducing a ClientSession to host a MessageExchange on a per-connection basis, and ensuring replies
            hit the correct ClientSession's MessageExchange. As soon as we have a use-case for multiple clients, this should be tackled.
            While our use-cases are all in-memory (between a singleton "service" in a satellite and a singleton "client" in the 1BA),
            we can keep the code much simpler by assuming there is only one of each. Note that we've attempted to future-proof this by
            introducing a requestContext to each request. For now, it's empty, but it could provide access to clientSession information
            at a later date.
 

    Defines three campaign attribution related components:
        UBPCampaignAttributionService
            * Fields requests to set/get sticky campaign attribution
            * Delegates to LocalStorage

        UBPCampaignAttributionAgent
            * Responsible for determining the true attribution state based on browse context

        UBPCampaignAttributionClient
            * Used to talk to the UBPCampaignAttributionService
            * Supports get/set
            * Transport agnostic

        UBPCampaignAttributionSatelliteBootstrapper
            * Creates an iframe pointing at a well-known satellite, handshakes with it, creates a UBPIFrameTransportStrategy,
              creates a UBPRemoteServiceDelegate using this strategy, and hands the delegate to the caller, so that it may connect
              using a UBPCampaignAttributionClient.

    Additionally, some publicly exported messaging-related components are defined. As soon as a second use case for these
    components is identified, they can be pulled out to their own feature.

        UBPMessageChannel
            * Uni-directional communication channel
            * Strong ownership model
                * Only creator of the channel can publish messages to it
            * Multiple-subscriber model
                * Anyone may subscrie - no guarantees about deliver order between channels

        UBPCompositeMessageChannel

        UBPMessageExchange
            * A message exchange talks to another message exchange
            * A message exchange is responsible for ferrying outbound messages along its publish channel
            * A message exchange knows about the following outgoing message types:
                * Send
                    * The message exchange will not listen for a corresponding reply
                * SendAndReceive
                    * The message exchange *will* listen for a corresponding reply
                * Reply
                    * The message exchange will not listen for a corresponding reply
            * A message exchange knows about the following incoming message types:
                * Send
                    * The message exchange will dispatch the incoming message to its local dispatch channel for further handling
                * SendAndReceive
                    * The message exchange will dispatch the incoming message to its local dispatch handle, and
                    * wait for a corresponding reply
                * Reply
                    * The message exchange will attempt to find a waiting reply handler, and if found, invoke it

        UBPRemoteServiceDelegate
            * A local stub which a client uses to connect to a remote client. A UBPRemoteServiceDelegate is a facade for
              a service potentially living elsewhere.

*/

(function(){
    "use strict";

    var TaskManager = {
        scheduleTask: function(fun, timeout) {
            // Default no-op
            if (typeof setTimeout !== "undefined") {
                setTimeout(fun, timeout);
            }
        }
    };

    var toArray = function(arrayLikeThing) {
        return Array.prototype.slice.call(arrayLikeThing, 0);
    };

    // var foo = {bar:"bazz"};
    // E.g., extend(foo, {hello:"there"}, {howare: "you"}) => {hello:"there", howare:"you", bar:"bazz"}
    // Also, assigns to foo.
    var extend = function(target) {
        var args = toArray(arguments);
        args.shift(); // get rid of target
        var current = args.shift();
        while (typeof current !== "undefined") {
            for(var prop in current) {
                if (current.hasOwnProperty(prop)) {
                    target[prop] = current[prop];
                }
            }
            current = args.shift();
        }
        return target;
    };

    var createKlass = function() {
        var args = toArray(arguments);

        var name = "Anon-Klass";
        var instanceMethods = {};

        if (args.length === 1) {
            if (typeof args[0] === "string") {
                name = args[0];
            } else {
                instanceMethods = args[0];
            }
        } else if (args.length === 2) {
            name = args[0];
            instanceMethods = args[1];
        }

        return (function(name, instanceMethods) {
            var fun = function() {
                if (this.initialize) {
                    this.initialize.apply(this, arguments);
                }
            };
            extend(fun.prototype, {"_klassName": name}, instanceMethods);
            return fun;

        }(name, instanceMethods));

    };

    var bind = function() {
        var args = toArray(arguments);
        var fun = args.shift();
        var context = args.shift();
        return function() {
            var finalArgs = args.concat(toArray(arguments));
            return fun.apply(context, finalArgs);
        };
    };

    var bindAll = function(context) {
        var methods = toArray(arguments);
        methods.shift(); // drop context
        c.map(methods, function(method) {
            var fun = context[method];
            context[method] = bind(fun, context);
        });
    };

    var UBPUtil = {
        toArray: toArray,
        extend: extend,
        createKlass: createKlass,
        bind: bind,
        bindAll: bindAll
    };

    // Some collection helpers
    var c = (function(){
        var any = function(collection, predicate, context) {
            var retVal = false;
            var currVal;
            for (var prop in collection) {
                if (collection.hasOwnProperty(prop)) {
                    currVal = collection[prop];
                    if (predicate.call(context, currVal, prop)) {
                        retVal = true;
                        break;
                    }
                }
            }
            return retVal;
        };

        var all = function(collection, predicate, context) {
            return !any(collection, function(currVal, prop){
                return !predicate.call(context, currVal, prop);
            });
        };

        var map = function(collection, fun, context) {
            var retVal = [];
            var currVal;
            for (var prop in collection) {
                if (collection.hasOwnProperty(prop)) {
                    currVal = collection[prop];
                    retVal.push(fun.call(context, currVal, prop));
                }
            }
            return retVal;
        };

        var find = function(collection, predicate, context) {
            var retVal;
            var currVal;
            for (var prop in collection) {
                if (collection.hasOwnProperty(prop)) {
                    currVal = collection[prop];
                    if (predicate.call(context, currVal, prop)) {
                        retVal = currVal;
                        break;
                    }
                }
            }
            return retVal;
        };

        var invoke = function(collection, method) {
            var args = toArray(arguments);
            args.shift(); // collection
            args.shift(); // method
            // anything left in args should be ferried to the invocation
            map(collection, function(obj) {
                obj[method].apply(obj, args);
            });
        };

        // Modifies provided array to remove provided item.
        // Returns removed item, if present.
        var remove = function(ary, item) {
            var idx = ary.indexOf(item);
            var retVal;
            if (idx !== -1) {
                // Grab value
                retVal = ary[idx];

                // Remove from ary
                ary.splice(idx, 1);
            }
            return retVal;
        };

        return {
            any: any,
            all: all,
            map: map,
            each: map,
            find: find,
            detect: find,
            invoke: invoke
        };

    }());
 

    // var StateGuard = UBPUtil.createKlass("StateGuard", {
    //  initialize: function(validStates) {
    //      this._validStates = validStates;
    //      this._triggeredStates = {};
    //  },
    //  prevent: function() {},
    //  require: function() {},
    //  mark: function() {},
    //  isMarked: function() {}
    // });

    var UBPMessageSubscriber = UBPUtil.createKlass("UBPMessageSubscriber", {
        initialize: function(handler) {
            this._handler = handler;
        },
        matches: function(handler) {
            return (this._handler === handler);
        },
        notify: function(message) {
            this._handler(message);
        },
        dispose: function() {
            this._handler = null;
        }
    });

    var UBPMessageChannel = UBPUtil.createKlass("UBPMessageChannel", {
        initialize: function(sentinel) {
            this._sentinel = sentinel;
            // I wish I could create a Map<Function, Function>. Sign.
            this._subscribers = [];
        },
        publish: function(sentinel, message) {
            // TODO: Impl
            if (this._sentinel !== sentinel) {
                throw new Error("Invalid sentinel provided; cannot publish message");
            }
            c.invoke(this._subscribers, "notify", message);
        },
        subscribe: function(handler) {
            if (!handler) {
                return;
            }

            if (c.any(this._subscribers, function(sub){
                return sub.matches(handler);
            })) {
                throw new Error("Can't double-subscribe to a channel");
            }

            this._subscribers.push(new UBPMessageSubscriber(handler));
        },
        unsubscribe: function(handler) {
            var idx = 0;
            var matchingSubcriber = c.detect(this._subscribers, function(subscriber) {
                if (subscriber.matches(handler)) {
                    return true;
                } else {
                    idx = idx + 1;
                }
            });

            if (matchingSubcriber) {
                this._subscribers.splice(idx, 1);
                matchingSubcriber.dispose();
            }
        },
        dispose: function() {
            c.invoke(this._subscribers, "dispose");
            this._subscribers = [];
        }
    });

    var UBPCompositeMessageChannel = UBPUtil.createKlass("UBPCompositeMessageChannel");
    UBPUtil.extend(UBPCompositeMessageChannel.prototype, UBPMessageChannel.prototype);

    UBPUtil.extend(UBPCompositeMessageChannel.prototype, {
        _klassName: "UBPCompositeMessageChannel",
        initialize: function() {
            // Call parent initializer
            UBPMessageChannel.prototype.initialize.apply(this, arguments);
            this._joinedChannels = [];
            UBPUtil.bindAll(this, "_forwardDispatcher");
        },
        join: function(otherChannel) {
            otherChannel.subscribe(this._forwardDispatcher);
            this._joinedChannels.push(otherChannel);
        },
        leave: function(otherChannel) {
            var localRef = c.remove(this._joinedChannels, otherChannel);
            if (localRef) {
                otherChannel.unsubscribe(this._forwardDispatcher);
            }
        },
        // Ferries event as if this channel had published the message itself
        _forwardDispatcher: function(message) {
            this.publish(this._sentinel, message);
        }
    });

    var TimeoutHash = (function(){
        // How often each element should check
        // to see if it's expired. Don't go crazy.
        var EXPIRY_CHECK_INTERVAL = 850;

        // Private container - keeps track of expiry, etc
        var HashElt = UBPUtil.createKlass("TimeoutHashElement", {
            initialize: function(owner, key, timeout) {
                this._owner = owner;
                // Key is useful so this elt can ask its owner for removal
                // without having to do an expensive by-value lookup.
                this._key = key;
                this._timeout = timeout;
                this._lastAccess = null;
                this._expiryRequested = false;
                this.touch();
                UBPUtil.bindAll(this, "_checkExpired");
                this._scheduleExpiryCheck();
            },
            setValue: function(newValue) {
                this.touch();
                this._value = newValue;
            },
            value: function() {
                this.touch();
                return this._value;
            },
            touchlessValue: function() {
                return this._value;
            },
            touch: function() {
                this._lastAccess = Date.now();
            },
            dispose: function() {
                this._value = null;
                this._owner = null;
                this._key = null;
            },
            isExpired: function() {
                return this._expiryRequested || (Date.now() - this._lastAccess > this._timeout);
            },
            _requestExpiry: function() {
                this._expiryRequested = true;

                // Prevents the case where we've been disposed, but
                // slipped through the cracks and are trying to
                // request expiry again. Ignorable, but hash
                // can't do anything useful without at
                // least the key
                if (this._key) {
                    this._owner._requestExpiry(this._key, this);
                }
            },
            _scheduleExpiryCheck: function() {
                TaskManager.scheduleTask(this._checkExpired, EXPIRY_CHECK_INTERVAL);
            },
            _checkExpired: function() {
                if (this.isExpired()) {
                    this._requestExpiry();
                } else {
                    this.touch();
                    TaskManager.scheduleTask(this._checkExpired, EXPIRY_CHECK_INTERVAL);
                }
            }
        });

        return UBPUtil.createKlass("TimeoutHash", {
            initialize: function(opts) {
                opts = opts || {};
                this._timeout = opts.timeout || 5000; // default 5 seconds? Sure.
                this._onTimeout = opts.onTimeout || function() {};

                // Ew.
                this._hash = {};
            },
            put: function(key, value) {
                var tElt = this._hash[key];
                if (!tElt) {
                    tElt = new HashElt(this, key, this._timeout);
                    this._hash[key] = tElt;
                }
                tElt.setValue(value);
            },
            get: function(key) {
                var tElt = this._hash[key];
                if (!tElt) {
                    return;
                } else {
                    return tElt.value();
                }
            },
            getAndRemove: function(key) {
                var tElt = this._hash[key],
                    val;
                if (!tElt) {
                    return;
                } else {
                    val = tElt.value();
                    this.remove(key);
                    return val;
                }
            },
            remove: function(key) {
                var timeoutHashElt = this._hash[key];
                if (timeoutHashElt) {
                    this._hash[key] = undefined;
                    timeoutHashElt.dispose();
                }
            },
            _requestExpiry: function(key, timeoutHashElt) {
                var value = timeoutHashElt.touchlessValue();
                this._hash[key] = undefined;
                timeoutHashElt.dispose();
                this._onTimeout(key, value);
            }
        });
    }());

    var UBPMessageExchange = (function() {
        var GUID = (function(){
            var s4 = function() {
              return Math.floor((1 + Math.random()) * 0x10000)
                         .toString(16)
                         .substring(1);
            };
            // XXX This is not an RFC-compliant UUID :P
            return function() {
                return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
            };
        }());

        // TODO: Message factory can be made way more generic with a little
        // love. For now, this is sufficient.
        var Message = {
            typeSend: function(msg) {
                return {
                    msgId: GUID(),
                    payload: msg,
                    t: Date.now(),
                    mType: "rpcSend"
                };
            },
            typeSendAndReceive: function(msg) {
                return {
                    msgId: GUID(),
                    payload: msg,
                    t: Date.now(),
                    mType: "rpcSendAndReceive"
                };
            },
            typeReply: function(inReplyTo, error, msg) {
                return {
                    msgId: GUID(),
                    rMsgId: inReplyTo,
                    payload: msg,
                    error: error,
                    t: Date.now(),
                    mType: "rpcReply"
                };
            },
            typeLocalDispatch: function(originalMsgId, msg, replyCallback) {
                return {
                    msgId: GUID(),
                    oMsgId: originalMsgId,
                    mType: "localDispatch",
                    t: Date.now(),
                    payload: msg,
                    replyCallback: replyCallback
                };
            }
        };

        var NOOP = function() {};

        return UBPUtil.createKlass("UBPMessageExchange", {
            initialize: function() {
                // Points inward, toward self. Messages received on this
                // channel are from remote senders.
                this._ingressChannel = new UBPCompositeMessageChannel(this);

                // Points "outward", toward remote recipient
                this._egressChannel = new UBPMessageChannel(this);

                // Unwrapped messages are sent along this channel
                this._dispatchChannel = new UBPMessageChannel(this);

                UBPUtil.bindAll(this, "_onReplyTimeout", "_receive");
                this._pendingRemoteReply = new TimeoutHash({
                    timeout: 30000, // milliseconds
                    onTimeout: this._onReplyTimeout
                });

                this._ingressChannel.subscribe(this._receive);
            },
            dispatchChannel: function() {
                return this._dispatchChannel;
            },
            egressChannel: function() {
                return this._egressChannel;
            },
            listen: function(otherChannel) {
                this._ingressChannel.join(otherChannel);
            },
            leave: function(otherChannel) {
                this._ingressChannel.leave(otherChannel);
            },
            send: function(msg) {
                var wrappedMessage = Message.typeSend(msg);
                this._egressChannel.publish(this, wrappedMessage);
            },
            sendAndReceive: function(msg, replyCallback) {
                replyCallback = replyCallback || NOOP;
                var wrappedMessage = Message.typeSendAndReceive(msg);
                this._pendingRemoteReply.put(wrappedMessage.msgId, replyCallback);
                this._egressChannel.publish(this, wrappedMessage);
            },
            // Should only ever be called via a callback,
            // so this one is private, unlike send and sendAndReceive
            _reply: function(originalMsgId, error, replyMsg) {
                var wrappedMessage = Message.typeReply(originalMsgId, error, replyMsg);
                this._egressChannel.publish(this, wrappedMessage);
            },
            _receive: function(wrappedMessage) {
                var dispatcher = "_receive_" + wrappedMessage.mType;
                if (this[dispatcher]) {
                    this[dispatcher](wrappedMessage);
                } else {
                    // TODO: Log (TRACE)
                    return; // keep jshint happy
                }
            },
            _receive_rpcReply: function(wrappedMessage) {
                // Look up pending original caller based on rMsgId ("in reply to"), dispatch
                var rMsgId = wrappedMessage.rMsgId,
                    payload = wrappedMessage.payload,
                    remoteError = wrappedMessage.error,
                    candidateCallback = this._pendingRemoteReply.getAndRemove(rMsgId);

                if (candidateCallback) {
                    if (remoteError) {
                        candidateCallback(new Error(remoteError));
                    } else {
                        candidateCallback(null, payload);
                    }
                }
            },
            _receive_rpcSend: function(wrappedMessage) {
                // Dispatch along dispatch channel
                var payload = wrappedMessage.payload,
                    originalMsgId = wrappedMessage.msgId;

                this._dispatchChannel.publish(this, Message.typeLocalDispatch(originalMsgId, payload, NOOP));
            },
            _receive_rpcSendAndReceive: function(wrappedMessage) {
                // Dispatch with reply callback
                var payload = wrappedMessage.payload,
                    originalMsgId = wrappedMessage.msgId,
                    replyCallback = UBPUtil.bind(function(err, replyMsg) {
                        if (err) {
                            // Coerce to string, so it's safe for message passing
                            err = "" + err;
                            // In the error case, don't bother sending data
                            payload = null;
                        }
                        var wrappedReplyMessage = Message.typeReply(originalMsgId, err, replyMsg);
                        this._egressChannel.publish(this, wrappedReplyMessage);
                    }, this);

                this._dispatchChannel.publish(this, Message.typeLocalDispatch(originalMsgId, payload, replyCallback));
            },
            _onReplyTimeout: function(msgId, originalCallback) {
                // Reply never came, so call the callback with a timeout error.
                // XXX: Retrying is hard with RESTful APIs without idempotency guarantees, so we don't even try
                // it at this level. If you want it, implement it higher up the stack.

                // TODO: Log msgId
                try {
                    originalCallback(new Error("Reply timeout exceeded"));
                } catch(e) {
                    // TODO: Log instead of throwing
                    throw e;
                }
            }

        });
    }());
 

    var UBPExchangeChannelDispatcher = (function(){

        var getFriendlyHandlerName = function(msg) {
            var mType = msg.mType;
            var suffix = "else"; // default suffix

            if (mType) {
                suffix = mType.charAt(0).toUpperCase() + mType.substr(1);
            }
            // E.g.:
            // If mType = "getName", friendly handler is onRpcGetName
            // If not set, default handler is onRpcElse
            // Prefixing is done in order to prevent accidentally exposing
            // private methods. RPC reponders must start with 'onRpc'
            return "onMsg" + suffix;
        };

        var defaultContextDelegate = function() {
            return {};
        };

        return UBPUtil.createKlass("UBPExchangeChannelDispatcher", {
            initialize: function(responder, contextDelegate) {
                this._responder = responder;
                this._compositeChannel = new UBPCompositeMessageChannel(this);
                this._enabled = false;
                this._contextDelegate = contextDelegate || defaultContextDelegate;
                UBPUtil.bindAll(this, "_dispatch");
                this._compositeChannel.subscribe(this._dispatch);
            },
            join: function(channel) {
                this._compositeChannel.join(channel);
            },
            leave: function(channel) {
                this._compositeChannel.leave(channel);
            },
            enable: function() {
                this._enabled = true;
            },
            disable: function() {
                this._enabled = false;
            },
            _dispatch: function(wrappedMessage) {
                // If we're not turned on, don't dispatch anything
                if (!this._enabled) {
                    return;
                }

                // If it's not wrapped in a localDispatch message, we don't care about it
                if (wrappedMessage.mType !== "localDispatch") {
                    return;
                }

                // Peek at the unwrapped message type, transform it into a friendly
                // handler name
                var msg = wrappedMessage.payload,
                    replyCallback = wrappedMessage.replyCallback;

                var candidateHandlerName = getFriendlyHandlerName(msg),
                    ctx = this._contextDelegate();
                if (typeof this._responder[candidateHandlerName] === "function") {
                    this._responder[candidateHandlerName](ctx, msg, replyCallback);
                }
            }
        });
    }());

    var UBPCampaignAttributionService = (function(){

        var NOOP = function(){};
        var LS_BITCAMPAIGNCODE_KEY = "com.amazon.bit.campaignCode",
            LS_TAGBASE_KEY = "com.amazon.bit.tagbase",
            LS_BITMODE_KEY = "com.amazon.bit.bitMode",
            LS_ASSOCIATED_ID_KEY = "com.amazon.bit.associateId";

        var LS = (function(){
            if (typeof localStorage !== "undefined"){
                return localStorage;
            } else {
                return {
                    getItem: NOOP,
                    setItem: NOOP,
                    clear: NOOP
                };
            }
        }());

        var MessagePayload = {
            typeSetBitCampaignCodeReply: function() {
                return {
                    mType: "setBitCampaignCodeReply"
                };
            },
            typeGetBitCampaignCodeReply: function(code) {
                return {
                    mType: "getBitCampaignCodeReply",
                    code: code
                };
            },
            typeSetTagbaseReply: function() {
                return {
                    mType: "setTagbaseReply"
                };
            },
            typeGetTagbaseReply: function(tagbase) {
                return {
                    mType: "getTagbaseReply",
                    tagbase: tagbase
                };
            },
            typeSetBitModeReply: function() {
                return {
                    mType: "setBitModeReply"
                };
            },
            typeGetBitModeReply: function(bitmode) {
                return {
                    mType: "getBitModeReply",
                    bitmode: bitmode
                };
            },
            typeSetAssociateIdReply: function() {
                return {
                    mType: "setAssociateIdReply"
                };
            },
            typeGetAssociateIdReply: function(associateId) {
                return {
                    mType: "getAssociateIdReply",
                    associateId: associateId
                };
            }
        };

        return UBPUtil.createKlass("CampaignAttributionService", {
            initialize: function() {
                this._messageExchange = new UBPMessageExchange();
                this._exchangeDispatcher = new UBPExchangeChannelDispatcher(this);

                this._exchangeDispatcher.join(this._messageExchange.dispatchChannel());
            },
            start: function(cb) {
                cb = cb || NOOP;
                this._exchangeDispatcher.enable();
                TaskManager.scheduleTask(cb, 1);
            },
            stop: function(cb) {
                cb = cb || NOOP;
                this._exchangeDispatcher.disable();
                TaskManager.scheduleTask(cb, 1);
            },
            messageExchange: function() {
                return this._messageExchange;
            },
            connectRequested: function(client, cb) {
                cb = cb || NOOP;

                // Server's outbound messages to the client
                client.messageExchange().listen(this._messageExchange.egressChannel());

                // Client's outbound messages to the server
                this._messageExchange.listen(client.messageExchange().egressChannel());

                TaskManager.scheduleTask(cb, 1);
            },
            // Service methods

            // Set the code
            onMsgSetBitCampaignCode: function(ctx, msg, cb) {
                // TODO: Have the constructor accept a storage delegate
                var code = msg.code;
                // Setting an empty value is valid - no error check here

                LS.setItem(LS_BITCAMPAIGNCODE_KEY, code);
                TaskManager.scheduleTask(function(){
                    cb(null, MessagePayload.typeSetBitCampaignCodeReply());
                }, 1);
            },

            // Get the code
            onMsgGetBitCampaignCode: function(ctx, msg, cb) {
                // TODO: Have the constructor accept a storage delegate
                var code = LS.getItem(LS_BITCAMPAIGNCODE_KEY);

                // Getting an empty value is valid - no error check here
                TaskManager.scheduleTask(function(){
                    cb(null, MessagePayload.typeGetBitCampaignCodeReply(code));
                }, 1);
            },

            // Set the tagbase
            onMsgSetTagbase: function(ctx, msg, cb) {
                var tagbase = msg.tagbase;
                // Setting an empty value is valid - no error check here

                LS.setItem(LS_TAGBASE_KEY, tagbase);
                TaskManager.scheduleTask(function(){
                    cb(null, MessagePayload.typeSetTagbaseReply());
                }, 1);
            },

            // Get the tagbase
            onMsgGetTagbase: function(ctx, msg, cb) {
                var tagbase = LS.getItem(LS_TAGBASE_KEY);

                // Getting an empty value is valid - no error check here
                TaskManager.scheduleTask(function(){
                    cb(null, MessagePayload.typeGetTagbaseReply(tagbase));
                }, 1);
            },

            // Set the bitmode
            onMsgSetBitMode: function(ctx, msg, cb) {
                var bitmode = msg.bitmode;
                // Setting an empty value is valid - no error check here

                LS.setItem(LS_BITMODE_KEY, bitmode);
                TaskManager.scheduleTask(function(){
                    cb(null, MessagePayload.typeSetBitModeReply());
                }, 1);
            },

            // Get the bitmode
            onMsgGetBitMode: function(ctx, msg, cb) {
                var bitmode = LS.getItem(LS_BITMODE_KEY);

                // Getting an empty value is valid - no error check here
                TaskManager.scheduleTask(function(){
                    cb(null, MessagePayload.typeGetBitModeReply(bitmode));
                }, 1);
            },

            // Set the associateId
            onMsgSetAssociateId: function(ctx, msg, cb) {
                var associateid = msg.associateid;
                // Setting an empty value is valid - no error check here

                LS.setItem(LS_ASSOCIATED_ID_KEY, associateid);
                TaskManager.scheduleTask(function(){
                    cb(null, MessagePayload.typeSetAssociateIdReply());
                }, 1);
            },

            // Get the associateId
            onMsgGetAssociateId: function(ctx, msg, cb) {
                var associateId = LS.getItem(LS_ASSOCIATED_ID_KEY);

                // Getting an empty value is valid - no error check here
                TaskManager.scheduleTask(function(){
                    cb(null, MessagePayload.typeGetAssociateIdReply(associateId));
                }, 1);
            }
        });

    }());
 

    // A virtual "service", which delegates over some transport mechanism
    // to a true remote service. More friendly than reaching into the client's
    // message exchange, since this provides a uniform connection
    // method for local vs remote
    var UBPRemoteServiceDelegate = (function(){
        var NOOP = function() {};
        return UBPUtil.createKlass("UBPRemoteServiceDelegate", {
            initialize: function(transportStrategy) {
                this._transportStrategy = transportStrategy;
                this._toServer = new UBPCompositeMessageChannel(this);
                this._toClient = new UBPCompositeMessageChannel(this);

                // Messages bound for server will be forwarded via transport strategy
                this._transportStrategy.forward(this._toServer);

                // Messages from the server will be sent inward, to the client
                this._toClient.join(this._transportStrategy.dispatchChannel());
            },
            connectRequested: function(client, cb) {
                cb = cb || NOOP;
                this._toServer.join(client.messageExchange().egressChannel());
                client.messageExchange().listen(this._toClient);
                TaskManager.scheduleTask(cb, 1);
            }
        });
    }());
 

    // IFrame-specific delegate strategy.
    var UBPIFrameTransportStrategy = (function(){
        var Message = {
            typeIFrameTransport: function(origin, msg) {
                return {
                    mType: "iFrameTransport",
                    origin: origin,
                    // Destination is currently unused. It's
                    // expected that multiple strategies will
                    // dispatch these events for now, but
                    // their exchanges merely won't respond
                    // to them. If the fanout gets too large,
                    // we can add explicit destination endpointing
                    destination: null,
                    payload: msg
                };
            }
        };

        // Returns the version of Internet Explorer or a -1
        // (indicating the use of another browser, or IE 11).
        var getSerDeForBrowser = function() {
            // Valid for IE < 11
            var getInternetExplorerVersion = function () {
              var rv = -1; // Return value assumes failure.
              if (navigator.appName === 'Microsoft Internet Explorer')
              {
                var ua = navigator.userAgent;
                var re  = new RegExp("MSIE ([0-9]{1,}[\\.0-9]{0,})");
                if (re.exec(ua) !== null) {
                    rv = parseFloat( RegExp.$1 );
                }
              }
              return rv;
            };
            // Chrome, Firefox, IE 11
            if (getInternetExplorerVersion() === -1) {
                return DEFAULT_SERDE;
            } else {
                // IE 9, 10
                return JSON_SERDE;
            }
        };
 
 
 

        // Default SerDe is identity (no serialization).
        // This is to maintain backwards compat with the original version
        // of this lib, which did no serialization. As that version is also
        // shipped as part of BITOneButtonCore, it's important the serialization
        // format remain backwards compat
        var DEFAULT_SERDE = {
            serialize: function(obj){
                return obj;
            },
            deserialize: function(msg) {
                return msg;
            }
        };

        var JSON_SERDE = {
            serialize: function(obj) {
                return JSON.stringify(obj);
            },
            deserialize: function(msg) {
                return JSON.parse(msg);
            }
        };

        var lookat = function(obj, prefix) {
            c.map(obj, function(val, key) {
                console.log("Payload attr ", prefix, " ", key, " ", val);
                if (typeof val === 'object') {
                    lookat(val, key);
                }
            });
        };

        return UBPUtil.createKlass("UBPIFrameTransportStrategy", {
            initialize: function(identity, inboundPort, outboundPort){
                this._serde = getSerDeForBrowser();
                this._identity = identity;
                this._inboundPort = inboundPort;
                this._outboundPort = outboundPort;
                // "Inward" (targeted at this window)
                this._dispatchChannel = new UBPMessageChannel(this);
                // Outbound (self-binds)
                this._egressChannel = new UBPCompositeMessageChannel(this);

                UBPUtil.bindAll(this, "_onMessage", "_send");
                // _egress forwards to port (and optionally elsewhere)
                this._egressChannel.subscribe(this._send);
                if (this._inboundPort.addEventListener) {
                    this._inboundPort.addEventListener("message", this._onMessage, false);
                } else if (this._inboundPort.attachEvent) {
                    this._inboundPort.attachEvent("onmessage", this._onMessage);
                }
            },
            dispatchChannel: function() {
                return this._dispatchChannel;
            },
            forward: function(otherChannel) {
                this._egressChannel.join(otherChannel);
            },
            _send: function(msg) {
                var wrappedMessage = Message.typeIFrameTransport(this._identity, msg);
                // XXX: Figure out appropriate targetOrigin (rather than "*").
                // Problematically, in some contexts this will be the extension context,
                // which is different in FF/CR/OP, while in others it'll be straight
                // up amazon.com (but even then, it may be .com, .co.uk, etc, and on a
                // myriad of ports)
                if (this._outboundPort) {
                    this._outboundPort.postMessage(this._serde.serialize(wrappedMessage), "*");
                }
            },
            _onMessage: function(domMsg) {
                // TODO: Origin verification
                var payload = this._serde.deserialize(domMsg.data);
                var unwrapped = payload.payload;

                // Not self-targeting, and targeted at me
                if ((payload.origin && payload.origin !== this._identity) &&
                    // For now, this condition will always succeed, since
                    // we're explicitly setting destination to null
                    (!payload.destination || (payload.destination && payload.destination === this._identity))) {

                    // Ferry it
                    this._dispatchChannel.publish(this, unwrapped);
                }
            }
        });
    }());

    // Client used to talk to UBPCampaignAttributionService (which may be
    // either local or remote).
    var UBPCampaignAttributionClient = (function(){
        var NOOP = function() {};

        var MessagePayload = {
            typeSetBitCampaignCode: function(code) {
                return {
                    mType: "setBitCampaignCode",
                    code: code
                };
            },
            typeGetBitCampaignCode: function() {
                return {
                    mType: "getBitCampaignCode"
                };
            },
            typeSetTagbase: function(tagbase) {
                return {
                    mType: "setTagbase",
                    tagbase: tagbase
                };
            },
            typeGetTagbase: function() {
                return {
                    mType: "getTagbase"
                };
            },
            typeSetBitMode: function(bitmode) {
                return {
                    mType: "setBitMode",
                    bitmode: bitmode
                };
            },
            typeGetBitMode: function() {
                return {
                    mType: "getBitMode"
                };
            },
            typeSetAssociateId: function(associateid) {
                return {
                    mType: "setAssociateId",
                    associateid: associateid
                };
            },
            typeGetAssociateId: function() {
                return {
                    mType: "getAssociateId"
                };
            }
        };

        return UBPUtil.createKlass("CampaignAttributionService", {
            initialize: function() {
                this._messageExchange = new UBPMessageExchange();
            },
            messageExchange: function() {
                return this._messageExchange;
            },
            connect: function(service, cb) {
                cb = cb || NOOP;
                service.connectRequested(this, cb);
            },
            setBitCampaignCode: function(code, cb) {
                this._messageExchange.sendAndReceive(MessagePayload.typeSetBitCampaignCode(code), cb);
            },
            getBitCampaignCode: function(cb) {
                this._messageExchange.sendAndReceive(MessagePayload.typeGetBitCampaignCode(), function(err, msg){
                    if (err) {
                        cb(err);
                        return;
                    }
                    cb(null, msg.code);
                });
            },
            setTagbase: function(tagbase, cb) {
                this._messageExchange.sendAndReceive(MessagePayload.typeSetTagbase(tagbase), cb);
            },
            getTagbase: function(cb) {
                this._messageExchange.sendAndReceive(MessagePayload.typeGetTagbase(), function(err, msg){
                    if (err) {
                        cb(err);
                        return;
                    }
                    cb(null, msg.tagbase);
                });
            },
            setBitMode: function(bitmode, cb) {
                this._messageExchange.sendAndReceive(MessagePayload.typeSetBitMode(bitmode), cb);
            },
            getBitMode: function(cb) {
                this._messageExchange.sendAndReceive(MessagePayload.typeGetBitMode(), function(err, msg){
                    if (err) {
                        cb(err);
                        return;
                    }
                    cb(null, msg.bitmode);
                });
            },
            setAssociateId: function(associateid, cb) {
                this._messageExchange.sendAndReceive(MessagePayload.typeSetAssociateId(associateid), cb);
            },
            getAssociateId: function(cb) {
                this._messageExchange.sendAndReceive(MessagePayload.typeGetAssociateId(), function(err, msg){
                    if (err) {
                        cb(err);
                        return;
                    }
                    cb(null, msg.associateid);
                });
            }
        });
    }());

    var UBPCampaignAttributionSatelliteBootstrapper = (function(){

        return UBPUtil.createKlass("UBPCampaignAttributionSatelliteBootstrapper", {
            initialize: function(satelliteEndpoint, timeout) {
                this._satelliteEndpoint = satelliteEndpoint;
                this._timeout = timeout || 30 * 1000; // timeout after thirty seconds when building delegate

            },
            // Calls back with an error (if any) or a UBPRemoteServiceDelegate
            // connected to its service a UBPIFrameTransportStrategy connector
            buildIFrameBackedDelegate: function(cb) {
                var portHost = document.createElement("iframe");
                portHost.style.height = '0';
                portHost.style.width = '0';
                portHost.style.visibility = 'hidden';

                var heardFromSatellite = false;
                var didTimeout = false;

                var messageHandler = function(msg) {
                    // msg.data is specific to RATT/serviceSatellite
                    if (!didTimeout && !heardFromSatellite && msg.data === "UBPCampaignAttributionSatelliteReady") {
                        heardFromSatellite = true;
                        try {
                            var clientIFrameStrategy = new UBPIFrameTransportStrategy("CampaignClient", window, portHost.contentWindow);
                            var serviceDelegate = new UBPRemoteServiceDelegate(clientIFrameStrategy);
                            cb(null, serviceDelegate);
                        } catch (e) {
                            cb(e, null);
                        }
                    }
                };

                if (window.addEventListener) {
                    window.addEventListener("message", messageHandler, false);
                } else if (window.attachEvent) {
                    window.attachEvent("onmessage", messageHandler);
                }

                TaskManager.scheduleTask(function() {
                    if (!heardFromSatellite && !didTimeout) {
                        didTimeout = true;
                        cb(new Error("Timeout error setting up satellite"));
                    }
                }, this._timeout);

                portHost.src = this._satelliteEndpoint;
                document.body.appendChild(portHost);
            }
        });
    }());
 

    var NON_AMZNJQ_EXPORTS = {
        // TODO: Bust out into separate exports
        // UBPCMAL
        UBPCMAL: {
            UBPRemoteServiceDelegate: UBPRemoteServiceDelegate,
            UBPMessageChannel: UBPMessageChannel,
            UBPCompositeMessageChannel: UBPCompositeMessageChannel,
            UBPIFrameTransportStrategy: UBPIFrameTransportStrategy
        },
        // Campaign-attribution related
        UBPCampaignAttribution: {
            UBPCampaignAttributionService: UBPCampaignAttributionService,
            UBPCampaignAttributionClient: UBPCampaignAttributionClient,
            UBPCampaignAttributionSatelliteBootstrapper: UBPCampaignAttributionSatelliteBootstrapper
        }
    };

    if (typeof module !== "undefined" && module.exports) {
        // Firefox/Opera context
        if (typeof require !== "undefined") {
            var timers = require("sdk/timers");
            TaskManager.scheduleTask = timers.setTimeout;
        }

        module.exports = NON_AMZNJQ_EXPORTS;
    } else if (typeof define !== "undefined") {
        // Chrome context
        define([], function() {
            return NON_AMZNJQ_EXPORTS;
        });
    } else {
        // browser-scripts context

        window.UBPRemoteServiceDelegate = UBPRemoteServiceDelegate;
        window.UBPMessageChannel = UBPMessageChannel;
        window.UBPCompositeMessageChannel = UBPCompositeMessageChannel;
        window.UBPIFrameTransportStrategy = UBPIFrameTransportStrategy;
        // channeled message api library
        if (window.amznJQ) {
            amznJQ.declareAvailable("UBPCMAL");
        }

        window.UBPCampaignAttributionSatelliteBootstrapper = UBPCampaignAttributionSatelliteBootstrapper;
        window.UBPCampaignAttributionService = UBPCampaignAttributionService;
        window.UBPCampaignAttributionClient = UBPCampaignAttributionClient;

        if (window.amznJQ) {
            amznJQ.available("bit-json-polyfill", function() {
                amznJQ.declareAvailable('ubp-feature-campaign-attribution');
                amznJQ.declareAvailable('UBPCampaignAttribution');
            });
        }

        // Tutorial mode!
        // Purposefully left here.
        // window.UBPCMALTest = function() {
        //     var c1 = new UBPCampaignAttributionClient();
        //     var s1 = new UBPCampaignAttributionService();
        //     s1.start(function() {
        //         c1.connect(s1, function() {
        //             console.log("Setting code", "bit123");
        //             c1.setBitCampaignCode("bit123", function(){
        //                 c1.getBitCampaignCode(function(err, code){
        //                     console.log("Retrieved code", code);
        //                 });
        //             });
        //         });
        //     });

        //     // Test postMessage based dispatching

        //     var c2 = new UBPCampaignAttributionClient();
        //     var s2 = new UBPCampaignAttributionService();
 

        //     var clientIFrameStrategy = new UBPIFrameTransportStrategy("client", window);
        //     var serviceIFrameStrategy = new UBPIFrameTransportStrategy("service", window);

        //     var s2Delegate = new UBPRemoteServiceDelegate(clientIFrameStrategy);

        //     // Consume messages from the service's transport
        //     s2.messageExchange().listen(serviceIFrameStrategy.dispatchChannel());

        //     // Foward messages from the service's message exchange to the transport
        //     serviceIFrameStrategy.forward(s2.messageExchange().egressChannel());

        //     // Listen to all the messages and log them, for sanity
        //     window.addEventListener("message", function(msg){
        //         console.log(msg.data);
        //     }, false);

        //     s2.start(function() {
        //         c2.connect(s2Delegate, function() {
        //             console.log("Setting code", "bit456");
        //             c2.setBitCampaignCode("bit456", function(){
        //                 c2.getBitCampaignCode(function(err, code){
        //                     console.log("Retrieved code", code);
        //                 });
        //             });
        //         });

        //     });

        // };
    }
 
 
 

}());

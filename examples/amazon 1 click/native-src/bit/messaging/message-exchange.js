/*global define, require, module */
var factory = function (
    _,
    $lang,
    $options,
    TimeoutHash,
    MessageFactory,
    MessageChannel,
    CompositeMessageChannel
) {

    "use strict";

    /**
     * MessageExchange
     *
     * Responsibility
     * MessageExchange stands at the boundary of a system allowing the components
     * inside the system to talk to components that exist outside the system in a
     * uniform manner.
     *
     * Motivation
     * 1. To present a uniform "Channel" interface on top of the various message
     * 	  passing implementations.
     * 2. To support explicit data flow, rather than ad-hoc message handling.
     *
     * Illustration
     *
     *                   Foo System Boundary
     *
     *   Inside +-----------------------------------+ Outside
     *          |                                   |
     *          |         MessageExchange    +------+--------+
     *          |         ---------------    | EgressChannel |
     *          |                            +------+--------+
     * +--------+--------+                          |
     * | DispatchChannel |                          |
     * +--------+--------+                          |
     *          |                            +------+---------+
     *          |                            | IngressChannel |
     *          |                            +------+---------+
     *          |                                   |
     *          +-----------------------------------+
     *
     * Note: The term system in the following context refers to a component or set
     * of components representing a client, service or a proxy.
     *
     * The MessageExchange has the following 3 main components:
     * 1. EgressChannel:
     * 	  This MessageChannel is used to send messages from the components inside
     *    the Foo System to outside systems. Other systems may subscribe to this
     *    channel in order to receive messages from components inside the Foo System.
     *
     * 2. IngressChannel:
     *    This is a CompositeMessageChannel that is used to receive messages from the
     *    outside systems. Since it is a CompositeMessageChannel, the MessageExchange
     *    can receive messages from multiple systems by joining the outgoing channels
     *    of those systems to this CompositeMessageChannel called IngressChannel.
     *
     * 3. DispatchChanneel:
     *    All the messages received at the EgressChannel are transformed into the
     *    message type 'localDispatch' that includes additional information required
     *    to process this message (see localDispatch below) and sent to the
     *    DispatchChannel. A component called MessageDispatcher subscribes to this
     *    DispatchChannel. The MessageDispatcher is responsible for sending these
     *    messages to the right component inside the Foo system.
     *
     *
     * The MessageExchange deals with the following 4 types of Messages:
     * 1. rpcSend:
     *    This message is used when a component inside Foo System wants to send
     *    a message to an outside system. The message is sent on the EgressChannel.
     *    The 'rpcSend' message format consists of:
     *	  - msgId: UUID
     *    - mType: 'rpcSend'
     *    - payload: Payload of the message.
     *    - timestamp: Message creation timestamp.
     *
     *    The component inside the system can send this message as follows:
     *
     *    MessageExchange.send(payload);
     *    Here, payload: Payload of the message.
     *
     *
     * 2. rpcSendAndReceive
     *    This messsage is used when a component inside Foo System wants to send
     *    a message to an outside system and the component expects a reply. The
     *    message is sent on the EgressChannel. The 'rpcSendAndReceive' message
     *    format is same as the 'rpcSend' format, except for the mType field that
     *    contains the value 'rpcSendAndReceive'.
     *
     *    The component inside the Foo System can send this message as follows:
     *
     *    MessageExchange.sendAndReceive(payload, replyCallback);
     * 	  Here, payload: Payload of the message.
     *          replyCallback: Callback to be invoked when a reply is recevied.
     *
     *    Since there is a "reply" involved, MessageExchange keeps track of the msgId and
     *    the replyCallback in a TimeoutHash where each element has a timeout. This timeout
     *    is set to 30 seconds and can be updated in MessageExchange.prototype.initialize().
     *
     * 	  If the reply arrives in time, the corresponding replyCallback is fetched from the
     *    TimeoutHash using the msgId as the key and invoked with the reply payload. If the
     *    reply is late, MessageExchange invokes the replyCallback with an error and ignores
     *    the reply whenever it arrives.
     *
     *
     * 3. rpcReply
     *    This message contains the reply of a SendAndReceive message that was received at
     *    the MessageExchange of the Foo System. When the MessageExchange receives a
     *    SendAndReceive message, it forwards the payload to the dispatch channel along
     *    with a custom replyCallback. This replyCallback, when invoked, constructs the
     *    'rpcReply' message that Foo System's MessageExchange sends out on it's
     *    EgressChannel.
     *
     *    Fields in 'rpcReply' message format are a super set of fields in 'rpcSend' format,
     *    except that the mType field contains the value 'rpcReply' instead. The additional
     *    fields in this message format are:
     *    - rMsgId: UUID of the original message to which we're replying.
     *    - error: Contains the details of the error(s) encountered during the processing
     *             of this message.
     *
     *
     * 4. localDispatch
     * 	  This message is constructed by the MessageExchange upon receiving a message on it's
     *    IngressChannel. It contains additional information required for the components inside
     *    the Foo System to process the incoming message. The message itself is sent on the
     *    DispatchChannel. Fields in 'localDispatch' message format are a super set of fields
     *    in 'rpcSend' format, except that the mType field contains the value 'localDispatch'
     *    instead. The additional fields in this message format are:
     *    - oMsgId: UUID of the message received at the MessageExchange.
     *    - replyCallback: Callback to be invoked by the component processing the message.
     *
     * Usage:
     * Create a new MessageExchange:
     * var messageExchange = new MessageExchange();
     *
     * Send a message from the MessageExchange:
     * messageExchange.send(msg);
     *
     * Send a message expecting a response:
     * messageExchange.sendAndReceive(msg, replyCallback);
     *
     * Get the DispatchChannel to create a MessageDispatcher:
     * messageExchange.dispatchChannel();
     *
     * Get the EgressChannel:
     * messageExchange.egressChannel();
     *
     * Start listening to a Channel:
     * messageExchange.listen(channel);
     *
     * Stop listening to a Channel:
     * messageExchange.leave(channel);
     *
     * @see TimeoutHash
     * @see MessageFramework
     */
    var MessageExchange = function () {
        this.initialize.apply(this, arguments);
    };

    var DEFAULT_TIMEOUT = 30000; // milliseconds
    var TIMEOUT_ERROR = new Error("Reply timeout exceeded");

    _.extend(
            MessageExchange.prototype, {
                initialize: function (opts) {
                    opts = $options.fromObject(opts);

                    // Points inward, toward self. Messages received on this
                    // channel are from remote senders.
                    this._ingressChannel = new CompositeMessageChannel({
                        sentinel: this
                    });

                    // Points outward, toward remote recipient.
                    this._egressChannel = new MessageChannel({
                        sentinel: this
                    });

                    // Unwrapped messages are sent along this channel.
                    this._dispatchChannel = new MessageChannel({
                        sentinel: this
                    });

                    _.bindAll(this, "_onReplyTimeout", "_receive");
                    this._pendingRemoteReply = new TimeoutHash({
                        timeout: opts.getOrElse("remoteReplyTimeout", DEFAULT_TIMEOUT), 
                        onTimeout: this._onReplyTimeout
                    });

                    this._ingressChannel.subscribe(this._receive);
                    this._disposed = false;
                },

                dispose: function() {
                    if (this._disposed) {
                        return;
                    }

                    if (this._ingressChannel) {
                        this._ingressChannel.dispose();
                        this._ingressChannel = null;
                    }

                    if (this._egressChannel) {
                        this._egressChannel.dispose();
                        this._egressChannel = null;
                    }

                    if (this._dispatchChannel) {
                        this._dispatchChannel.dispose();
                        this._dispatchChannel = null;
                    }

                    if (this._pendingRemoteReply) {
                        this._pendingRemoteReply.dispose();
                        this._pendingRemoteReply = null;
                    }

                    this._disposed = true;
                },

                /**
                 * Returns the Dispatch channel.
                 */
                dispatchChannel: function () {
                    return this._dispatchChannel;
                },

                /**
                 * Returns the Egress channel.
                 */
                egressChannel: function () {
                    return this._egressChannel;
                },

                /**
                 * Allows the MessageExchange to listen to other channels.
                 * @param {Object} otherChannel
                 */
                listen: function (otherChannel) {
                    this._ingressChannel.join(otherChannel);
                },

                /**
                 * Allows the MessageExchange to stop listening to other channels.
                 * @param {Object} otherChannel
                 */
                leave: function (otherChannel) {
                    this._ingressChannel.leave(otherChannel);
                },

                twine: function(otherExchange) {
                    otherExchange.listen(this.egressChannel());
                    this.listen(otherExchange.egressChannel());
                },

                untwine: function(otherExchange) {
                    otherExchange.leave(this.egressChannel());
                    this.leave(otherExchange.egressChannel());
                },

                /**
                 * Sends a message from the MmessageExchange on the egress channel.
                 * @param {Object} msg - Message to be sent.
                 */
                send: function (msg) {
                    var wrappedMessage = MessageFactory.createMessage({
                        mType: "rpcSend",
                        msg: msg
                    });
                    this._egressChannel.publish(this, wrappedMessage);
                },

                /**
                 * Sends a message on the egress channel and waits for a reply on ingress channel.
                 * @param {Object} msg - Message to be sent.
                 * @param {Function} replyCallback - Callback to be invoked when the reply is recevied.
                 * @param {number} timeout - (optional) Timeout in milliseconds for this request. 
                 *                                      If not specified, will default to {@link #DEFAULT_TIMEOUT}.
                 */
                sendAndReceive: function (msg, replyCallback, timeout) {
                    replyCallback = replyCallback || $lang.noop;
                    if(!timeout) {
                        timeout = this._timeout;
                    } else if(typeof timeout !== "number") {
                        replyCallback(new Error("Specified timeout is not a number: " + timeout));
                        return;
                    }

                    var wrappedMessage = MessageFactory.createMessage({
                        mType: "rpcSendAndReceive",
                        msg: msg
                    });
                    this._pendingRemoteReply.put(wrappedMessage.msgId, replyCallback, timeout);
                    this._egressChannel.publish(this, wrappedMessage);
                },

                /**
                 * Sends a reply on the egress channel.
                 * @param {string} originalMsgId - Id of the message that is being replied to.
                 * @param {Object} error - Error that occured while processing the original message.
                 * @param {Object} replyMsg - Message to be sent in response.
                 */
                _reply: function (originalMsgId, error, replyMsg) {
                    var wrappedMessage = MessageFactory.createMessage({
                        mType: "rpcReply",
                        msg: replyMsg,
                        rMsgId: originalMsgId,
                        error: error
                    });
                    this._egressChannel.publish(this, wrappedMessage);
                },

                /**
                 * Receives the message on the ingress channel and passes it to the right dispatcher.
                 * @param {Object} wrappedMessage - Message received.
                 */
                _receive: function (wrappedMessage) {
                    var dispatcher = "_receive_" + wrappedMessage.mType;
                    if (this[dispatcher]) {
                        this[dispatcher](wrappedMessage);
                    } else {
                        return;
                    }
                },

                /**
                 * Processes the reply received as part of the "SendAndReceive" message.
                 * @param {Object} wrappedMessage - Message received.
                 */
                _receive_rpcReply: function (wrappedMessage) {
                    // Look up pending original caller based on rMsgId ("in reply to"), dispatch
                    var rMsgId = wrappedMessage.rMsgId,
                        payload = wrappedMessage.payload,
                        remoteError = wrappedMessage.error,
                        candidateCallback = this._pendingRemoteReply
                            .getAndRemove(rMsgId);
                    if (candidateCallback) {
                        if (remoteError) {
                            candidateCallback(new Error(remoteError));
                        } else {
                            candidateCallback(null, payload);
                        }
                    }
                },

                /**
                 * Processes a message that was sent as part of the "Send" message from another MessageExchange.
                 * @param {Object} wrappedMessage - Message received.
                 */
                _receive_rpcSend: function (wrappedMessage) {
                    // Dispatch along dispatch channel
                    var payload = wrappedMessage.payload,
                        originalMsgId = wrappedMessage.msgId;

                    this._dispatchChannel.publish(this, MessageFactory.createMessage({
                        mType: "localDispatch",
                        msg: payload,
                        originalMsgId: originalMsgId,
                        replyCallback: $lang.noop
                    }));

                },


                /**
                 * Processes a message that was sent as part of the "SendAndReceive" message from another MessageExchange.
                 * @param {Object} wrappedMessage - Message received.
                 */
                _receive_rpcSendAndReceive: function (wrappedMessage) {
                    // Dispatch with reply callback
                    var payload = wrappedMessage.payload,
                        originalMsgId = wrappedMessage.msgId,
                        replyCallback = _
                            .bind(function (err, replyMsg) {
                                if (err) {
                                    // Coerce to string, so it's safe for message passing
                                    err = "" + err;
                                    // In the error case, don't bother sending data
                                    payload = null;
                                }

                                var wrappedReplyMessage = MessageFactory.createMessage({
                                    mType: "rpcReply",
                                    msg: replyMsg,
                                    inReplyTo: originalMsgId,
                                    error: err
                                });

                                this._egressChannel.publish(this, wrappedReplyMessage);
                            }, this);
                    this._dispatchChannel.publish(this, MessageFactory.createMessage({
                        mType: "localDispatch",
                        msg: payload,
                        originalMsgId: originalMsgId,
                        replyCallback: replyCallback
                    }));
                },

                /**
                 * Invokes the Callback with a timeout error.
                 * @param {string} msgId - Id of the "SendAndReceive" message.
                 * @param {Function} originalCallback - Callback to be invoked for the reply.
                 */
                _onReplyTimeout: function (msgId, originalCallback) {
                    try {
                        originalCallback(TIMEOUT_ERROR);
                    } catch (e) {
                        throw e;
                    }
                }
            });

    MessageExchange.TIMEOUT_ERROR = TIMEOUT_ERROR;

    return MessageExchange;
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bit/commons/lang"),
        require("bit/commons/options"),
        require("bit/commons/timeout-hash"),
        require("bit/messaging/message-factory"),
        require("bit/messaging/message-channel"),
        require("bit/messaging/composite-message-channel")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bit/commons/lang",
        "bit/commons/options",
        "bit/commons/timeout-hash",
        "bit/messaging/message-factory",
        "bit/messaging/message-channel",
        "bit/messaging/composite-message-channel"
    ], factory);
}

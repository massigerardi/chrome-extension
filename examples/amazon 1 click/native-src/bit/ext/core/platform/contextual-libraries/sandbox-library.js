var factory = function() {
    /**
     *
     * In any given window receiving messages to create notifications, there is
     * a single SandboxManager instance which ferries notifications between
     * the runtime context and the various embedded notification contexts.
     *
     * SandboxManager#createNotification responds with a handle of the
     * embedded notification. Subsequent messages sent to a given embedded
     * notification are endpointed using this handle.
     */
    var SandboxManager = function() {
        this.initialize.apply(this, arguments);
    };

    SandboxManager.prototype = {
        initialize: function(opts) {
            this._strategy = opts.strategy;
            if (!this._strategy) {
                throw new Error("SandboxManager requires a notification creation strategy");
            }


            // This is the delegate function that we call when we want
            // to message upward to the extension context.
            // The library driver is responsible for wiring this
            // appropriately.
            this._onMessageFun = opts.onMessage || function() {};

            // Array of origin strings, e.g.:
            //
            //  ["https://www.amazon.com", "https://match.amazonbrowserapp.com"]
            this._whitelistedOrigins = opts.whitelistedOrigins || [];

            // Ensure onMessage is appropriately bound to this instance.
            // This is the equivalent of _.bindAll(this, "onMessage"),
            // if we hand underscore.js in this execution context.
            this.sandboxMessageHandler = function(self, sandboxMessageHandler){
                return function() {
                    sandboxMessageHandler.apply(self, arguments);
                };
            }(this, this.sandboxMessageHandler);

            // Before the child window has messaged back with its first
            // postMessage, the handle is in the pendingWindows lookup hash.
            this._pendingSandboxes = {};

            // Once a child has messaged back to us, we have a handle to its
            // window via message.source. Subsequent outgoing messages to the
            // window can happen by direct dispatch to the window.
            this._establishedSandboxes = {};
        },


        /**
         * addWhitelistedOrigin - add a valid origin for messages received from
         *                        sandboxes. This exists to allow the runtime
         *                        to add valid origins in a late-bound fashion,
         *                        which may be necessary, especially in beta
         *                        and gamma execution contexts.
         */
        addWhitelistedOrigin: function(origin) {
            this._whitelistedOrigins.push(origin);
        },

        /**
         * sandboxMessageHandler - bound handler for incoming postMessages.
         *
         * Recipient of postMessages to this window from sandbox windows,
         * but in practice anyone posting to the page - so we do careful origin
         * checking before ferrying the message to the extension. Any messages
         * sent from origins not in the whitelist provided at
         * instantiation time will be silently dropped.
         *
         * Method is bound to instance in initializer.
         */
        sandboxMessageHandler: function(msg) {
            if (!this._isValidOrigin(this._strategy.grokOrigin(msg.origin))) {
                return;
            }

            if (!this._isRelevantMessage(msg)) {
                return;
            }

            // Handle "initialHandshake" messages

            if (this._isHandshakeMessage(msg)) {
                this._handleHandshake(msg);
            } else {
                this._handleMessage(msg);
            }
        },

        /**
         * Validates provided origin against whitelist.
         */
        _isValidOrigin: function(origin) {
            return (this._whitelistedOrigins.indexOf(origin) !== -1);
        },

        /**
         * Checks to see if this is a message that we care about.
         * We care about messages if they're in the right format (at minimum having a handle,
         * mType), and are in one of our two buckets of pending or established sandboxes.
         */
        _isRelevantMessage: function(msg) {
            // We only care about messages that have the right format,
            // and are within our scope of interest - i.e., either
            // in our pending or established lists
            return (msg && msg.data && msg.data.mType && msg.data.handle && // Format check
                (this._pendingSandboxes[msg.data.handle] || // One of our "pending" windows (handshaking)
                this._establishedSandboxes[msg.data.handle])) // One of our "established" windows (handshaked)
        },

        _isHandshakeMessage: function(msg) {
            // TODO: Bust this out into a CONST above
            return (msg && msg.data && msg.data.mType === "UBPSandboxHandshake" && msg.source);
        },


        /**
         * Takes the message from pending and puts it into established.
         * Also hangs on to the source window for easy messaging later.
         * That's the important part!
         */
        _handleHandshake: function(msg) {
            var handle = msg.data.handle;
            if (this._pendingSandboxes[handle]) {
                this._establishedSandboxes[handle] = msg.source;
                delete this._pendingSandboxes[handle];
            } else if (this._establishedSandboxes[handle]) {
                // Just update it. It's possible the window got reloaded somehow?
                this._establishedSandboxes[handle] = msg.source;
            }
        },

        isPending: function(handle) {
            return !!this._pendingSandboxes[handle];
        },

        didHandshake: function(handle) {
            return !!this._establishedSandboxes[handle];
        },

        /**
         * General message handler. Handles everything that isn't a handshake.
         */
        _handleMessage: function(msg) {
            this._onMessageFun(msg.data);
        },

        // DOM ID friendly identifier
        _generateId: function() {
            return "UBPNotif-" + somewhatRandom();
        },

        /**
         * createSandbox                      - creates a new on-page sandbox (iframe). Note that creating a
         *                                      sandbox automatically whitelists the origin of requested endpoint to be loaded in the sandbox.
         *
         * @param {object} sandboxSpec        - options for creating a sandbox:
         *
         * @param {string} sandboxSpec.url    - URL of embedded content
         *
         * @param {string} sandboxSpec.x      - X position of notification (assumes top-left CSS
         *                                      alignment). Defaults to 0.
         *
         * @param {string} sandboxSpec.y      - Y position of notification (assumes top-left CSS
         *                                      alignment). Defaults to 0.
         *
         * @param {string} sandboxSpec.width  - Number or % width of containing iframe. Defaults
         *                                      to 100%
         *
         * @param {string} sandboxSpec.height - Number or % height of containing iframe. Defaults to
         *                                      80 pixels.
         *
         * @returns {string} sandboxHandle    - Opaque ID representing the sandbox
         */
        createSandbox: function(sandboxSpec) {
            // Should return a notification handle (opaque ID)
            var handle = this._generateId();


            // We do a little fudging so the iframe knows how to
            // identify itself when messaging back out.
            // The target document should look for this attribute,
            // and include it on any message it postMessages to its
            // parent, so we can endpoint the message appropriately.
            var targetUrl = sandboxSpec.url;
            if (!targetUrl) {
                throw new Error("createNotification requires a target url");
            }
            if (targetUrl.indexOf("?") === -1) {
                targetUrl = targetUrl + "?ubpSandboxHandle=" + handle;
            } else {
                targetUrl = targetUrl + "&ubpSandboxHandle=" + handle;
            }


            var proxyUrl = sandboxSpec.proxy;
            if (proxyUrl) {
                if (proxyUrl.indexOf("?") === -1) {
                    proxyUrl = proxyUrl + "?target=" + encodeURIComponent(targetUrl);
                } else {
                    proxyUrl = proxyUrl + "&target=" + encodeURIComponent(targetUrl);
                }
                if (sandboxSpec.proxyNoScroll) {
                    proxyUrl = proxyUrl + "&noScroll=1";
                }

                 sandboxSpec.url = proxyUrl;

            } else {
                sandboxSpec.url = targetUrl;
            }


            // When the window phones upward, we'll move the
            // notif from pending to established
            this._pendingSandboxes[handle] = true;
            this._strategy.createSandbox(handle, sandboxSpec);

            var origin = this._strategy.grokOrigin(sandboxSpec.url);
            if (origin) {
                this.addWhitelistedOrigin(origin);
            }

            return handle;
        },
        modifySandbox: function(handle, sandboxSpec) {
            if (this._pendingSandboxes[handle]) {
                return;
            }

            if (!this._establishedSandboxes[handle]) {
                return;
            }
            this._strategy.modifySandbox(handle, sandboxSpec);
        },
        destroySandbox: function(handle) {
            var wasValid = false;
            if (this._pendingSandboxes[handle]) {
                wasValid = true;
                delete this._pendingSandboxes[handle];
            }

            if (this._establishedSandboxes[handle]) {
                wasValid = true;
                delete this._establishedSandboxes[handle];
            }

            if (wasValid) {
                this._strategy.destroySandbox(handle);
            }
        }
    };

    // We're busting iframe creation out into a strategy.
    // Makes testing SandboxManager a bit more sane.
    var IFrameCreationStrategy = function() {
        this.initialize.apply(this, arguments);
    };

    IFrameCreationStrategy.prototype = {
        initialize: function(doc) {
            this._doc = doc;
        },
        grokOrigin: function(url) {
            var a = document.createElement("a");
            a.href = url;
            var origin = a.protocol + "//" + a.host;
            return origin;
        },
        createSandbox: function(handle, opts) {
            var url     = opts.url,
                left    = opts.left    || "0",
                right   = opts.right   || "auto",
                top     = opts.top     || "0",
                width   = opts.width   || "0",
                height  = opts.height  || "0",
                border  = opts.border  || '0',
                display = opts.display || 'block',
                boxShadow = opts.boxShadow || 'none',
                background = opts.background || 'transparent',
                position = opts.position || 'absolute',
                padding = opts.padding || "0",
                zIndex  = opts.zIndex || 99999,
                borderRadius = opts.borderRadius || "0",
                overflowX = opts.overflowX || "visible",
                overflowY = opts.overflowY || "visible";

            var frame = this._doc.createElement("iframe");

            frame.height = height;
            frame.width = width;
            var cssFriendlyHeight = height.indexOf("%") === -1 ? height + "px" : height;
            var cssFriendlyWidth = width.indexOf("%") === -1 ? width + "px" : width;
            frame.style.height = cssFriendlyHeight;
            frame.style.width = cssFriendlyWidth;

            frame.style.position = position;
            frame.style.top = top;
            frame.style.left = left;
            frame.style.right = right;
            frame.style.position = position;
            frame.style.zIndex = zIndex;
            frame.style.padding = padding;
            frame.style.border = border;
            frame.style.display = display;
            frame.style.boxShadow = boxShadow;
            frame.style.background = background;
            frame.style.borderRadius = borderRadius;
            frame.style.overflowX = overflowX;
            frame.style.overflowY = overflowY;

            frame.src = opts.url;
            frame.setAttribute("id", handle);
            this._doc.body.appendChild(frame);
        },
        modifySandbox: function(handle, spec) {
            var frame = document.getElementById(handle);

            if (typeof spec.top !== "undefined") {
                frame.style.top = spec.top;
            }

            if (typeof spec.left !== "undefined") {
                frame.style.left = spec.left;
            }

            if (typeof spec.height !== "undefined") {
                frame.height = spec.height;
                var cssFriendlyHeight = spec.height.indexOf("%") === -1 ? spec.height + "px" : spec.height;
                frame.style.height = cssFriendlyHeight;
            }

            if (typeof spec.width !== "undefined") {
                frame.width = spec.width;
                var cssFriendlyWidth = spec.width.indexOf("%") === -1 ? spec.width + "px" : spec.width;
                frame.style.width = cssFriendlyWidth;
            }

            if (typeof spec.border !== "undefined") {
              frame.style.border = border;
            }

            if (typeof spec.display !== "undefined") {
              frame.style.display = spec.display;
            }

            if (typeof spec.boxShadow !== "undefined") {
                frame.style.boxShadow = spec.boxShadow;
            }

            if (typeof spec.position !== "undefined") {
                frame.style.position = spec.position;
            }

            if (typeof spec.zIndex !== "undefined") {
                frame.style.zIndex = spec.zIndex;
            }

            if (typeof spec.borderRadius !== "undefined") {
                frame.style.borderRadius = spec.borderRadius;
            }

            if (typeof spec.overflowX !== "undefined") {
                frame.style.overflowX = spec.overflowX;
            }

            if (typeof spec.overflowY !== "undefined") {
                frame.style.overflowY = spec.overflowY;
            }

        },
        destroySandbox: function(handle) {
            var frame = document.getElementById(handle);
            if (frame) {
                frame.parentNode.removeChild(frame);
            }
        }
    };


    var seq = 0;
    var rnd = Math.random() * 255 | 0;
    // Returns an ID that's guaranteed to be unique within a window,
    // is likely (but not guaranteed) unique within a set of windows,
    // and definitely not unique across multiple clients.
    var somewhatRandom = function() {
        seq++;
        return rnd + "-" + Date.now() + "-" + seq;
    };

    // Multi-export
    var SandboxLibrary = {
        SandboxManager: SandboxManager,
        IFrameCreationStrategy: IFrameCreationStrategy
    };

    return SandboxLibrary;

};

if (typeof window !== "undefined") {
    window.UBPAPISupport = window.UBPAPISupport || {};
    window.UBPAPISupport.SandboxLibrary = factory();
}

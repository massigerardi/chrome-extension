var factory = function(
    _,
    Promise,
    $uuid,
    $options
) {

    /**
     * A SandboxDelegate has two methods, `SandboxDelegate#fabricate(url, cb)`
     * and `SandboxDelegate#destroy(handle, cb)`. An IframeRemoteProcessSandboxDelegate
     * is a type of SandboxDelegate that creates sandboxes using IFrames.
     *
     * The `SandboxDelegate#fabricate` method calls back with a `{bindable,handle}` result.
     * The `bindable` is suitable for passing to a PostMessageTransportStrategy. The
     * `handle` can be passed back to the SandboxDelegate to destroy the underlying iframe.
     *
     * The IframeRemoteProcessSandboxDelegate maintains an internal map of `handle` to
     * `iframe`, negating the need for anyone to manually manage the iframe DOM elements.
     */
    var IframeRemoteProcessSandboxDelegate = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(IframeRemoteProcessSandboxDelegate.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._inboundPort = opts.getOrError("inboundPort");
            this._sandboxes = {};
        },
        fabricate: function(url, cb) {
            var state = {
                owner: this,
                sandbox: null
            };
            // "this" is "state" for the duration of the chain
            return Promise.bind(state)
            .then(function() {
                var id = $uuid.v4();

                var sandbox = new Sandbox({
                    id: id,
                    url: url,
                    inboundPort: this.owner._inboundPort
                });

                this.sandbox = sandbox;
                return sandbox.build();
            })
            .then(function(bindable) {
                // "this" is the state obj at the top
                var sandbox = this.sandbox;

                // owner is the iframeRemoteProcessSandboxDelegate
                var owner = this.owner;
                owner._sandboxes[sandbox.id()] = sandbox;

                return {
                    handle: sandbox.id(),
                    bindable: bindable
                };
            })
            .nodeify(cb);
        },
        destroy: function(handle, cb) {
            Promise.bind(this)
            .then(function() {
                var s = this._sandboxes[handle];
                if (s) {
                    s.dispose();
                    delete this._sandboxes[handle];
                }
            }).nodeify(cb);
        }
    });

    var Sandbox = function() {
        this.initialize.apply(this, arguments);
    };

    _.extend(Sandbox.prototype, {
        initialize: function(opts) {
            opts = $options.fromObject(opts);
            this._id = opts.getOrError("id");
            this._url = opts.getOrError("url");
            this._inboundPort = opts.getOrError("inboundPort");
            this._frame = null;

            this._disposed = false;
        },
        id: function() {
            return this._id;
        },
        // Should return a bindable
        build: Promise.method(function() {
            var bindable = {
                inboundPort: this._inboundPort,
                outboundPort: null
            };

            if (!this._frame) {
                var f = document.createElement("iframe");
                f.style.display = 'none';
                f.style.height = '0';
                f.style.width = '0';
                f.width = '0';
                f.height = '0';
                f.src = this._url;
                document.body.appendChild(f);
                this._frame = f;
            };

            bindable.outboundPort = this._frame.contentWindow;
            return bindable;
        }),

        dispose: function() {
            if (this._disposed) {
                return;
            }

            if (this._frame) {
                var p = this._frame.parentNode;
                if (p) {
                    p.removeChild(this._frame);
                }
                this._frame = null;
            }

            this._inboundPort = null;
            this._disposed = true;
        }
    });

    return IframeRemoteProcessSandboxDelegate;

};

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
        require("underscore"),
        require("bluebird"),
        require("bit/commons/uuid"),
        require("bit/commons/options")
    );
} else if (typeof define !== "undefined") {
    define([
        "underscore",
        "bluebird",
        "bit/commons/uuid",
        "bit/commons/options"
    ], factory);
}

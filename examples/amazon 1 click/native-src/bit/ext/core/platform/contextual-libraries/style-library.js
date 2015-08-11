var factory = function() {

    "use strict";

    var StyleManager = function() {
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

    StyleManager.prototype = {
        initialize: function(doc) {
            this._doc = doc;
            this._handles = {};
        },
        _getElement: function(styleSpec) {
            var element;
            if (styleSpec.selector === "getElementById") {
                element = this._doc.getElementById(styleSpec.identifier);
            } else if (styleSpec.selector === "getElementsByName") {
                element = this._doc.getElementsByName(styleSpec.identifier)[styleSpec.identifierIdx];
            } else if (styleSpec.selector === "getElementsByTagName") {
                element = this._doc.getElementsByTagName(styleSpec.identifier)[styleSpec.identifierIdx];
            } else if (styleSpec.selector === "getElementsByClassName") {
                element = this._doc.getElementsByClassName(styleSpec.identifier)[styleSpec.identifierIdx];
            }
            return element;
        },
        _generateId: function() {
            return "UBPStyle-" + uuid();
        },

        /*
         * applyStyle    Applies style to an element
         *
         * @param {Object} styleSpec - style specification:
         *  {
         *      // Selector to be used for picking the target element
         *      selector: "getElementsByTagName",
         *      // Identifier to be used for the selector
         *      identifier: "html",
         *      // Index to be used, if required, to pick the right element
         *      identifierIdx: 0,
         *      // Should this element accept any more style update requests
         *      finialize: true,
         *      // Style serialized as a continuous string
         *      style: "margin-top: 10px",
         *   }
         *
         * @return handle   Handle to this style application.
         */
        applyStyle: function(styleSpec) {

            var element = this._getElement(styleSpec);

            // Does the element exist and is the element style locked?
            if (!element ||
                // element.dataset may not exist for older browsers
                // such as IE 10.
                (element.dataset &&
                element.dataset.ubpStyleFinalized)) {
                    return null;
            }

            var handle = this._generateId();
            var currentStyle = element.getAttribute("style") || "";

            this._handles[handle] = {
                element: element,
                style: currentStyle
            };

            // Apply the new style
            element.setAttribute("style", [currentStyle, styleSpec.style].join("; "));

            // Lock the element if requested.
            if (styleSpec.finialize) {
                // Introduce element.dataset for browsers
                // that do not support the dataset property
                // such as IE 10.
                if (!element.dataset) {
                    element.dataset = {};
                }
                element.dataset.ubpStyleFinalized = handle;
            }

            return handle;
        },

        /*
         * resetStyle   Reset the style applied to an element
         *              The style of the element after this operation
         *              is what it was immediately before the
         *              corresponding style was applied.
         *
         * @param {Object} handle - handle that was returned when
         *                          a style was applied
         */
        resetStyle: function(styleSpec) {
            var handleContent = this._handles[styleSpec.handle];
            if (handleContent) {
                handleContent.element.setAttribute("style", handleContent.style);
                // The short hand notation...
                // delete element.dataset.ubpStyleFinalized
                // ...does not work in Firefox
                handleContent.element.removeAttribute("data-ubp-style-finalized");
                // Remove the ubpStyleFinalized dataset property
                // for browsers that do not support dataset.
                if (handleContent.element.dataset &&
                    handleContent.element.dataset.ubpStyleFinalized) {
                    delete handleContent.element.dataset.ubpStyleFinalized;
                }
                delete this._handles[styleSpec.handle];
            }
        }
    };

    return StyleManager;

};

if (typeof window !== "undefined") {
    window.UBPAPISupport = window.UBPAPISupport || {};
    window.UBPAPISupport.StyleManager = factory();
}
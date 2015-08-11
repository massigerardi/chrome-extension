var factory = function() {

    "use strict";

    var HoverManager = function() {
        this.initialize.apply(this, arguments);
    };

    HoverManager.prototype = {
        /* Initializes the Hover Manager
         *
         * @param {object} opts - {
         *                            window: DOM window
         *                            document: DOM document
         *                            sendMessage: function(msg) to post messages back to extension
         *                            matches: Element.matches(), rewritten as function(element, selector)
         *                        }
         */
        initialize: function(opts) {
            this._window = opts.window;
            this._document = opts.document;
            this._sendMessage = opts.sendMessage || function() {};
            this._matches = opts.matches || function() { return false; };
        },

        /* Adds buttons and styles to page, and attaches event handlers to document and buttons
         * When an image receives a mouseover event, if it isn't blacklisted or its width too small,
         * a button is displayed at its top-left corner. Additional logic is present to handle the
         * case where focus is lost to a covering element (e.g. hover zoom). When the mouse leaves
         * the image, the button is hidden. Clicking the button sends an event to the Hover process.
         *
         * @param {object} config - {
         *                              blacklist: (optional) array of blacklisted CSS selectors
         *                              pinterest: (optional) information used to not cover "Pin it!"
         *                                  {
         *                                      attribute: HTML attribute added to body by extension
         *                                      selector: unique selector for "Pin it!" button
         *                                  }
         *                              stylesheet: array, (CSS stylesheet innerHTML).split('\n');
         *                              buttons: array of objects containing button information
         *                                  [{
         *                                      id: id attribute of button
         *                                      class: class attribute of button
         *                                      height: height of button in pixels
         *                                              (includes border & padding, no margin)
         *                                      minWidth: minimum width in pixels of target for appearing
         *                                      padding: offset in pixels from the top and left of target
         *                                  },...]
         *                          }
         */
        injectScript: function(config) {
            var currentTarget = null,
                currentButton = null,
                currentCover = null,
                bounds = {top: 0, left: 0, right: 0, bottom: 0},
                buttonInfos = [],
                _window = this._window,
                _document = this._document,
                _matches = this._matches,
                _addToWishList = this._addToWishList.bind(this),
                blacklist = config.blacklist || [],
                pinterestInfo = config.pinterest || null;

            /* Returns the numeric value of a property in a style
             *
             * @param {CSSStyleDeclaration} style - output of window.getComputedStyle for some element
             *
             * @param {string} property           - CSS property name whose values match the regex ^[0-9]+(\.[0-9]+)?.*$
             *
             * @return {number} numeric value of the part that matches ^[0-9]+(\.[0-9]+)?
             */
            var fromPixels = function(style, property) {
                return parseFloat(style[property], 10);
            };

            /* Calculates the absolute offset of an element relative to the page
             *
             * @param {Element} element - the element
             *
             * @return {object} {
             *                      {number} left: left absolute offset in pixels
             *                      {number}  top: top absolute offset in pixels
             *                  }
             */
            var offsetOf = function(element) {
                var elementRect = element.getBoundingClientRect(),
                    bodyRect = _document.body.getBoundingClientRect(),
                    htmlRect = _document.body.parentElement.getBoundingClientRect();
                return {
                    left: elementRect.left + _window.scrollX + (htmlRect.left - bodyRect.left),
                     top: elementRect.top  + _window.scrollY + (htmlRect.top  - bodyRect.top)
                };
            };

            /* Finds the pinterest badge, if the pinterest extension is installed
             *
             * @return {Element} the pinterest badge
             */
            var getPinterest = function() {
                if (!pinterestInfo || !_document.body.hasAttribute(pinterestInfo.attribute)) return null;
                return _document.querySelector(pinterestInfo.selector);
            };

            /* @param {Element} element - a DOM element
             *
             * @return true if a button should not be shown for element
             */
            var blacklisted = function(element) {
                return blacklist.some(function(selector) {
                    return _matches(element, selector);
                });
            };

            /* Calculates the offset of the inner content of an element (after applying padding, border and negative margin)
             *
             * @param {CSSStyleDeclaration} style - output of window.getComputedStyle for an element
             *
             * @return {object} {
             *                      {number} x: the x offset of style's element's inner content relative to its position
             *                      {number} y: the y offset of style's element's inner content relative to its position
             *                  }
             */
            var deltasFrom = function(style) {
                var paddingTop = fromPixels(style, 'padding-top'),
                    paddingLeft = fromPixels(style, 'padding-left'),
                    borderTop = fromPixels(style, 'border-top'),
                    borderLeft = fromPixels(style, 'border-left'),
                    marginTop = fromPixels(style, 'margin-top'),
                    marginLeft = fromPixels(style, 'margin-left');
                return {
                    x: paddingLeft + borderLeft - (marginLeft < 0 ? marginLeft : 0),
                    y: paddingTop + borderTop - (marginTop < 0 ? marginTop : 0) 
                };
            };

            /* Handler for when the document receives a mouseover event on an image
             * Responsible for showing a button and moving pinterest's badge so it's not occluded
             *
             * @param {Event} event - the event
             */
            var imgMouseover = function(event) {
                var target = event.target,
                    style = _window.getComputedStyle(target),
                    height = fromPixels(style, 'height'),
                    width = fromPixels(style, 'width');

                if (!target.src || target.src.substr(0, 5) === 'data:') return;
                if (blacklisted(target)) return;

                var buttonInfo = null; // buttonInfos.find(i => i.minWidth <= width);
                for (var i = 0, len = buttonInfos.length; i < len && !buttonInfo; ++i) {
                    if (buttonInfos[i].minWidth <= width) {
                        buttonInfo = buttonInfos[i];
                    }
                }
                if (!buttonInfo) return;

                hide();

                var offset = offsetOf(target),
                    delta = deltasFrom(style),
                    padding = buttonInfo.padding,
                    top = offset.top + delta.y + padding,
                    left = offset.left + delta.x + padding;

                currentButton = buttonInfo.button;
                currentButton.style.top = top + 'px';
                currentButton.style.left = left + 'px';
                currentButton.style.display = 'block';

                currentTarget = target;
                bounds = {top: offset.top, left: offset.left, right: offset.left + width, bottom: offset.top + height};

                var pinterest = getPinterest();
                if (pinterest) {
                    setTimeout(function() {
                        pinterest.style.top = (top + buttonInfo.height + padding) + 'px';
                        pinterest.style.left = left + 'px';
                    }, pinterestInfo.delay);
                }
            };

            /* Determines whether an event occurred over the currentTarget image by checking if its position occurred within its bounding box
             *
             * @param {Event} event - the event
             *
             * @return true if and only if the event occurred over the currentTarget image
             */
            var withinBounds = function(event) {
                return event.pageX > bounds.left && event.pageX < bounds.right && event.pageY > bounds.top && event.pageY < bounds.bottom;
            };

            /* Handler for when the document receives a mouseout event on an image
             * Responsible for either setting currentCover if the mouse is still within the image or hiding the button
             *
             * @param {Event} event - the event
             */
            var imgMouseout = function(event) {
                if (!currentTarget || event.target !== currentTarget) return;

                var toElement = event.toElement || event.relatedTarget;
                if (toElement === currentButton) return;

                if (withinBounds(event)) {
                    setCover(toElement);
                } else {
                    hide();
                }
            };

            /* @param {Element} element - an element
             *
             * @return true if and only if element is the currentCover, or is a parent or child of the currentCover
             */
            var coverParentOrChild = function(element) {
                return element === currentCover || element.parentNode === currentCover || currentCover.parentNode === element;
            }

            /* Handler for when the currentCover element receives a mouseout event
             * Responsible for removing currentCover, transferring currentCover status, or hiding the button
             *
             * @param {Event} event - the event
             */
            var coverMouseout = function(event) {
                var toElement = event.toElement || event.relatedTarget;
                if (toElement === currentButton) return;

                if (toElement === currentTarget) {
                    setCover(null);
                } else if (withinBounds(event) && coverParentOrChild(toElement)) {
                    setCover(toElement);
                } else {
                    hide();
                }
            };

            /* Sets the currentCover to element and wires/unwires event handlers from the new and previous currentCover
             *
             * @param {Element} element - the new currentCover
             */
            var setCover = function(element) {
                if (currentCover) {
                    currentCover.removeEventListener('mouseout', coverMouseout);
                    currentCover = null;
                }
                if (element) {
                    currentCover = element;
                    currentCover.addEventListener('mouseout', coverMouseout);
                }
            };

            /* Handler for when a button receives a mouseout event
             * Responsible for doing nothing if the mouse returns to the currentTarget, setting cover, or hiding
             *
             * @param {Event} event - the event
             */
            var buttonMouseout = function(event) {
                var toElement = event.toElement || event.relatedTarget;
                if (toElement === currentTarget) return;

                if (currentCover && coverParentOrChild(toElement)) {
                    setCover(toElement);
                } else {
                    hide();
                }
            };

            /* Hides the button, clears the currentCover and currentTarget
             */
            var hide = function() {
                if (currentButton) {
                    currentButton.style.display = 'none';
                    currentButton = null;
                }
                currentTarget = null;
                setCover(null);
            };

            /* @param {Element} imageElement - an image element (<img>) with src attribute
             *
             * @return {string} the absolute path of imageElement's source
             */
            var getAbsoluteSrc = function(imageElement) {
                var temp = new Image();
                temp.src = imageElement.src;
                return temp.src;
            };

            /* Handler for when a button receives a click event
             * Calls _addToWishList, which spawns the UWL add item form in a sandbox
             */
            var buttonClick = function() {
                var imgCStyle = _window.getComputedStyle(currentTarget),
                    imgData = {
                           src: getAbsoluteSrc(currentTarget),
                        height: fromPixels(imgCStyle, 'height'),
                         width: fromPixels(imgCStyle, 'width'),
                         title: currentTarget.getAttribute('title') || _document.title
                    },
                    pageData = {
                        width: _document.body.clientWidth,
                        href: _window.location.href
                    };

                _addToWishList({
                    page: pageData,
                    image: imgData
                });
            };

            var css = _document.createElement('style');
            css.innerHTML = config.stylesheet.join('\n');
            css.type = 'text/css';
            _document.body.appendChild(css);

            config.buttons.forEach(function(buttonInfo) {
                var button = _document.createElement('div');
                button.id = buttonInfo.id;
                button.className = buttonInfo.class;
                button.addEventListener('click', buttonClick);
                _document.body.appendChild(button);

                buttonInfos.push({
                    button: button,
                    height: buttonInfo.height,
                    minWidth: buttonInfo.minWidth,
                    padding: buttonInfo.padding
                });
            });

            _document.addEventListener('mouseover', function(event) {
                if (event.target.tagName === 'IMG') {
                    imgMouseover(event);
                }
            });

            _document.addEventListener('mouseout', function(event) {
                var target = event.target;
                if (target.tagName === 'IMG') {
                    imgMouseout(event);
                } else if (target === currentButton) {
                    buttonMouseout(event);
                } else if (currentCover && target === currentCover) {
                    coverMouseout(event);
                } else {
                    hide();
                }
            });
        },

        /* Sends 'UBPHoverA2WL' message back to the extension
         *
         * @param {object} args - see hover.js in BITPCompClientAssets
         */
        _addToWishList: function(args) {
            this._sendMessage({
                mType: 'UBPHoverA2WL',
                data: args
            });
        }
    };

    return HoverManager;

}

if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
} else if (typeof define !== "undefined") {
    define([], factory);
}

if (typeof window !== "undefined") {
    window.UBPAPISupport = window.UBPAPISupport || {};
    window.UBPAPISupport.HoverManager = factory();
}

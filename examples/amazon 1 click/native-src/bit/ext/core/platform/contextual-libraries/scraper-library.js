var factory = function() {

    "use strict";

    /**
     * A component that scrapes a list of Content from an HTMLDocument according the rules
     * dictated by a ScraperSpecification.
     *
     * A Scraper is used in the following manner:
     *
     * <code>
     * // create a scraper
     * Scraper scraper = new Scraper();
     *
     * // create the specification that describes how to scrape content
     *  var specification = {
     *      contentType : "Price", // scrape price Content
     *      scraperType : "Xpath", // scrape using an xpath expression
     *      scraper : "//div[@id='WM_PRICE']/div/div[1]/span", // scrape using this xpath selector
     *      constraint : { // impose additional constraints on the scraped content
     *          constraintType: "JsRegex",
     *          regexPattern: "\\$[0-9]+\\.[0-9]{2}",
     *          isDefined: true
     *      }
     *  };
     *
     *  // perform the scraping - notice that the HTMLDocument is specified as the first parameter
     *  var contents = scraper.scrape(window.document, specification);
     *
     *  // inspect the results
     *  console.log(contents[i].contentType); // this will log "Price"
     *  console.log(contents[i].contentBody); // this will log the price scraped from 
     *                                        // the ith matching node in the HTMLDocument
     * </code>
     */
    var Scraper = function() {
        this.initialize.apply(this, arguments);
    };
    Scraper.prototype = {

        /**
         * Initializes this Scraper.
         */
        initialize: function() {

            // install specification expression evaluators
            // one per specification expression type
            this.evaluators = {};
            this.evaluators["UrlJsRegex"] = evaluateUrlJsRegex;
            this.evaluators["Xpath"] = evaluateXpath;
            this.evaluators["Css"] = evaluateCss;
            this.evaluators["MicrodataItem"] = evaluateMicrodataItem;
            this.evaluators["Metatag"] = evaluateMetatags;
            
            // install content constraint checkers
            // one per content constraint type
            this.constraintCheckers = {};
            this.constraintCheckers["None"] = noneConstraintChecker;
            this.constraintCheckers["JsRegex"] = jsRegexConstraintChecker;
        },

        /**
         * Attempts to scrape Content from the specified HTMLDocument according
         * to the specified ScraperSpecification.
         *
         * @param htmlDocument
         *            The HTMLDocument to scrape Content from. See
         *            https://developer.mozilla.org/en-US/docs/Web/API/HTMLDocument
         *            for more information about HTMLDocuments.
         * @param specification
         *            The ScraperSpecification that specifies how to scrape
         *            Content from the specified HTMLDocument. See
         *            bit.pcomp.scrape.ScraperSpecification in
         *            BITProductCompassCore for more information about
         *            ScraperSpecifications.
         *
         * @return A list of all Content scraped according to the specified
         *         ScraperSpecification.
         */
        scrape: function(htmlDocument, specification) {
            if (!htmlDocument) {
                throw new Error("htmlDocument must be specified: " + htmlDocument);
            }
            if (!specification) {
                throw new Error("specification must be specified: " + specification);
            }
            if (!specification.contentType) {
                throw new Error("specification must have a content type");
            }
            if (!specification.scraperType) {
                throw new Error("specification must have an scraper type");
            }
            if (!specification.scraper) {
                throw new Error("specification must have an scraper expression");
            }

            // select the appropriate expression evaluator
            var evaluator = this.evaluators[specification.scraperType];
            if (!evaluator) {
                throw new Error("No evaluator installed for scraper type: " + specification.scraperType);
            }

            // evaluate the expression
            var contents = evaluator(htmlDocument, specification.scraper, specification.contentType, specification.attributeSource);

            // check scraped content against content constraint
            if(specification.constraint && specification.constraint.isDefined) {
                applyConstraints(contents, this.constraintCheckers[specification.constraint.constraintType], specification.constraint);
            }

            return contents;
        }
    };

    /***************************************************************************
     * Expression Evaluators:
     **************************************************************************/

    /**
     * Evaluates the UrlJsRegex scraper expression against the URL of the
     * specified HTMLDocument. A list containing a single Content object
     * is returned if non-trivial Content matching the ScraperSpecification could be found; 
     * an empty list is returned otherwise.
     *
     * A UrlJsRegex expression is composed of two components, one per line:
     *
     * <code>
     *     MatchPattern\n
     *     ContentPattern
     * </code>
     *
     * The MatchPattern must match the URL for Content to be scraped. The
     * ContentPattern is a substitution pattern for the URL. The ContentPattern
     * may use numbered backreferences to the groupings in the MatchPattern
     * result.
     *
     * This method is called by Scraper#scrape. Note that content constraints
     * are not checked by this method. They are checked by Scraper#scrape.
     *
     * @param htmlDocument
     *            The HTMLDocument to attempt to scrape Content from (the
     *            HTMLDocument's URL will be scraped). See https://
     *            developer.mozilla.org/en-US/docs/Web/API/HTMLDocument for more
     *            information about HTMLDocuments.
     * @param expression
     *            The UrlJsRegex expression that describes how to scrape
     *            Content.
     * @param contentType
     *            The expected content type of the scraped content.
     *
     * @return A list containing a single Content object if non-trivial Content matching the
     *         ScraperSpecification could be found; an empty list otherwise.
     */
    var evaluateUrlJsRegex = function(htmlDocument, expression, contentType) {

        var contents = [];

        // parse the patterns out of the expression
        var patterns = expression.split("\n");
        if (patterns.length !== 2) {
            throw new Error("UrlJsRegex expression must have exactly two lines: " + patterns);
        }
        var matchPattern = patterns[0];
        var contentPattern = patterns[1];
        var regex = new RegExp(matchPattern);

        // retrieve the url
        var url = htmlDocument.URL;

        // ensure the regex matches the url
        var matches = url.match(regex);
        if (!matches || !matches[0]) {
            return contents;
        }

        // compute the content value
        var contentValue = url.replace(regex, contentPattern);

        if (contentValue) {
            contents.push(new Content(contentType, contentValue));
        }

        return contents;
    };

    /**
     * Evaluates the Xpath scraper expression against the specified
     * HTMLDocument. All matching Content is scraped and returned in list form.
     *
     * A Xpath scraper expression is an XPath selector. See
     * https://developer.mozilla.org/en-US/docs/Introduction_to_using_XPath_in_JavaScript
     * for more information about XPath.
     *
     * This method is called by Scraper#scrape. Note that content constraints
     * are not checked by this method. They are checked by Scraper#scrape.
     *
     * @param htmlDocument
     *            The HTMLDocument to attempt to scrape Content from (the
     *            HTMLDocument's URL will be scraped). See https://
     *            developer.mozilla.org/en-US/docs/Web/API/HTMLDocument for more
     *            information about HTMLDocuments.
     * @param expression
     *            The Xpath expression that describes how to scrape
     *            Content. The result will be evaluated according to the xpath result type.
     * @param contentType
     *            The expected content type of the scraped content.
     * @param attributeSource
     *            If specified, we pick the content inside the given attribute.
     *
     * @return An array of innerText or attribute values for the given expression
     *         and attributeSource; an empty list if there is no such content.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/document.evaluate
     */
    var evaluateXpath = function(htmlDocument, expression, contentType, attributeSource) {

        var contents = [];

        // xpath result types with corresponding values
        var resultTypes = {
                            ANY_TYPE: 0,
                            NUMBER_TYPE: 1,
                            STRING_TYPE: 2,
                            BOOLEAN_TYPE: 3,
                            UNORDERED_NODE_ITERATOR_TYPE: 4,
                            ORDERED_NODE_ITERATOR_TYPE: 5,
                            UNORDERED_NODE_SNAPSHOT_TYPE: 6,
                            ORDERED_NODE_SNAPSHOT_TYPE : 7,
                            ANY_UNORDERED_NODE_TYPE: 8,
                            FIRST_ORDERED_NODE_TYPE: 9
                          };
        
        // Return contents if htmlDocument does not define evaluate()
        if (!htmlDocument.evaluate) {
            return contents;
        }

        // evaluate xpath          
        var result = htmlDocument.evaluate(expression, htmlDocument, null, resultTypes.ANY_TYPE, null);

        // identify what kind of result we evaluated to
        var resultType = result.resultType;
       
        // parse xpath result according to type of evaluation
        var node;
        switch(resultType) {
        case resultTypes.NUMBER_TYPE:
            var contentValue = result.numberValue;
            if(contentValue) {
                contents.push(new Content(contentType, contentValue));
            }
            break;
        case resultTypes.STRING_TYPE:
            var contentValue = result.stringValue;
            if(contentValue) {
                contents.push(new Content(contentType, result.stringValue));
            }
            break;
        case resultTypes.BOOLEAN_TYPE:
            var contentValue = result.booleanValue;
            if(contentValue) {
                contents.push(new Content(contentType, result.booleanValue));
            }
            break;
        case resultTypes.UNORDERED_NODE_ITERATOR_TYPE:
        case resultTypes.ORDERED_NODE_ITERATOR_TYPE:
            var maxIterations = 32;
            
            var iterationNumber = 0;
            while(iterationNumber < maxIterations) {
                iterationNumber++;
                node = result.iterateNext();
                if(!node) {
                    break;
                }
            
                var contentValue = attributeSource ? node.getAttribute(attributeSource) : node.innerText;
                if(contentValue) {
                    contents.push(new Content(contentType, contentValue));
                }
            }
            break;
        case resultTypes.UNORDERED_NODE_SNAPSHOT_TYPE:
        case resultTypes.ORDERED_NODE_SNAPSHOT_TYPE:
            for(var i = 0; i < result.snapshotLength; i++) {
                node = result.snapshotItem(i);
                if(!node) {
                    continue;
                }
            
                var contentValue = attributeSource ? node.getAttribute(attributeSource) : node.innerText;
                if(contentValue) {
                    contents.push(new Content(contentType, contentValue));
                }
            }
            break;
        case resultTypes.ANY_UNORDERED_NODE_TYPE:
        case resultTypes.FIRST_ORDERED_NODE_TYPE:
            node = result.singleNodeValue;
            if(!node) {
                break;
            }
            
            var contentValue = attributeSource ? node.getAttribute(attributeSource) : node.innerText;
            if(contentValue) {
                contents.push(new Content(contentType, contentValue));
            }
            break;
        default:
            throw new Error("Unexpected resultType found: " + resultType);
        }
        
        return contents;
    };

    /**
     * Evaluates the Css scraper expression against the specified HTMLDocument.
     * All matching Content is returned in list form.
     *
     * A Css scraper expression is a CSS Selector. See
     * https://developer.mozilla.org/en-US/docs/Web/API/document.querySelectorAll
     * for more information about CSS Selectors.
     *
     * This method is called by Scraper#scrape. Note that content constraints
     * are not checked by this method. They are checked by Scraper#scrape.
     *
     * @param htmlDocument
     *            The HTMLDocument to attempt to scrape Content from (the
     *            HTMLDocument's URL will be scraped). See https://
     *            developer.mozilla.org/en-US/docs/Web/API/HTMLDocument for more
     *            information about HTMLDocuments.
     * @param expression
     *            The CSS expression that describes how to scrape
     *            Content.
     * @param contentType
     *            The expected content type of the scraped content.
     * @param attributeSource
     *            If specified, we pick the content inside the given attribute.
     *
     * @return An array of innerText or attribute values for the given expression
     *         and attributeSource; null if there is no such content.
     */
    var evaluateCss = function(htmlDocument, expression, contentType, attributeSource) {

        var contents = [];

        // https://developer.mozilla.org/en-US/docs/Web/API/document.querySelectorAll
        var result = htmlDocument.querySelectorAll(expression);
        if (!result) {
            return contents;
        }

        for (var i = 0; i < result.length; i++) {
            var element = result[i];
            if(!element) {
                continue;
            }

            var contentValue = attributeSource ? element.getAttribute(attributeSource) : element.innerText;
            if (contentValue) {
                contents.push(new Content(contentType, contentValue));
            }
        }

        return contents;
    };

    /**
     * Evaluates the Microdata item scraper against the specified HTMLDocument.
     * A list of Content objects are returned if non-trivial Content matching the
     * ScraperSpecification could be found; an empty list is returned otherwise.
     *
     * The Microdata scraper specifies a Microdata itemtype and a list of related properties.
     * This evaluator function scrapes all properties for each item of type itemtype found,
     * subject to configurable content, performance, and profiling constraints.
     *
     * This method is called by Scraper#scrape. Note that content constraints
     * are not checked by this method. They are checked by Scraper#scrape.
     *
     * @param htmlDocument
     *            The HTMLDocument to attempt to scrape Content from (the
     *            HTMLDocument's URL will be scraped). See https://
     *            developer.mozilla.org/en-US/docs/Web/API/HTMLDocument for more
     *            information about HTMLDocuments.
     * @param serializedScraper
     *            The json-encoded Microdata item scraper specification that describes how to scrape 
     *            Content. For more information on scraper schema, please see bit.pcomp.scrape.microdata documentation.
     *
     * @return A list of Content objects if non-trivial Content matching the
     *         ScraperSpecification could be found; an empty list otherwise.
     *
     * @see http://www.w3.org/TR/microdata/#items
     */
    var evaluateMicrodataItem = function(htmlDocument, serializedScraper) {
        var scraper = JSON.parse(serializedScraper);
            
        // the descriptor of the microdata item to scrape 
        // for example, "http://schema.org/Product" denotes a Schema.Org Product microdata item
        var itemType = scraper.itemType;
        // the list of item property specifications for each item
        // each property specificaiton describes properties to attempt to scrape and expected parent types.
        // for more information, see bit.pcomp.scrape.microdata.MicrodataItemProperty class documentation.
        var properties = scraper.itemProperties;
        // the maximum number of items to attempt to scrape
        var maxItems = scraper.maxItems;
        // the maximum number of descendent property nodes to search through during property search
        var maxCandidates = scraper.maxCandidates;
        // the maximum number of ancestor nodes to search through during backwards search
        var maxBackwardsSearchNodes = scraper.maxBackwardsSearchNodes;

        var contents = [];

        // css selector targeting specified itemtype
        var itemSelector = "[itemscope][itemtype~=\"" + itemType + "\"]";
        var itemNodes = htmlDocument.querySelectorAll(itemSelector);

        var numItems = Math.min(itemNodes.length, maxItems);

        // for each item found, scrape all specified properties
        for (var itemNode = 0; itemNode<numItems; itemNode++) {

            // for each property requested, generate property candidates and scrape first valid candidate
            // (candidate that is a member of an expected item type)
            for (var property=0; property<properties.length; property++) {
                var propertyName = properties[property].name;
                var propertyAttributes = properties[property].attributes;
                var expectedEnclosingTypes = properties[property].enclosingItemTypes;
                var propertyContentType = properties[property].contentType;

                // css selector targeting descendent property node
                var propertySelector = "[itemprop=" + propertyName + "]";

                // generate property candidates
                var propertyCandidates = itemNodes[itemNode].querySelectorAll(propertySelector);
                var propertyNode = null;

                // find first candidate that is a member of expected enclosing type
                var numCandidates = Math.min(propertyCandidates.length, maxCandidates);
                for (var candidate = 0; candidate<numCandidates; candidate++) {
                    var candidateNode = propertyCandidates[candidate];

                    // backwards search for property candidate enclosing type
                    //
                    // break when direct itemtype ancestor is found or 
                    // max nodes is hit
                    var numBackwardsSearchNodes = 0;
                    while (numBackwardsSearchNodes < maxBackwardsSearchNodes
                            && (candidateNode = candidateNode.parentNode)){
                        numBackwardsSearchNodes++;

                        var ancestorItemType = candidateNode.attributes && candidateNode.attributes["itemtype"];

                        // keep moving up if no item type found
                        if(!ancestorItemType) {
                            continue;
                        }

                        // candidate is enclosed by expected item type
                        if(expectedEnclosingTypes.indexOf(ancestorItemType.nodeValue) !== -1) {
                            // valid node found, end search
                            propertyNode = propertyCandidates[candidate];
                            break;
                        }
                        // candidate is enclosed by unexpected item type
                        else {
                            // candidate is invalid, end search and proceed to next candidate
                            break;
                        }

                    }

                    // end candidate validation if backwards search was successful
                    if (propertyNode) {
                        break;
                    }
                }

                // unable to find a valid property node
                // continue to next property requested
                if (!propertyNode) {
                    continue;
                }

                var propertyValue = null;

                // scrape property content from first attribute with scrapable content
                for (var attribute = 0; attribute<propertyAttributes.length; attribute++) {
                    propertyValue = propertyNode[propertyAttributes[attribute]];
                    if(propertyValue) {
                        break;
                    }
                }

                // no attributes were scrapable
                // continue to next property requested
                if (!propertyValue) {
                    continue;
                }

                contents.push(new Content(propertyContentType, propertyValue));
            }
        }

        return contents;
    }

    /**
     * Evaluates the meta tag scraper against the specified HTMLDocument.
     * A list of Content objects are returned if non-trivial Content matching the
     * ScraperSpecification could be found; an empty list is returned otherwise.
     *
     * The meta tag scraper specifies a list of required and scrapable properties.
     * If the required properties match their expected values, content from the scrapable 
     * properties is returned.
     *
     * This method is called by Scraper#scrape. Note that content constraints
     * are not checked by this method. They are checked by Scraper#scrape.
     *
     * @param htmlDocument
     *            The HTMLDocument to attempt to scrape Content from (the
     *            HTMLDocument's URL will be scraped). See https://
     *            developer.mozilla.org/en-US/docs/Web/API/HTMLDocument for more
     *            information about HTMLDocuments.
     * @param serializedScraper
     *            The json-encoded meta tag scraper specification that describes how to scrape 
     *            Content. The schema is described below. See tests for example invocation.
     *            If multiple tags with the same name are found, this evaluator only uses the first.
     *            { 
     *              requiredProperties: Array of metatag name/value pairs that must be satisfied 
     *                            in order to scrape content. Trivially satisfied if empty. 
     *                            Only the first property matched will be used.
     *                              
     *              scrapableProperties: Array describing metatags to scrape. 
     *                                   Only the first property matched will be scraped.
     *            }
     *            For more information on the scraper schema, see bit.pcomp.scrape.metatag documentation.     
     * 
     * @return A list of Content objects if non-trivial Content matching the
     *         ScraperSpecification could be found; an empty list otherwise.
     */
    var evaluateMetatags = function(htmlDocument, serializedScraper) {
        var scraper = JSON.parse(serializedScraper);
    
        // array of properties + expected values
        // all property/value requirements must be satisfied for scraping to occur
        var requiredProperties = scraper.requiredProperties;
        // properties to scrape if required properties are satisfied
        var scrapableProperties = scraper.scrapableProperties;
        var contents = [];

        if (!requiredProperties || !scrapableProperties || !scrapableProperties.length) {
            throw new Error("Metatag scraper: null or empty parameters: " + [requiredProperties, scrapableProperties]);
        }

        // check if required properties are satisfied
        for(var i=0; i<requiredProperties.length; i++) {
            var requiredPropery = requiredProperties[i];

            var content = evaluateCss(htmlDocument, "meta[property=\"" + requiredPropery.name + "\"]", "Keywords", "content")
                          .shift(); //only use the first tag found

            // required property not found or doesn't match required value - end scraping
            if(!content || content.contentBody !== requiredPropery.value) {
                return [];
            }
        }

        // if all required properties are satisfied, scrape content from page
        for(var i=0; i<scrapableProperties.length; i++) {
            var scrapablePropery = scrapableProperties[i];

            var content = evaluateCss(htmlDocument, "meta[property=\"" + scrapablePropery.name + "\"]", scrapablePropery.contentType, "content")
                          .shift(); //only use the first property found

            if(content) {
                contents.push(content);
            }
        }

        return contents;
    }

    /***************************************************************************
     * Constraint Checkers:
     **************************************************************************/

    /**
     * Applies <i> constraintChecker </i> to the list of content supplied. 
     * 
     * When applicable, the content list is mutated in place.
     */
    var applyConstraints = function(contents, constraintChecker, constraint) {
        if (!constraintChecker) {
            // invalid content constraint type
            throw new Error("No constraint checker installed for constraint type: " + constraint.constraintType);
        } 
        
        for(var i = 0; i < contents.length; i++) {
            if (!constraintChecker(constraint, contents[i])) {
                // content did not satisfy the constraint
                // remove from contents list
                contents.splice(i, 1);
            }
        }
    }

    /**
     * The trivial constraint checker function that is satisfied by all Content.
     */
    var noneConstraintChecker = function(constraint, content) {
        return true;
    };

    /**
     * A constraint checker function that requires that the Content's value
     * matches the JavaScript regex in the value of the specified constraint.
     */
    var jsRegexConstraintChecker = function(constraint, content) {
        var regex = new RegExp(constraint.regexPattern);
        if (!content.contentBody.match(regex)) {
            return false;
        }
        return true;
    };

    /**
     * Represents Content scraped from an HTMLDocument.
     */
    var Content = function() {
        this.initialize.apply(this, arguments);
    };

    Content.prototype = {

        /**
         * Initializes this Content with the specified content type and string
         * value.
         *
         * See bit.pcomp.concepts.ContentType for the full enumeration of
         * possible ContentTypes.
         */
        initialize: function(contentType, value) {
            if (!contentType) {
                throw new Error("contentType must be specified: " + contentType);
            }
            if (!value) {
                throw new Error("value must be specified: " + value);
            }
            this.contentType = contentType;
            this.contentBody = value;
        }
    };

    return Scraper;
};

if (typeof window !== "undefined") {
    window.Scraper = factory();
}

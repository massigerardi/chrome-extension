var AMZUWLXT = {};

AMZUWLXT.tests = {
    genBulkTest : function(tests, isOr) {

        if(isOr === undefined) {
            isOr = false;
        }
        
        return function(node, nodeData) {
            for(var i = 0; i < tests.length; i++) {
                if(tests[i](node,nodeData)) {
                    if(isOr) {
                        return true;
                    }
                } else {
                    if(!isOr) {
                        return false;
                    }
                }
            }
            
            return !isOr;
        };
    },
    genAndTest : function() {
        return this.genBulkTest(arguments,false);
    },
    genOrTest : function() {
        return this.genBulkTest(arguments,true);
    },
    genChildrenOrTest : function( test, maxDepth ) {
        return function(node,nodeData) {
            if(test(node, nodeData)) {
                return true;
            }
            
            var nodes = [];
            if(node.childNodes && node.childNodes.length) {
                nodes.push(node.childNodes[0]);
            }
            
            while(nodes.length) {
                var i = nodes.pop();
                
                if(test(i,{})) {
                    return true;
                }
                
                if(i.childNodes && i.childNodes.length && nodes.length < maxDepth) {
                    if(i.nextSibling) {
                        nodes.push(i.nextSibling);
                    }
                    nodes.push(i.childNodes[0]);
                } else {
                    if(i.nextSibling) {
                        nodes.push(i.nextSibling);
                    }
                }
            }
            
            return false;
        };
    },
    popNodeData : function(node, nodeData, field) {
        
        if(!field) {
            field = "text";
            
        }
        
        if(nodeData[field] !== undefined) {
            return;
        }
        
        if(field === "text") {
            nodeData.text = (node.alt || node.innerText || node.value || node.title || node.nodeValue || "");
        } else if(field === "html") {
            nodeData.html = node.innerHTML || "";
        }
    },
    leafNodeTest : function(node) {
        var foundChild = false;
        
        if(node.nodeType === 3) {
            return true;
        }
        
        if(node.childNodes && node.childNodes.length !== 0) {
            for(var i = 0; i < node.childNodes.length; i++) {
                if(node.childNodes[i].nodeType === 1) {
                    foundChild = true;
                    break;
                }
            }
        }
        
        return !foundChild;
    },
    genNodePropMaxSpreadTest : function(test,propName, spread) {
        
        return function(node, nodeData) {
            
            var x = test(node, nodeData) && (
                Math.max.apply(Math,nodeData[propName]) -
                    Math.min.apply(Math,nodeData[propName]) < spread);
            return x;
        };
    },
    genPropRegexTest : function(regex, props, recordKey) {
        
        if(!props) {
            props = ["href","action","src","id","className"];
        } else if(!props.length === undefined) {
            props = [props];
        }
        
        return function(node,nodeData) {
            
            if(node && node.nodeType == 3) {
                node = node.parentNode;
            }

            if(node) {
                for(var i = 0; i < props.length; i++) {
                    
                    if( node[props[i]] && 
                        node[props[i]].search) {
                        
                        var searchResult = -1;
                        if(props[i] == "href" || props[i] == "src") {
                            var nodomain = node[props[i]].replace(/^http(s)*:\/\/.*?\//,"");
                            searchResult = nodomain.search(regex);
                        } else {
                            searchResult = node[props[i]].search(regex);
                        }
                        
                        if(searchResult != -1) {
                            
                            if(props[i] == "href") {
                                if(node.href.indexOf(window.location.toString()) != -1) {
                                    return false;
                                }
                            }
                            
                            
                            if(recordKey) {
                                if(!nodeData[recordKey]) {
                                    nodeData[recordKey] = [];
                                }
                                nodeData[recordKey].push(searchResult);
                            }
                            
                            return true;
                        }
                    }
                }
            }
            
            return false;
        };
    },
    genReTest : function(regex, field) {
        if(!field) {
            field = "text";
        }
        return function(node,nodeData) {
            AMZUWLXT.tests.popNodeData(node,nodeData,field);
            return (nodeData && nodeData[field] && nodeData[field].match && nodeData[field].match(regex));
        };
    },
    visibleTest : function(node,nodeData) {
        if(node.nodeType === 3) {
            node = node.parentNode;
        }
        
        if(node.tagName && node.tagName.match(/img/i) && !node.complete) {
            return true;
        }
        
        return node.offsetWidth && node.offsetHeight && (node.offsetWidth > 2 || node.offsetHeight > 2);
    },
    genLengthTest : function(maxLength, field) {
        if(!field) {
            field = "text";
        }
        return function(node,nodeData) {
            AMZUWLXT.tests.popNodeData(node,nodeData.text,field);
            
            return nodeData &&
                nodeData[field] &&
                nodeData[field].length <= maxLength;
        };
    },
    genPositionRangeTest : function(minY,maxY,minX,maxX) {
        return function(node,nodeData) {
            if(node.nodeType === 3) {
                node = node.parentNode;
            }
            
 	    var offsetY = node.offsetTop;
 	    var offsetX = node.offsetLeft;
            
            while(node.offsetParent) {
                node = node.offsetParent;
                offsetY += node.offsetTop;
                offsetX += node.offsetLeft;
            }
            
            return !(
                (minY !== undefined && offsetY < minY) ||
                    (maxY !== undefined && offsetY >= maxY) ||
                    (minX !== undefined && offsetX < minX) ||
                    (minX !== undefined && offsetX >= maxX)
            );
            
        };
    },
    negateTest : function(test) {
        return function(node,nodeData) {
            return !test(node,nodeData);
        };
    },
    genParentsOrTest : function(test, maxHeight, offset) {
        if(offset === undefined) {
            offset = false;
        }
        
        return function(node,nodeData) {
            var currentNode = node;
            var height = 0;
            while(currentNode && height < maxHeight) {
                if(test(currentNode,{})) {
                    return true;
                }
                currentNode = currentNode.parentNode;
                height++;
            }
            return false;
        };
    },
    genComputedStyleReTest : function(style, re) {
        return function(node,nodeData) {
            
            if(node.nodeType === 3) {
                node = node.parentNode;
            }

            if(!nodeData.computedStyle) {
                if(node.tagName && node.tagName !== "HTML") {
                    nodeData.computedStyle =
                    node.ownerDocument.defaultView.getComputedStyle(node,null);
                }
            }
            
            return(nodeData.computedStyle &&
                   nodeData.computedStyle.getPropertyValue &&
                   nodeData.computedStyle.getPropertyValue(style).match(re));
        };
    },
    attributeExistsTest : function(propName) {
        return function(node,nodeData) {


            if(node.wrappedJSObject) {
                return node.wrappedJSObject[propName] ? true : false;
            } else {
                return node[propName] ? true : false;
            }
        };
    },
    genDomainTest : function(locale) {
        return function(node, nodeData) {
            return node.ownerDocument.defaultView.location.hostname.match(locale) ? true : false;
        };
    },
    genLogTest : function(prefix) {
        return function(node, nodeData) {
            console.log(prefix,node);
            return false;
        };
    }
};

(function() {
    var t = AMZUWLXT.tests;

    if(window.location.hostname.match(/ikea\.(.*?)$/)) {
        t.inNavTest = t.genParentsOrTest(t.genPropRegexTest(/rcm|seemore|ad_|ad\b/i, ["id","className"]), 15);
    } else {
        t.inNavTest = t.genParentsOrTest(t.genPropRegexTest(/nav|rcm|seemore|ad_|ad\b/i, ["id","className"]), 15);
    }

    var clickButtonRe = /^INPUT|BUTTON|A$/i;

    var nodeClickable = t.genOrTest(
        t.genPropRegexTest(clickButtonRe,["tagName"]),
        t.attributeExistsTest("onclick"));
    
    t.isClickableTest = t.genOrTest(
        t.genComputedStyleReTest("cursor",/pointer/i),
        nodeClickable,
        t.genChildrenOrTest(nodeClickable),
        t.genParentsOrTest(nodeClickable,5));
    
})();

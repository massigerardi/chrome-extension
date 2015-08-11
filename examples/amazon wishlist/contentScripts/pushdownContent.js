(function() {

    var t = AMZUWLXT.tests;
    
    var runPushDown = function(win,
                               doc,
                               content,
                               expander,
                               expandCallback,
                               isWindows) {

        
        var eachChild = function(node,f) {
            var nodes = [node];
            while(nodes.length) {
                var n = nodes.pop();
                for(var i = 0; i < n.childNodes.length; i++) {
                    f(n.childNodes[i]);
                    nodes.push(n.childNodes[i]);
                }

            }
        };
        
        var negate = function (val) {
            return val.replace(/([\d\.]+)/g,"-$1"); 
        };
        
        var windowResizer = function() {
            expander.style.height = content.clientHeight + "px";
        };
        
        var computedBody = getComputedStyle(doc.body, null);
        
        var counterMarginTop = [
            negate(computedBody.getPropertyValue("margin-top")),
            negate(computedBody.getPropertyValue("margin-right")),
            "0px",
            negate(computedBody.getPropertyValue("margin-left"))
        ].join(" ");

        
        var moveBackgroundPosition = t.genAndTest(
            t.genComputedStyleReTest("background-image",/./),
            t.genComputedStyleReTest("background-attachment",/^scroll$/),
            t.genComputedStyleReTest("background-position",/^0% 0%$/)
        )(doc.body,{});

        var animate = function(startF, endF, time, op, finished) {
            var startTime = new Date().getTime();
            var step = function() {
                
                var start = startF();
                var end = endF();
                
                var v = start +
                    (new Date().getTime() - startTime)/time*(end-start);
                
                if( (start >= end && v <= end) ||
                (start < end && v >= end) ) {
                    v = end;
                }
                
                op(v,start,end);
                
                if(v == end) {
                    if(finished) {
                        finished();
                    }
                } else {
                    setTimeout(step,50);
                }
            };
            step();
        };
        
        
        
        var contract = function() {
            var targetHeight = 0;
            var startHeight = expander.clientHeight;
            animate(function() {return startHeight;},
                    function() {return 0;},
                    500,
                    function(v,start,end) {
                        expander.style.height = v + "px";
                        content.style.marginTop = (v - startHeight) + "px";
                        content.style.opacity = v/startHeight;
                        if(moveBackgroundPosition) {
                            doc.body.style.backgroundPosition = "0% " + v + "px";
                        }
                    });
        };
        
        var expand = function() {

            var targetHeight = content.clientHeight;
            var startHeight = expander.clientHeight;
            expander.style.marginTop = 0;
            
            animate(function() {return 0;},
                    function() {return content.clientHeight;},
                    500,
                    function(v,start,end) {
                        expander.style.height = v + "px";
                        content.style.marginTop = "-" + (end - v) + "px";
                        doc.body.style.backgroundPosition = "0% " + v + "px";
                    },
                    function() {
                        if(expandCallback) {
                            expandCallback();
                        }
                        windowResizer();
                        win.addEventListener("resize", windowResizer, false);
                    });
            
        };
        

        eachChild(content, function(n) {



            if(n.className == "windows" || n.className == "non_windows") {
                if(isWindows && n.className == "non_windows" || 
                  !isWindows && n.className == "windows") {
                    n.style.display = "none";
                }

                n.className = "";
            }

            if(n.id == "close") {
                n.addEventListener("click",
                                   function(e) {
                                       win.removeEventListener("resize",windowResizer,false);
                                       contract();
                                   },false);
                try {
                    delete n.id;
                } catch (e) {
                    n.id = "";
                }
            }

            if(n.id == "settings") {
                n.addEventListener("click",
                                   function(e) {
                                       window.openDialog("chrome://amznuwl2/content/settings/settings.html","","chrome,centerscreen");
                                   },false);

                try {
                    delete n.id;
                } catch(e) {
                    n.id = "";
                }
            }
        });

        expander.style.height = 0;
        expander.style.margin = counterMarginTop;
        doc.body.insertBefore(content,doc.body.firstChild);
        doc.body.insertBefore(expander,doc.body.firstChild);

        expand();

    };
        
    var canPushDown = t.negateTest(
        t.genChildrenOrTest(
            t.genAndTest(
                t.visibleTest,
                t.genComputedStyleReTest(
                    "position",/absolute|fixed/i
                ),
                t.negateTest(t.genPropRegexTest(/^body$/i,["tagName"])),
                t.genOrTest(
                    t.negateTest(t.genComputedStyleReTest("left",/auto/)),
                    t.negateTest(t.genComputedStyleReTest("right",/auto/)),
                    t.negateTest(t.genComputedStyleReTest("top",/auto/)),
                    t.negateTest(t.genComputedStyleReTest("bottom",/auto/))
                ),
                t.negateTest(
                    t.genParentsOrTest(
                        t.genOrTest(
                            t.genComputedStyleReTest("position",/relative/i),
                            t.genPropRegexTest(/iframe/i,["tagName"])
                        ),5)
                ),
                t.genPositionRangeTest(0,500,0),
                t.negateTest(
                    t.genComputedStyleReTest("visibility","hidden"))
            ),3)
    );

    AMZUWLXT.canPushDown = canPushDown;
    AMZUWLXT.runPushDown = runPushDown;

})();



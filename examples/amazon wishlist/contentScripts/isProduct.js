(function() {

    var t = AMZUWLXT.tests;

    var addRegex = /(place|add)(\b|_|-)*/i;
    var cartRegex = /basket|cart|bag/i;
    var buyRegex = /buy|order/i;
    var buyCompanionRegex = /now|online/i;
    var preOrderRegex = /pre(\s|-)order/i;

    var addToCartRegex = /addbag|addcart|addtocart|addtobasket|addtobag|(add-to-cart)|(add-to-basket)|shoppingcar|shopcar/i;


    var intlAddToCart = new RegExp("(\u30AB\u30FC\u30C8\u306B\u8FFD\u52A0)|(\u30AB\u30FC\u30C8\u306B\u5165\u308C\u308B)|(\u30AB\u30FC\u30C8\u3078\u5165\u308C\u308B)|(\u8CB7\u3044\u7269\u304B\u3054\u306B\u5165\u308C\u308B)|(^\u653E\u5165\u8D2D\u7269\u8F66$)|(^\u6DFB\u52A0\u5230\u8D2D\u7269\u8F66$)|(^\u8D2D\u4E70$)|(^\u7ACB\u5373\u62A2\u8D2D$)|(^\u7ACB\u5373\u8D2D\u4E70$)|(^\u52A0\u5165\u8D2D\u7269\u8F66$)|(btn-atc)|addtoshoppingcar|addtobasket|buy_btn|Ajouter au panier|ajout_panier|(In den Einkaufswagen)|(In Den Warenkorb)|(In die Einkaufstasche)|(Artikel in den Warenkorb)|(^in den korb$)|(^in Warenkorb$)|(^kaufen$)|(^Acquista$)|(^Al carrello$)|(Metti nel carrello)|(aggiungi al carrello)(Aggiungere al carrello)|(Aggiungi al carrello)|(Metti questo articolo nel tuo carrello spesa)","i");
    
    
    var getAncestors = function(node, bottomUp) {
        if(bottomUp === undefined) {
            bottomUp = true;
        }
        
        var parents = [];
        var traverse = node;
        while(traverse) {
            if(bottomUp) {
                parents.push(traverse);
            } else {
                parents.unshift(traverse);
            }
            traverse = traverse.parentNode;
        }
        return parents;
    };
    
    
    var findMutualParent = function(first,second) {
        var firstParents = getAncestors(first,false);
        var secondParents = getAncestors(second,false);
        
        var size = Math.min(firstParents.length,secondParents.length);
        
        var LCA = undefined;
        
        for(var i = 0; i < size; i++) {
            if(firstParents[i] !== secondParents[i]) {
                return LCA;
            }
            
            LCA = firstParents[i];
        }
        
        return LCA;
    };
    
    var getDpTest = function() {
        return t.genAndTest(
            t.genOrTest(t.leafNodeTest,
                        t.genPropRegexTest(addToCartRegex,["className","id","title","name","alt"]),
                        t.genPropRegexTest(intlAddToCart,["className","id","title","name","alt"])),
            t.visibleTest,
            t.genOrTest(
                t.genReTest(intlAddToCart),
                t.genPropRegexTest(intlAddToCart),
                t.genAndTest(t.genReTest(addRegex),
                             t.genReTest(cartRegex),
                             t.genLengthTest(25)),
                t.genAndTest(t.genReTest(buyRegex),
                             t.genReTest(buyCompanionRegex),
                             t.genLengthTest(10)),
                t.genAndTest(t.genReTest(preOrderRegex),
                             t.genLengthTest(10)),
                
                t.genNodePropMaxSpreadTest(
                    t.genAndTest(t.genPropRegexTest(buyRegex, undefined, "buy"),
                                 t.genPropRegexTest(buyCompanionRegex,undefined, "buy")),
                    "buy",10),
                t.genNodePropMaxSpreadTest(
                    t.genAndTest(t.genPropRegexTest(addRegex,undefined,"add"),
                                 t.genPropRegexTest(cartRegex,undefined,"add")),
                    "add",10),
                t.genPropRegexTest(preOrderRegex)
            ),
            t.genOrTest(
                t.genPositionRangeTest(5,800),
                t.genDomainTest(/\.jp$/)
            ),
            t.negateTest(t.inNavTest),
            t.isClickableTest,
            t.negateTest(
                t.genParentsOrTest(t.genPropRegexTest(/map|area/i,["tagName"]),5)
            )
        );
    };
    
    
    var guessTest = t.genOrTest(
        t.genOrTest(
            t.genAndTest(t.genReTest(addRegex,"html"),
                         t.genReTest(cartRegex,"html")),
            t.genAndTest(t.genReTest(buyRegex,"html"),
                         t.genReTest(buyCompanionRegex,"html")),
            t.genReTest(t.preOrderRegex,"html"),
            t.genReTest(addToCartRegex,"html"),
            t.genReTest(intlAddToCart,"html")
        ));
    
    
    
    var getOneBuyButton = function(nodes) {

        
        if(nodes.length == 1) {
            return nodes[0];
        }
        
        if(nodes.length > 5) {
            return false;
        }
        
        var mutual = nodes[0];
        
        for(var i = 1; i < nodes.length; i++) {
            mutual = findMutualParent(nodes[i],mutual);
        }
        
        for(i = 0; i < nodes.length; i++) {
            if(nodes[i] === mutual) {
                return true;
            }
        }
        
        return false;
        
    };
        
    var runPage = function(win,notify) {
        try {
            if(!(win && win.location && win.location.hostname)) {
                return;
            }
        } catch(e) {
            return;
        }


        if(win.location.hostname.match(/amazon\.(.*?)$/) ||
           (win.location.hostname.match(/apple\.(.*?)$/) &&
             win.location.pathname.match(/^\/startpage\/$/))) { 
            return;
        }
        
        if(win.location.toString().match(/(\/((product)|(dp))\/)|productid=/i) &&
           !win.location.toString().match(/productid=($|&)/i) && 
           !win.location.toString().match(/image/i))  {
            notify();
            return;
        }
        
        if(guessTest(win.document.body,{})) {
            var walker = win.document.createTreeWalker(win.document.body,
                                                   NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
                                                   function(node) {
                                                       return NodeFilter.FILTER_ACCEPT;
                                                   },
                                                   false);
            var matchNodes = [];
            
            var dpTest = getDpTest();
            
            var walk = function(callback) {
                var node;
                for(var i = 0; i < 500; i++) {
                    node = walker.nextNode();
                    if(!node) {
                        callback();
                        return;
                    }
                    
                    if(dpTest(node,{})) {
                        matchNodes.push(node);
                    }
                    
                }
                setTimeout( function() { walk(callback); }, 100);
                
            };
            
            walk(function() {

                for(var i = 0 ; i < matchNodes.length; i++ ) {
                    if(matchNodes[i].nodeType == 3) {
                        matchNodes[i] = matchNodes[i].parentNode;
                    }
                }

                var buyNode = getOneBuyButton(matchNodes);
                if(buyNode) {
                    notify();
                }
            });
        }
    };
    
    AMZUWLXT.runPage = runPage;
})();



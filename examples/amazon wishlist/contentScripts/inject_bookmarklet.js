chrome.extension.sendRequest( {"command" : "localeData"} , function(response) {
    var bookmarklet = "(function(){var w=window,l=w.location,d=w.document,s=d.createElement('script'),e=encodeURIComponent,o='object',n='AUWLBook__LANG__',u='https://__DOMAIN__/wishlist/add',r='readyState',T=setTimeout,a='setAttribute',g=function(){d[r]&&d[r]!='complete'?T(g,200):!w[n]?(s[a]('charset','UTF-8'),s[a]('src',u+'.js?ext=chr&loc='+e(l)+'&b='+n),d.body.appendChild(s),f()):f()},f=function(){!w[n]?T(f,200):w[n].showPopover()};typeof s!=o?l.href=u+'?u='+e(l)+'&t='+e(d.title):g()}())".replace("__DOMAIN__",response.domain).replace("__LANG__",response.lang);    
    
    var s = document.createElement("script");
    s.textContent = bookmarklet;
    document.body.appendChild(s);
});


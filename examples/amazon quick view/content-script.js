var Module = (function(my){

  var INTERVAL = 0.2;
  var enabled = false;
  var $resultPopup;

  my.init = function() {
    initMessageListener();
    appendPopup();
    chrome.runtime.sendMessage({type: "getState"}, function(state) {
      enabled = state;
      if (enabled) {
        onloadHandler();
      }
      observerInit();
    });
  };


  function initMessageListener() {
    chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        if (request.type == "updateState")
          enabled = request.data;
      });
  }


  function appendPopup() {
    $resultPopup = $('<div id="extension-resultPopup"></div>')
      .appendTo($('#resultsCol'))
      .hide();
  }


  function observerInit () {
    var target = document.querySelector('#resultsCol');

    var observer = new MutationObserver( function(mutations) {
      if (!enabled) return;
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          var items = [];
          var targetClass = 's-result-item';
          if ( mutation.addedNodes.length === 1 ) {
            items = $(mutation.addedNodes[0]).find('.' + targetClass);
          }
          else if (mutation.addedNodes.length > 1) {
            $.each(mutation.addedNodes, function(i, node){
              if ($(node).hasClass(targetClass)) {
                items.push(node);
              }
            });
          }
          processItems(items);
        }
      });
    });

    var config = { subtree: true, childList: true, characterData: true };
    observer.observe(target, config);
  }


  function onloadHandler() {
    $(document).ready(function(){
      var items = $('.s-result-list > li');
      processItems(items);
    });
  }


  function processItems(items) {
    for (var i = 0, len = items.length; i < len; i++) {
      processItem(items[i], i*INTERVAL*1000);
    }
  }


  function processItem(item, delay) {
    var $item = $(item);
    var links = $item.find('.a-link-normal');
    if (!links.length) return;
    var url = links[0].href;
    setTimeout( function(){

      $.get(url).done( function(data){
        //console.log(url);
        var details = getDetails(data, url);
        if (!details) return;

        var rank = processDetails(details.innerHTML);
        var $sibling = $item.find('.s-item-container');
        if (!$sibling.length) $sibling = $item.find('.rsltR');
        if (!$sibling.length) {
          console.log("I don't know where to put content: " + url);
          return;
        }
        // hack for next regexp: save 'top 100 in' from replacing
        rank = rank.replace(/([Tt]op \d+) in/, '$1&nbsp;in');
        // make accent for Rank
        rank = rank.replace(/([#\d,]+)\s+in/g, '<span class="extension-rank">$1</span> in');

        if (rank) $('<div class="extension-result">' + rank + '</div>').insertAfter($sibling);

        $item.find('.s-access-image')
          .mouseenter(function(event){
            $resultPopup.show();
            $resultPopup.html(details);
          })
          .mouseleave(function(e){
            $resultPopup.html('').hide();
          });

      });

    }, delay);
  }


  function getDetails(html, url) {
    var $html = $(html);
    var details = $html.find('#detail-bullets .content')[0];
    if (!details) details = $html.find('#detailBullets')[0];
    if (!details) details = $html.find('#prodDetails')[0];
    if (!details) details = $html.find('#detail_bullets_id')[0];
    if (!details) details = $html.find('#productDetailsTable')[0];
    if (!details) {
      console.log('Details not found: ' + url);
      details = '';
    }
    return details;
  }


  function processDetails(html) {
    if (!html) return '';
    var rankStr = $(html).find('#SalesRank').html();
    if (!rankStr) rankStr = '';
    return rankStr;
  }


  return my;

})(Module || {});


Module.init();

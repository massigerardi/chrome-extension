
// The infobar API is still experimantal, this is a test version
(function () {

if (window.devicePixelRatio < 2) 
  var zoom = 1 / window.devicePixelRatio
else // retina
  var zoom = 2 / window.devicePixelRatio;  
var margin = 37 * zoom;

var iframe = document.createElement("iframe");


function build_infobar() {

  iframe.scrolling = "no";
  document.body.appendChild(iframe);

  var doc = iframe.contentWindow.document;
  var default_style = "<style> * { margin:0; padding:0; } </style>";
  var head = "<head>" + default_style + "</head>";
  var body = "<body></body>";
  doc.open().write("<!DOCTYPE html><html>" + head + body + "</html>");
  doc.close();

  iframe.style.cssText   = "height:36px; position:fixed; z-index:9999999; width:100%; top:-37px; left:0; border:0; border-bottom: 1px solid #aaa; overflow:hidden; zoom:" + zoom;
  doc.body.style.cssText = "background-image: -webkit-linear-gradient(bottom, rgb(217,217,217) 0%, rgb(233,233,233) 100%); height:36px; margin:0; font-family:arial, verdana, san-serif; font-size:12px; color:#000; overflow:hidden; zoom:" + zoom;
  //iframe.style.top = -iframe.offsetHeight + 'px'; // 
  iframe.style.webkitTransition = "top .2s";

  var star = document.createElement('img');
  star.style.cssText = "display: inline-block; left: 16px; width: 19px; height: 19px; top: 4px; position: relative;";
  star.src ="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAATCAMAAABFjsb+AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QjE4RDY3QUU4QjIxMTFFM0JBQzRFQTRGOTlDNTA1RjYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QjE4RDY3QUY4QjIxMTFFM0JBQzRFQTRGOTlDNTA1RjYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpCMThENjdBQzhCMjExMUUzQkFDNEVBNEY5OUM1MDVGNiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpCMThENjdBRDhCMjExMUUzQkFDNEVBNEY5OUM1MDVGNiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Ph5QCngAAAEaUExURdvb2+Tk5JycnN3d3eDg4OHg4Z2dneTl5ePj5ODh4Nna2eTk49na2uPi46mpqdvb3OHi4t7e3eXl5Nvb2uDf4NrZ2tra2dnZ2drZ2WBgYKqqqoqKiuTk5Z6entrb2trb2+Tl5OXk5eXk5Nva2+Hi4eHg4Nzb297e3t/g36ysrOLh4d3c3N/g4HFxcdTV1cPDw9/f3p2cnePk5ODg4d3d3OLj4qmpqNXV1eTj5Nzb3Nvc3JybnJ2entra28PCwqurrLm5udva2uPk493d3tzc3eLh4qurq9zd3N3e3Xl4eODf36qpqaurqtvc23BxceLj49/f4J6dntnZ2uTj4+Dg36ipqJycneXl5dzc3OPj4+Hh4eLi4tra2lhYWKvZnKAAAADtSURBVHjaXMjVdsJAFIXhPSQhCjGsLa51d6PubsP0hPd/jZKEdLX8F2ed/YFzj6ucN8Kjcq+u1htgZVZussowqtJkzGMwz0xt/f0wttddzdQ0CCEyQqRjS0cDmWdBRIkRbRGBaL7dprXYvhzn0iF8R6ViS0UDiiLrip6Y3lE6G1h8kXMfs2M7kHPynYy54WQzWO1PUg899+of3boubiTp4Q8t7ZxLuJYGF9O/9LS8KS1gbzAqwamVcAF21wbuYzq2u9h/RKsF/9T3s6GdVKuo1YBg3AizwVH0wigWLCMoWdbndr5UeAvyReNHgAEANbJZVuiYn/AAAAAASUVORK5CYII=";

  var text = document.createElement('div');
  text.style.cssText = "display:inline-block; font-size: 14px; line-height: 36px; padding-left: 26px;";
  text.innerHTML = "Finally! Manage your <b>downloads</b> with a dropdown menu in the top right corner</b>";

  var button = document.createElement('a');
  button.style.cssText = "display:inline-block; background-image: -webkit-linear-gradient(bottom, rgb(228,228,228) 0%, rgb(249,249,249) 100%); border:1px solid #8a8a8a; border-radius: 4px; padding: 4px 6px; color: #000; font-size: 13px; margin: 6px 20px; text-decoration:none; ";
  button.innerHTML = "Show me how";
  button.href = "https://chrome.google.com/webstore/detail/downloadr/gjihnjejboipjmadkpmknccijhibnpfe";
  button.target = "_blank";
  button.onmouseover = function() {
    button.style.cssText += "border-color:#454545;";
  }
  button.onmousedown = function() {
    button.style.cssText += "background-image: -webkit-linear-gradient(bottom, rgb(246,246,246) 0%, rgb(237,237,237) 100%);";
  }
  button.onmouseout = function() {
    button.style.cssText += "background-image: -webkit-linear-gradient(bottom, rgb(228,228,228) 0%, rgb(249,249,249) 100%); border:1px solid #8a8a8a;";
  }
  button.onclick = close_infobar;

  var close = document.createElement('div');
  close.style.cssText = "color: #666; display: inline-block; position: absolute; right: 12px;  top: 10px; color:#222; padding: 0px 5px 3px; border-radius: 65px; cursor:default; font-family: verdana, sans-serif;";
  close.innerHTML = "x";
  close.onmouseover = function() {
    close.style.cssText += "background: #e69186; color: #fff; border: 1px solid #cb7368;";
  }
  close.onmouseout = function() {
    close.style.cssText += "background: transparent; color:#222; border:0;";
  }
  close.onclick = close_infobar;
  setTimeout(close_infobar, 30*1000);

  doc.body.appendChild(star);
  doc.body.appendChild(text);
  doc.body.appendChild(button);
  doc.body.appendChild(close);  

  setTimeout(function(){
    iframe.style.top = 0;  
    document.body.style.webkitTransition = "margin .2s";
    document.body.style.marginTop = margin + "px";
  }, 1000)
}

function close_infobar() {
  iframe.style.top = '-' + margin + 'px';
  document.body.style.marginTop = "";
  setTimeout(function(){
    iframe.parentNode.removeChild(iframe);
  }, 1000)
}


window.addEventListener("DOMContentLoaded", init, false);

function init() {
  chrome.runtime.sendMessage("promo-ready", function(response) {
    if (response) {
      chrome.runtime.sendMessage("promo-shown");
      setTimeout(build_infobar, 3000);
    }
  });
}

})();
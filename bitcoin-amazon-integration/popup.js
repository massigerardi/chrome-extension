var first_run = false;
if (!localStorage['ran_before']) {
  first_run = true;
  localStorage['ran_before'] = '1';
}

if (first_run) localStorage['user_id'] = makeid();

getCurrentTabUrl(function(url) {
  renderStatus(url);
});


function makeid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

// storage management

function store(items) {
  var value = JSON.stringify(items)
  console.log('store items ' + value);
  localStorage['items'] = value;
}

function clearItems() {
  localStorage['items'] = JSON.stringify({});
}

function loadItems() {
  var items = localStorage['items']
  return JSON.parse(items);
}

function contains(product) {
    var items = loadItems()
    var ok = items[product.code] != null
    return items[product.code] != null
}

function removeItem(code) {
  console.log("removing "+code)
  var items = loadItems()
  var product = items[code]
  if (product != null) {
    delete items[code]
    $('#'+code).remove()
    items['size'] = items['size'] - 1
    items['total'] = calculatePrice(items)
    store(items)
    $('#itemsnumber').text(items['size']);
    $('#totalprice').text(items['total']);
  }
}



function clearCart() {
  clearItems()
  $('#cart').empty()
}

function addToCart() {
  var items = loadItems()
  var id = '#'+currentProduct.code;
  items[currentProduct.code] = currentProduct
  items['size'] = items['size'] + 1
  items['total'] = calculatePrice(items)
  store(items)
  $('#itemsnumber').text(items['size']);
  $('#totalprice').text(items['total']);
  $('.cart-button-add').remove()
  $(id).append("<span class='cart-item-success-message'>Successfull added product</span>")
}

function closeWindow() {
  window.close();
}


/**
 * Get the current URL.
 *
 * @param {function(string)} callback - called when the URL of the current tab
 *   is found.
 */
function getCurrentTabUrl(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    callback(tabs[0]);
  });

}

function renderStatus(tab) {
  var urlRegex = /^https?:\/\/(?:[^\.]+\.)?amazon\.de/;
  var url = tab.url
  if (urlRegex.test(url)) {
    console.log("url: "+url)
    chrome.runtime.onConnect.addListener(function (port) {
      port.onMessage.addListener(function (msg) {
        if (msg.product != null) {
          msg.product.url = url
          renderProduct(msg.product);
        }
      });
    });
    chrome.tabs.sendMessage(tab.id, { text: "get_product" }, null);
  } 
  populateItems();
  $('.cart-button-clear').click(clearCart)
  $('.cart-button-continue').click(closeWindow)
  $('.cart-button-checkout').click(checkout)
}

function checkout(){
  console.log('checkout')
}

var currentProduct;
function renderProduct(product) {
  console.log("product: "+JSON.stringify(product))
  if (contains(product)) {
    return
  }
  currentProduct = product
  getBitcoinPrice(product)
  populateItem(product)
  var id = '#'+product.code;
  if (product.active) {
    $(id).append("<a href='#' class='cart-button-add'>Add</a>")
    $('.cart-button-add').click(addToCart)
  } else {
    $(id).append("<span class='cart-item-fail-message'>No Valid Product</span>")
  }
}

function getBitcoinPrice(product) {
  euro = product.price
  currency = euro.substring(0, 3)
  amount = euro.substring(4, euro.lenght).replace(",",".")
  var searchUrl = 'https://blockchain.info/tobtc?currency='+currency+'&value='+amount
  $.ajaxSetup({async: false});
  $.get(searchUrl,
      function(data) {
          if(data.isOk == false) {
            console.log(data.message);
          }
          product.btcprice = Math.round(data * 1000) / 1000;
      }
    );          
}

function calculatePrice(items) {
  var total = 0.0
  var len = items.length;
  for (var key in items) {
    if (items.hasOwnProperty(key)) {
      if (key == 'size' || key == 'total') {
        continue
      }
      total = total + items[key].btcprice
    }
  }
  return Math.round(total * 1000) / 1000

}

var cartitem = "<li class='cart-item' id='${code}'>\n"
  + "<span class='cart-item-pic'><img src='${imagesrc}'></span>\n"
  + "${title}\n"
  + "<span class='cart-item-desc'>${description}</span>"
  + "<span class='cart-item-price-btc'>BTC ${btcprice}</span>\n"
  + "<span class='cart-item-price'>${price}</span>\n"
  + "</li>\n"

function populateItem(item) {
    var description = "";
    var descriptions = item.descriptions
    for (var key in descriptions) {
      if (descriptions.hasOwnProperty(key)) {
        description += "<span class='item-desc-field'>"+key+": </span><span class='item-desc-value'>"+descriptions[key]+"</span><br/>"
      }
    }
    var entry = cartitem
        .replace("${code}", item.code)
        .replace("${imagesrc}", item.imagesrc)
        .replace("${title}", item.title)
        .replace("${description}", description)
        .replace("${btcprice}", item.btcprice)
        .replace("${price}", item.price)
    $('#cart').append(entry)
}



function populateItems() {
  var items = loadItems()
  var counter = 0;
  for (var key in items) {
    if (items.hasOwnProperty(key)) {
      if (key == 'size' || key == 'total') {
        continue
      }
      populateItem(items[key], cartitem, '')
      var code = items[key].code;
      counter++
    }
  }
  items['size'] = counter
  items['total'] = calculatePrice(items)
  store(items)
  $('#itemsnumber').text(items['size']);
  $('#totalprice').text(items['total']);
}




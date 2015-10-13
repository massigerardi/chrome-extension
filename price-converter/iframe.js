	CCC = {
		currencies : {
			'EUR' : 'Euro',
			'USD' : 'US dollar',
			'GBP' : 'Pound sterling',
			'AED' : 'Arab Emirates dirham',
			'AUD' : 'Australian dollar',
			'BGN' : 'Bulgarian lev',
			'BRL' : 'Brasilian real',
			'BTC' : 'Bitcoin',
			'CAD' : 'Canadian dollar',
			'CHF' : 'Swiss franc',
			'CNY' : 'Chinese yuan renminbi',
			'CZK' : 'Czech koruna',
			'DKK' : 'Danish krone',
			'EEK' : 'Estonian kroon',
			'EGP' : 'Egyptian Pound',		
			'HKD' : 'Hong Kong dollar',
			'HRK' : 'Croatian kuna',
			'HUF' : 'Hungarian forint',
			'IDR' : 'Indonesian rupiah',
			'INR' : 'Indian rupee',
			'ISL' : 'Israeli shekel',
			'JPY' : 'Japanese yen',
			'KRW' : 'South Korean won',
			'KWD' : 'Kuwaiti dinar',			
			'LTL' : 'Lithuanian litas',
			'LVL' : 'Latvian lats',
			'MXN' : 'Mexican peso',
			'MYR' : 'Malaysian ringgit',
			'NOK' : 'Norwegian krone',
			'NZD' : 'New Zealand dollar',
			'PHP' : 'Philippine peso',
			'PLN' : 'Polish zloty',
			'RON' : 'New Romanian',
			'RUB' : 'Russian rouble',
			'SAR' : 'Saudi Riyal',		
			'SEK' : 'Swedish krona',
			'SGD' : 'Singapore dollar',
			'THB' : 'Thai baht',
			'TRY' : 'Turkish lira',
			'TTD' : 'Trinidad dollar',			
			'UAH' : 'Ukrainian grivna',
			'ZAR' : 'South African rand'		
		},
		
		initialize : function() {
			// Get data from location
			CCC.data	= JSON.parse(decodeURIComponent(location.href).replace(/.*?data=/, ''));
			var amount	= document.getElementById('amount');
	
			document.getElementById('convert').innerHTML = 'Convert to '+CCC.data.currency;
			var select	= document.getElementById('currency');
			var html 	= ['<optgroup label="Major currencies">'];
			var cnt		= 0;
			for(var i in CCC.currencies) {
				if(i === CCC.data.currency) {
				
					continue;
				}
				//cnt ++;
				if( cnt++ == 3) {
					html.push ('</optgroup><optgroup label="More currencies">');
				}			
				html.push( '<option ' + (i == CCC.data.currency ? 'selected class=\"selected\"' : '') + ' value="'+i+'">' + i + ' - ' + CCC.currencies[i] + '</option>');
			}
			html.push('</optgroup>');
			select.innerHTML = html.join('\n');							
			
			
			
			
			window.addEventListener('keydown', function(event){
				if(event.keyCode === 27 ) {
					parent.postMessage('CCC.close', '*');
				}
			}, false);
		
			
			amount.focus();
			
			
			var hash = String(document.location.hash || '').slice(1);
			setInterval(function() {
				var newHash = String(document.location.hash || '').slice(1);
			
				if(newHash !== hash) {
				
					var amount = newHash.replace(/[^0-9\.]/gi, '');
					document.getElementById('result').innerHTML =  ( parseFloat(amount).toFixed(3)  ) + ' '+ CCC.data.currency;
					hash = newHash;
				}
			}, 10)
			
			/*
			window.addEventListener('message', function(event) {
				if(event.data === 'CCC.open') {
					
					setTimeout(
					function() {
						window.focus();
						var am = document.getElementById('amount');
						am.select();
						am.focus();
						
				}, 100);
					return;
				}

				
				var json = JSON.parse(event.data);
				
								
				if(json.currency) {
					CCC.data = JSON.parse(event.data)
					
					document.getElementById('button').innerHTML = 'Convert to '+json.currency;
					var select	= document.getElementById('currency');
					var html 	= ['<optgroup label="Major currencies">'];
					var cnt		= 0;
					for(var i in CCC.currencies) {
						if(i === json.currency) {
							cnt ++;
							continue;
						}
						if( cnt++ == 3) {
							html.push ('</optgroup><optgroup label="More currencies">');
						}
						
						html.push( '<option ' + (i == CCC.data.currency ? 'selected class=\"selected\"' : '') + ' value="'+i+'">' + i + ' - ' + CCC.currencies[i] + '</option>');
					}
					html.push('</optgroup>');
					select.innerHTML = html.join('\n');							
				} else {
					//json.amount = json.amount.replace(/[^0-9]/gi, '');
					
					document.getElementById('result').innerHTML =  ( parseFloat(json.amount).toFixed(3)  ) + ' '+ CCC.data.currency;
					//alert(json.amount + 'iframe');
					
				}
				
				
								
			}, false);

			*/
			
			
		},
				
		convert	 : function() {
			var amount 		= document.getElementById('amount');
			var value		= amount.value;
			var currency 	= document.getElementById('currency').value;

			if(!value) {
				amount.focus();
			}
			
			
			var json		= {
				'action'	: 'convert',
				'currency'	: currency,
				'amount'	: value
				
			}
			
			
			
			parent.postMessage(JSON.stringify(json), '*');

		}
	}
		
document.addEventListener('DOMContentLoaded', CCC.initialize);
document.getElementById('convert').addEventListener('click', CCC.convert);
document.getElementById('amount').addEventListener('onkeydown', function(event) { if(event.keyCode === 13) CCC.convert(); });


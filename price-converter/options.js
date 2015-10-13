
	currencies = {
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
		'GEL' : 'Georgian Lari',
		'HKD' : 'Hong Kong dollar',
		'HRK' : 'Croatian kuna',
		'HUF' : 'Hungarian forint',
		'IDR' : 'Indonesian rupiah',
		'INR' : 'Indian rupee',
		'NIS' : 'New Israeli shekel',
		'JPY' : 'Japanese yen',
		'KRW' : 'South Korean won',
		'KWD' : 'Kuwaiti dinar',
        'LKR' : 'Sri Lankan Rupee',
		'LTL' : 'Lithuanian litas',
		'LVL' : 'Latvian lats',
		'MXN' : 'Mexican peso',
		'MYR' : 'Malaysian ringgit',
		'NOK' : 'Norwegian krone',
		'NZD' : 'New Zealand dollar',
        'PHP' : 'Philippine peso',
		'PKR' : 'Pakistan Rupee',
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
	};


	Options = {
		data		: localStorage['data'] ? JSON.parse(localStorage['data']) : { 'currency' : 'BTC', 'icon': true},

		initialize	: function() {
			var chk					= document.getElementById('icon');

			var domainsContainer 	= document.getElementById('domains-container');
			var domains		 		= document.getElementById('domains');

			var disDomainsContainer 	= document.getElementById('dis-domains-container');
			var disDomains		 		= document.getElementById('dis-domains');

			var original			= document.getElementById('original');

			var formatPosition		= document.getElementById('format-position');
			var formatDecimal		= document.getElementById('format-decimal');

			var highlight			= document.getElementById('highlight');

			var thousands			= document.getElementById('thousands');

			var separateSymbol		= document.getElementById('separate-symbol');

			if(this.data.domains !== undefined) {
				domains.value = this.data.domains;
			}

			if(this.data.disDomains !== undefined) {
				disDomains.value = this.data.disDomains;
			}


			if(this.data.original) {
				original.checked = true;
			}

			if(this.data.thousands || this.data.thousands == undefined) {
				thousands.checked = true;
			}

			if(this.data.highlight || this.data.highlight === undefined) {
				highlight.checked = true;
			}


			if(this.data.icon || this.data.icon === undefined) {
				chk.checked = true;
			}

			if(this.data.separateSymbol) {
				separateSymbol.checked = true;
			}

			var radios	= document.getElementsByName('usedomains');
			if(this.data.usedomains == false || this.data.usedomains === undefined) {
				radios[0].checked = true;
				radios[1].checked = false;
			}  else {
				radios[0].checked = false;
				radios[1].checked = true;
				domainsContainer.style.display = 'block'
			}

			radios[0].addEventListener('change', function(event) {
				domainsContainer.style.display = 'none'
			}, false);

			radios[1].addEventListener('change', function(event) {
				domainsContainer.style.display = 'block'
				domains.focus();
			}, false);


			var disRadios	= document.getElementsByName('dis-usedomains');
			if(this.data.disUsedomains == false || this.data.disUsedomains === undefined) {
				disRadios[0].checked = true;
				disRadios[1].checked = false;
			}  else {
				disRadios[0].checked = false;
				disRadios[1].checked = true;
				disDomainsContainer.style.display = 'block'
			}

			disRadios[0].addEventListener('change', function(event) {
				disDomainsContainer.style.display = 'none'
			}, false);

			disRadios[1].addEventListener('change', function(event) {
				disDomainsContainer.style.display = 'block'
				disDomains.focus();
			}, false);




			var select	= document.getElementById('currency');
			var html 	= ['<optgroup label="Major currencies">'];
			var cnt		= 0;
			for(var i in currencies) {
				if( cnt++ == 3) {
					html.push ('</optgroup><optgroup label="More currencies">');
				}
				html.push( '<option ' + (i == this.data.currency ? 'selected class=\"selected\"' : '') + ' value="'+i+'">' + i + ' - ' + currencies[i] + '</option>');
			}
			html.push('</optgroup>');
			select.innerHTML = html.join('\n');

			if(this.data.formatPosition) {
				this.select('format-position', this.data.formatPosition);
			}

			if(this.data.formatDecimal) {
				this.select('format-decimal', this.data.formatDecimal);
			}

			// Round
			if(this.data.round) {
				this.select('round', this.data.round);
			}


		},

		save		: function() {
			var select		= document.getElementById('currency');
			var index		= select.selectedIndex;
			var radios		= document.getElementsByName('usedomains');

			var disRadios	= document.getElementsByName('dis-usedomains');

			var original	= document.getElementById('original');
			var thousands	= document.getElementById('thousands');
			var separateSymbol	= document.getElementById('separate-symbol');

			select.querySelector('.selected').className = '';
			select.options[index].className = 'selected';
			var currency 	= select.value;


			// Store currency
			this.data 				= localStorage['data'] ? JSON.parse(localStorage['data']) : this.data;
			this.data.currency 		= currency;
			this.data.icon			= !!document.getElementById('icon').checked;
			this.data.usedomains	= !!radios[1].checked;
			this.data.original		= !!original.checked;
			this.data.domains		= document.getElementById('domains').value;

			this.data.disUsedomains	 = !!disRadios[1].checked;
			this.data.disDomains	 = document.getElementById('dis-domains').value;

			this.data.formatDecimal		= document.getElementById('format-decimal').value;
			this.data.formatPosition	= document.getElementById('format-position').value;

			this.data.round				= document.getElementById('round').value;

			this.data.separateSymbol 	= !!separateSymbol.checked;

			console.log(this.data.round)

			this.data.highlight			= !!document.getElementById('highlight').checked;

			this.data.thousands		= !!thousands.checked;

			localStorage['data']	= JSON.stringify(this.data);


			var say = document.getElementById('say');
			say.innerHTML = 'Saved';
			say.style.display = 'inline';
			setTimeout((function() {
				say.style.display = 'none';

			}), 1500);


			chrome.extension.sendRequest({'update': true}, function() {

			});

		},



	select	: function(what, value) {
		var select = document.getElementById(what);
		Array.prototype.slice.call(select.options).forEach(function(option, index) {
			if(option.value == value ) {
				select.selectedIndex = index;
			}
		});
	}



	}

Options.initialize();
document.getElementById('save').addEventListener('click', Options.save);


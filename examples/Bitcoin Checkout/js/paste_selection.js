(function () {

// make sure it's a compuse window we opened
var match = document.URL.match(/selid=(\d+)/) || [];
var selectionId = match[1];
if (!selectionId || !/view=cm/.test(document.URL)) {
	return;
}

function selectionReciever(selectionHtml) {
	// save original focused element
	var focusedEl = document.activeElement;
	// give focus to the editor
	getEditor().focus();
	// paste selected HTML
	document.execCommand('insertHtml', false, selectionHtml);
	// give focus back to the original element
	focusedEl && focusedEl.focus();
}

function getEditor() {
	return document.getElementsByClassName('editable')[0];
}

function init() {
	// request selected HTML to be inserted
	chrome.runtime.sendMessage({
			name: 'getSelection',
			id: selectionId
		}, 
		selectionReciever
	);
}

// wait for the editor to be ready for insertion
var readyTimer = setInterval(function () {
	if (getEditor()) {
		clearInterval(readyTimer);
		// kick things off
		init();
	}
}, 20);

})();
const productTitle = document.getElementById('productTitle').textContent.trim();
chrome.runtime.sendMessage({headerTitle: productTitle});

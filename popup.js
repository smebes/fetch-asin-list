document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            function: getProductDetailsForDownload
        }, (results) => {
            if (results && results.length > 0) {
                const headerTitle = results[0].result;
                if (headerTitle) {
                    document.getElementById('headerTitle').textContent = headerTitle;
                } else {
                    document.getElementById('headerTitle').textContent = "Baslik bulunamadi.";
                }
            }
        });
    });
    
    document.getElementById('fetchDetails').addEventListener('click', function() {
        const asinList = document.getElementById('asinList').value.split('\n').filter(Boolean);
        chrome.runtime.sendMessage({action: "fetchDetails", asinList: asinList});
    });

    document.getElementById('stopButton').addEventListener('click', function() {
        chrome.runtime.sendMessage({action: "stop"});
    });

});


document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.scripting.executeScript({
            target: {tabId: tabs[0].id},
            // function: getPageDetails
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
    document.getElementById('downloadButton').addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const tab = tabs[0]; // Aktif sekmeyi al
            const asin = getASINFromUrl(tab.url); // ASIN numarasını al
    
            chrome.scripting.executeScript({
                target: {tabId: tab.id},
                function: getProductDetailsForDownload
            }, (injectionResults) => {
                for (const frameResult of injectionResults)
                    if (frameResult.result) {
                        const details = frameResult.result;
                        const blob = new Blob([details], {type: 'text/plain;charset=utf-8'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        // ASIN varsa dosya adını ASIN ile belirle, yoksa varsayılan ismi kullan
                        a.download = asin ? `${asin}.txt` : '1.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
            });
        });
    });
    document.getElementById('downloadImageButton').addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const tab = tabs[0];
            chrome.scripting.executeScript({
                target: {tabId: tab.id},
                function: getImageUrlForDownload
            }, (injectionResults) => {
                const asin = getASINFromUrl(tab.url);
                for (const frameResult of injectionResults)
                    if (frameResult.result) {
                        chrome.downloads.download({
                            url: frameResult.result,
                            filename: asin ? `${asin}.jpg` : 'downloaded-image.jpg'
                        });
                    }
            });
        });  
    });   
    document.getElementById('fetchDetails').addEventListener('click', function() {
        const asinList = document.getElementById('asinList').value.split('\n').filter(Boolean);
        chrome.runtime.sendMessage({action: "fetchDetails", asinList: asinList});
    });
    
      
});


function getImageUrlForDownload() {
    const imageElement = document.getElementById('landingImage');
    if (imageElement) {
        return imageElement.src;
    } else {
        return null; 
    }
}



function getProductDetailsForDownload() {
    let details = `Title: ${document.getElementById('productTitle') ? document.getElementById('productTitle').textContent.trim() : "Title not found"}\n`;

    // Ürün detaylarını al
    document.querySelectorAll('#detailBullets_feature_div .a-list-item, #productOverview_feature_div .a-list-item').forEach(item => {
        const textContent = item.textContent.trim();
        if (textContent) {
            details += `${textContent.replace(/\s+/g, ' ')}\n`; // Fazladan boşlukları temizle
        }
    });

    // Diğer spesifik bilgileri al
    const bestSellersRank = document.querySelector("#SalesRank") ? document.querySelector("#SalesRank").textContent.trim() : "";
    if (bestSellersRank) {
        details += `Best Sellers Rank: ${bestSellersRank.replace(/\s+/g, ' ')}\n`;
    }

    const customerReviews = document.querySelector("#acrCustomerReviewText") ? document.querySelector("#acrCustomerReviewText").textContent.trim() : "";
    if (customerReviews) {
        details += `Customer Reviews: ${customerReviews.replace(/\s+/g, ' ')}\n`;
    }

    return details;
}


function getASINFromUrl(url) {
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
    return asinMatch ? asinMatch[1] : null;
}

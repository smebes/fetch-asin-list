
let isStopped = false;

function stopProcessing() {
    isStopped = true;
    if (currentProcessingTabId !== null) {
        chrome.tabs.remove(currentProcessingTabId); 
        currentProcessingTabId = null;
    }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "stop") {
        stopProcessing();
    }
});


chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    function: setPageBackgroundColor,
  });
});

function setPageBackgroundColor() {
  document.body.style.backgroundColor = 'yellow';
}


chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    if (tabId === currentProcessingTabId) {
        console.log('İşlem gören sekme kapatıldı, işlem durduruluyor.');
        stopProcessing();
    }
});

let processingQueue = [];
let isProcessing = false;

function processNextItem() {
    if (isStopped || processingQueue.length === 0) {
        isProcessing = false;
        processingQueue = []; 
        currentProcessingTabId = null;
        return;
    }

    isProcessing = true;
    const asin = processingQueue.shift(); 

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0]; 

        chrome.tabs.update(currentTab.id, {url: `https://www.amazon.com.tr/dp/${asin}`}, function(currentTab) {
            chrome.tabs.onUpdated.addListener(function updated(tabId, changeInfo, currentTab) {
                if (tabId === currentTab.id && changeInfo.status === 'complete') {
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.scripting.executeScript({
                        target: {tabId: currentTab.id},
                        function: postDatabase
                    }, (injectionResults) => {
                        if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                            const productData = injectionResults[0].result;

                            fetch('http://127.0.0.1:5000/add-product', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(productData),
                            })
                            .then(response => response.json())
                            .then(data => console.log('Ürün başarıyla eklendi:', data))
                            .catch((error) => console.error('Hata:', error));

                            
                        }
                    });
                    chrome.scripting.executeScript({
                            target: {tabId: currentTab.id},
                            function: getProductDetailsForDownload
                        }, (injectionResults) => {
                            if (injectionResults && injectionResults[0] && injectionResults[0].result && injectionResults[0].result !== "Title not found") {
                            const details = injectionResults[0].result;
                            const asin = getASINFromUrl(currentTab.url);
                            const blob = new Blob([details], {type: 'text/plain;charset=utf-8'});
                            const reader = new FileReader();
                            reader.onload = function() {
                                chrome.downloads.download({
                                    url: reader.result,
                                    filename: asin ? `${asin}.txt` : 'details.txt'
                                });
                            };
                            reader.readAsDataURL(blob);
                            } else {
                            console.log('Ürün bulunamadı, indirme yapılmıyor.');
                            }
                        });
                    });
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
                    

                    chrome.tabs.onUpdated.removeListener(updated);
                    if (processingQueue.length > 0 && !isStopped) {
                        processNextItem();
                    } else {
                        isProcessing = false;
                        chrome.tabs.remove(currentProcessingTabId);
                        currentProcessingTabId = null;
                    }
                }
            });
        });
    });
}

function postDatabase() {
    let details = '';
    document.querySelectorAll('#detailBullets_feature_div .a-list-item, #productOverview_feature_div .a-list-item').forEach(item => {
        const textContent = item.textContent.trim();
        if (textContent) {
            details += `${textContent.replace(/\s+/g, ' ')}\n`; 
        }
    });

    return {
        name: document.getElementById('productTitle') ? document.getElementById('productTitle').textContent.trim() : "Title not found",
        description: details,
        price: "99.99"
    };
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fetchDetails") {
        isStopped = false; 
        processingQueue = [...request.asinList];
        if (!isProcessing) {
            processNextItem();
        }
    }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "sendProductData1") {
        fetch('http://127.0.0.1:5000/add-product', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request.data),
        })
        .then(response => response.json())
        .then(data => console.log('Ürün başarıyla eklendi:', data))
        .catch((error) => console.error('Hata:', error));
    }
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
    if (document.getElementById('productTitle')) {
        let details = `Title: ${document.getElementById('productTitle') ? document.getElementById('productTitle').textContent.trim() : "Title not found"}\n`;

        document.querySelectorAll('#detailBullets_feature_div .a-list-item, #productOverview_feature_div .a-list-item').forEach(item => {
            const textContent = item.textContent.trim();
            if (textContent) {
                details += `${textContent.replace(/\s+/g, ' ')}\n`; // Fazladan boşlukları temizle
            }
        });

        const bestSellersRank = document.querySelector("#SalesRank") ? document.querySelector("#SalesRank").textContent.trim() : "";
        if (bestSellersRank) {
            details += `Best Sellers Rank: ${bestSellersRank.replace(/\s+/g, ' ')}\n`;
        }

        const customerReviews = document.querySelector("#acrCustomerReviewText") ? document.querySelector("#acrCustomerReviewText").textContent.trim() : "";
        if (customerReviews) {
            details += `Customer Reviews: ${customerReviews.replace(/\s+/g, ' ')}\n`;
        }

        return details;
       
    } else {
        return "Title not found";
    }
  
}


function getASINFromUrl(url) {
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return asinMatch ? asinMatch[1] : null;
}




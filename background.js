
// 0062060619
// 1250773628
// 1250855578
// 0316422967
// 0316444006


chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    function: setPageBackgroundColor,
  });
});

function setPageBackgroundColor() {
  document.body.style.backgroundColor = 'yellow';
}


let processingQueue = [];
let isProcessing = false;

function processNextItem() {
  if (processingQueue.length === 0) {
      isProcessing = false;
      return;
  }
  
  isProcessing = true;
  const asin = processingQueue.shift(); 

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0]; 

      chrome.tabs.update(currentTab.id, {url: `https://www.amazon.com/dp/${asin}`}, function(currentTab) {
          chrome.tabs.onUpdated.addListener(function updated(tabId, changeInfo, currentTab) {
              if (tabId === currentTab.id && changeInfo.status === 'complete') {
                  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                  
                      chrome.scripting.executeScript({
                          target: {tabId: currentTab.id},
                          function: getProductDetailsForDownload
                      }, (injectionResults) => {
                            if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                              const details = injectionResults[0].result;
                              const blob = new Blob([details], {type: 'text/plain;charset=utf-8'});
                              const reader = new FileReader();
                              reader.onload = function() {
                                  chrome.downloads.download({
                                      url: reader.result,
                                      filename: asin ? `${asin}.txt` : 'details.txt'
                                  });
                              };
                              reader.readAsDataURL(blob);
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
                  if (processingQueue.length > 0) {
                      processNextItem();
                  } else {
                      isProcessing = false;
                  }
              }
          });
      });
  });
  
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fetchDetails") {
        processingQueue.push(...request.asinList); 
        if (!isProcessing) {
            processNextItem(); 
        }
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
}


function getASINFromUrl(url) {
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return asinMatch ? asinMatch[1] : null;
}




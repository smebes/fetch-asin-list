
let isStopped = false;
let currentProcessingTabId = null;


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

        chrome.tabs.update(currentTab.id, {url: `https://www.amazon.com/dp/${asin}`}, function(currentTab) {
            chrome.tabs.onUpdated.addListener(function updated(tabId, changeInfo, currentTab) {
                if (tabId === currentTab.id && changeInfo.status === 'complete') {
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.scripting.executeScript({
                        target: {tabId: currentTab.id},
                        function: postDatabase
                    }, (injectionResults) => {
                        if (injectionResults && injectionResults[0] && injectionResults[0].result && injectionResults[0].result !== "Title not found") {
                            const productData = injectionResults[0].result ?? {asin:asin};

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
                        } else {
                                fetch('http://127.0.0.1:5000/add-product', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({asin:asin}),
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
 
    const listItems = document.querySelectorAll('#detailBullets_feature_div .a-list-item');
    let publisherInfo = '';
    let publisherName = '';
    let publishDate = '';
    let asin = ''
    let ISBN13 = ''
    let ISBN10 = ''
    let language = ''
    let Weight = ''
    let Dimensions = ''
    let edition = ''
    let LexileMeasure = ''

    listItems.forEach(item => {
        if (item.textContent.includes('Publisher')) {
            publisherInfo = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
            if (publisherInfo.includes(';')) {
                const parts = publisherInfo.split(';');
                publisherName = parts[0].trim();
                newData = parts[1].trim();
                let publisher = newData.split('(');
                edition = publisher ? publisher[0] : '----'; 
                publishDate = publisher ? publisher[1] .replace(")", ''): "Publish date not found";
            } else {
                let publisher = publisherInfo.split('(');
                publisherName = publisher ? publisher[0] : "Publisher information not found";
                publishDate = publisher ? publisher[1] .replace(")", ''): "Publish date not found";
            }
        } else if (item.textContent.includes('ASIN')) {
            asin = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
        } else if (item.textContent.includes('ISBN-13')) {
            ISBN13 = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
        } else if (item.textContent.includes('ISBN-10')) {
            ISBN10 = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
        } else if (item.textContent.includes('Language')) {
            language = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
        } else if (item.textContent.includes('Item Weight')) {
            Weight = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
        } else if (item.textContent.includes('Dimensions')) {
            Dimensions = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
        } else if (item.textContent.includes('Lexile measure')) {
            LexileMeasure = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
        } else if (item.textContent.includes('Grade level')) {
            GradeLevel = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ');
        } 
    });

    const pageValueSection = document.querySelector('#rpi-attribute-book_details-fiona_pages .rpi-attribute-value');
    let pageNumberById = pageValueSection ? pageValueSection.querySelector('p span').textContent.trim() : 0;

    let rankText = '';
    
    let categories = [];
    
    document.querySelectorAll('#detailBullets_feature_div .a-list-item').forEach(item => {
        if (item.textContent.includes('Best Sellers Rank')) {
            rankText = item.textContent.trim();

            const ulElement = item.querySelector('ul'); 
            if (ulElement) {
                ulElement.querySelectorAll('li').forEach(li => {
                    const categoryText = li.textContent.trim();
                    categories.push(categoryText);
                });
            }
        }
    });
    const rankMatch = rankText.match(/#(\d+,\d+|\d+) in Books/);
    let rankNumber = rankMatch ? rankMatch[1].replace(',', '') : 'Rank information not found';

    let category1 = categories.length > 0 ? categories[0].substring(0, 250) : 'Category not found';
    let category2 = categories.length > 1 ? categories[1].substring(0, 250) : 'Category not found';
    let category3 = categories.length > 2 ? categories[2].substring(0, 250) : 'Category not found';


    let customerRating = '';
    const ratingElement = document.querySelector('#averageCustomerReviews .a-icon-alt');
    if (ratingElement) {
        customerRating = ratingElement.textContent.trim().split(' ')[0]; // "4.8 out of 5 stars" metninden sadece "4.8" kısmını alır
    }

    let numberOfReviews = 0;
    const reviewsElement = document.getElementById('acrCustomerReviewText');
    if (reviewsElement) {
        numberOfReviews = reviewsElement.textContent.trim().split(' ')[0].replace(',', ''); // "11,717 ratings" metninden sadece "11,717" kısmını alır ve virgülü siler
    }

    
    return {
        asin: asin,
        title: document.getElementById('productTitle') ? document.getElementById('productTitle').textContent.trim() : "",
        author: 'a',
        publisher: publisherName,
        isbn10: ISBN10,
        isbn13: ISBN13,
        description:'description',
        binding: document.getElementById('productSubtitle') ? document.getElementById('productSubtitle').textContent.trim().split('–')[0] : "", 
        edition: edition,
        numberOfPages: pageNumberById,
        dimensions: Dimensions,
        weight: Weight,
        publishDate: publishDate,
        language: language,
        customerRating:customerRating,
        numberOfReviews:numberOfReviews,
        rankNumber: rankNumber,
        category1: category1,
        category2: category2,
        category3: category3,
        lexileLevel:LexileMeasure,
        image: document.getElementById('landingImage').getAttribute('src'),
        price:'10'
    };
}






function generateNextASINs(startASIN, count) {
    const order = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    function incrementChar(c) {
        const index = order.indexOf(c);
        return index === order.length - 1 ? '0' : order[index + 1];
    }

    function incrementASIN(asin) {
        let asinArray = asin.split('');
        for (let i = asinArray.length - 1; i >= 0; i--) {
            if (asinArray[i] !== 'Z') {
                asinArray[i] = incrementChar(asinArray[i]);
                break;
            } else {
                asinArray[i] = '0'; 
                if (i === 0) {
                    asinArray.unshift('A');
                }
            }
        }
        return asinArray.join('');
    }

    let nextASINs = [startASIN];
    for (let i = 0; i < count; i++) {
        nextASINs.push(incrementASIN(nextASINs[nextASINs.length - 1]));
    }
    return nextASINs.slice(1); 
}




chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fetchDetails") {
        isStopped = false; 
        const startASIN = request.asinList[0];
        const count = 10000000; 
        const nextASINs = generateNextASINs(startASIN, count);
        console.log(nextASINs);
        processingQueue = nextASINs;
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




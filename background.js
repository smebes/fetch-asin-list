
let isStopped = false;
let asinList = [];
let currentProcessingTabs = {};
let maxConcurrentTabs = 25;
let repeatCount = 0; 
const repeatLimit = 10; 
let lastASIN = 'B09GZJPZ6D';
let openTabIds = []; 
let tabStates = {}; 


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "stop") {
        isStopped = true;
        openTabIds.forEach(tabId => {
            chrome.tabs.remove(tabId);
        });
        openTabIds = [];
    } else if (request.action === "fetchDetails" && !isStopped) {
        repeatCount = 0;
        asinList = generateNextASINs(lastASIN, maxConcurrentTabs);
        openInitialTabs();
        setTimeout(() => { 
            updateTabsWithASINs();
        }, 1000); 
    }
});


function openInitialTabs() {
    if (openTabIds.length < maxConcurrentTabs) {
        for (let i = 0; i < maxConcurrentTabs; i++) {
            chrome.tabs.create({ url: 'about:blank' }, function(tab) {
                openTabIds.push(tab.id);
                tabStates[tab.id] = 'readyForNext'; 
            });
        }
    }
}

function updateTabsWithASINs() {

    if (asinList.length === 0 && repeatCount < repeatLimit) {
        lastASIN = generateNextASINs(lastASIN, maxConcurrentTabs)[maxConcurrentTabs-1];
        asinList = generateNextASINs(lastASIN, maxConcurrentTabs);
        repeatCount++;
    }

    if (asinList.length > 0) {
        let updatesCount = 0;
        openTabIds.forEach((tabId, index) => {
            
            if (asinList.length > 0 ) {
                let asin = asinList.shift();
                chrome.tabs.update(tabId, { url: `https://www.amazon.com/dp/${asin}` }, () => {
                    updatesCount++;
                    tabStates[tabId] = 'loading';
                    if (updatesCount === maxConcurrentTabs || index === openTabIds.length - 1) {
                        if (asinList.length > 0 || repeatCount < repeatLimit) {
                            setTimeout(updateTabsWithASINs, 3000);
                        } else {
                            console.log("Tüm işlemler tamamlandı.");
                        }
                    }
                });
            }
        });
    } else {
        console.log("İşlem limitine ulaşıldı veya daha fazla ASIN yok.");
    }
}


function initializeProcessing() {
    if (repeatCount >= repeatLimit) {
        console.log("İşlem limitine ulaşıldı.");
        return; 
    }
    if (asinList.length === 0) {
        lastASIN = generateNextASINs(lastASIN, maxConcurrentTabs)[maxConcurrentTabs-1]; 
        asinList = generateNextASINs(lastASIN, maxConcurrentTabs);
        repeatCount++;
        updateTabsWithASINs(); 
    }
    while (Object.keys(currentProcessingTabs).length < maxConcurrentTabs && asinList.length > 0) {
        processNextItem();
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabStates[tabId] === 'loading') {
        tabStates[tabId] === 'waiting'
        chrome.scripting.executeScript({
            target: {tabId: tabId},
            function: postDatabase
        }, (injectionResults) => {
            if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                const productData = injectionResults[0].result ;
                fetch('http://127.0.0.1:8080/add-product', {
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
                const asinMatch = tab.url.match(/\/dp\/([A-Z0-9]{10})/);  
                if (asinMatch && asinMatch.length > 1) {
                    const asin = asinMatch[1];
                    console.log('Bulunan ASIN:', asin);
                    fetch('http://127.0.0.1:8080/add-product', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ asin: asin })
                    })
                    .then(response => response.json())
                    .then(data => console.log('Ürün başarıyla eklendi:', data))
                    .catch(error => console.error('Hata:', error));
                }      
            }
        });
        tabStates[tabId] = 'readyForNext';
    }
});



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
    let GradeLevel = ''
    let Author = ''
    let Description = ''
    let pageNumber = 0
    let customerRating = '';
    let numberOfReviews = 0;
    let rankText = '';
    let rankNumber = '';

    listItems.forEach(item => {
        if (item.textContent.includes('Publisher')) {
            publisherInfo = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
            if (publisherInfo.includes(';')) {
                const parts = publisherInfo.split(';');
                publisherName = parts[0].trim()?parts[0].trim():'';
                newData = parts[1].trim();
                let publisher = newData.split('(');
                edition = publisher ? publisher[0] : ''; 
                publishDate = publisher ? publisher[1] .replace(")", ''): "";
            } else {
                let publisher = publisherInfo.split('(');
                publisherName = publisher ? publisher[0] : "";
                publishDate = publisher ? publisher[1] .replace(")", ''): "";
            }

            

        } else if (item.textContent.includes('ASIN')) {
            asin = item.textContent.split(':')[1].trim().replace(/\s/g, '');
        } else if (item.textContent.includes('ISBN-13')) {
            ISBN13 = item.textContent.split(':')[1].trim().replace(/\s/g, '');
        } else if (item.textContent.includes('ISBN-10')) {
            ISBN10 = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        } else if (item.textContent.includes('Language')) {
            language = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        } else if (item.textContent.includes('Item Weight')) {
            Weight = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        } else if (item.textContent.includes('Dimensions')) {
            Dimensions = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        } else if (item.textContent.includes('Paperback')) {
            pageNumber = item.textContent.split(':')[1].trim().replace(" pages", '').replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        } else if (item.textContent.includes('Hardcover')) {
            pageNumber = item.textContent.split(':')[1].trim().replace(" pages", ' ').replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        } else if (item.textContent.includes('Lexile measure')) {
            LexileMeasure = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        } else if (item.textContent.includes('Grade level')) {
            GradeLevel = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        } 
    });

    const rankMatch = rankText.match(/#(\d+,\d+|\d+) in Books/);
    rankNumber = rankMatch ? rankMatch[1].replace(',', '') : '';
    
    const ratingElement = document.querySelector('#averageCustomerReviews .a-icon-alt');
    if (ratingElement) {
        customerRating = ratingElement.textContent.trim().split(' ')[0]; 
    }

    const reviewsElement = document.getElementById('acrCustomerReviewText');
    if (reviewsElement) {
        numberOfReviews = reviewsElement.textContent.trim().split(' ')[0].replace(',', ''); 
    }

    var bylineInfo = document.getElementById('bylineInfo');
    if (bylineInfo) {
      var authorLink = bylineInfo.querySelector('a');
      if (authorLink) {
        Author = authorLink.textContent.trim(); 
      }
    }

    var expanderContent = document.querySelector('[data-a-expander-name="book_description_expander"] .a-expander-content');
    if (expanderContent) {
        Description = expanderContent.textContent.trim().replace(/^\W+|\W+$/g, '');
    }

    var category = document.querySelector('#nav-subnav a').textContent.trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');

    return {
        asin: asin,
        title: `${document.getElementById('productTitle') ? document.getElementById('productTitle').textContent.trim() : ""}`,
        author: Author,
        publisher: publisherName,
        isbn10: ISBN10,
        isbn13: ISBN13,
        description: Description,
        binding: `${document.getElementById('productSubtitle') ? document.getElementById('productSubtitle').textContent.trim().replace('%20%20', '').split('–')[0] : ""}`,
        edition: edition,
        numberOfPages: pageNumber,
        dimensions: Dimensions,
        weight: Weight,
        publishDate: publishDate,
        language: language,
        customerRating:customerRating,
        numberOfReviews:numberOfReviews,
        rankNumber: rankNumber,
        category1: category,
        lexileLevel:LexileMeasure,
        image: document.getElementById('landingImage').getAttribute('src'),
    };
}




function getASINFromUrl(url) {
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
    return asinMatch ? asinMatch[1] : null;
}
  




function getProductDetailsForDownload() {
    let details = `Title: ${document.getElementById('productTitle') ? document.getElementById('productTitle').textContent.trim() : "Title not found"}\n`;

    document.querySelectorAll('#detailBullets_feature_div .a-list-item, #productOverview_feature_div .a-list-item').forEach(item => {
        const textContent = item.textContent.trim();
        if (textContent) {
            details += `${textContent.replace(/\s+/g, ' ')}\n`; 
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
  
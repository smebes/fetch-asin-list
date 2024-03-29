
let isStopped = false;
let asinList = [];
let currentProcessingTabs = {};
let maxConcurrentTabs = 10;
let repeatCount = 0; 
const repeatLimit = 3; 
let lastASIN = '';
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
        processingQueue = [...request.asinList];
        lastASIN = request.asinList[0];
        fetchIsbnListAndContinue();
        
    }
});

function fetchIsbnListAndContinue() {
    if (repeatCount < repeatLimit) {
        lastASIN = generateNextASINs(lastASIN, maxConcurrentTabs)[maxConcurrentTabs-1];
        asinList = generateNextASINs(lastASIN, maxConcurrentTabs);
        if (repeatCount === 0) { 
            openInitialTabs();
        } else {
            updateTabsWithASINs(); 
        }
        repeatCount++; 
          
    }
}

function openInitialTabs() {
    for (let i = 0; i < maxConcurrentTabs; i++) {
        chrome.tabs.create({ url: 'about:blank' }, function(tab) {
            openTabIds.push(tab.id);
            currentProcessingTabs[tab.id] = { status: 'readyForNext' };
            if (openTabIds.length === maxConcurrentTabs) {
                updateTabsWithASINs();
            }
        });
    }
}


function updateTabsWithASINs() {
    openTabIds.forEach((tabId, index) => {
        if (asinList.length > index) {
            let asin = asinList[index];
            let amazonUrl = `https://www.amazon.com/dp/${asin}`;
            chrome.tabs.update(tabId, { url: amazonUrl }, () => {
                currentProcessingTabs[tabId].status = 'loading';
            });
        }
    });
}


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && currentProcessingTabs[tabId] && currentProcessingTabs[tabId].status === 'loading') {
        currentProcessingTabs[tabId].status = 'readyForNext';
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
                        body: JSON.stringify({ asin: `${asin}` })
                    })
                    .then(response => response.json())
                    .then(data => console.log('Ürün başarıyla eklendi:', data))
                    .catch(error => console.error('Hata:', error));
                }      
            }
        });    
        let allTabsReady = openTabIds.every(id => currentProcessingTabs[id].status === 'readyForNext');
        if (allTabsReady) {
            if (repeatCount < repeatLimit) {
                fetchIsbnListAndContinue();
            } else {
                closeAllTabs();
            }
        }
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

function closeAllTabs() {
    openTabIds.forEach(tabId => {
        chrome.tabs.remove(tabId);
    });
    openTabIds = []; 
}


function postDatabase() {
    const listItems = document.querySelectorAll('#detailBullets_feature_div .a-list-item');
    let publisherInfo = '';
    let publisherName = '';
    let publishDate = '';
    let asin = '1'
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
    let categoryTree = '--';
    let categories = [];
    let category1, category2, category3;

    listItems.forEach(item => {
        if (item.textContent.includes('Publisher')) {
            publisherInfo = item.textContent.split(':')[1].trim();
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

    // var category = document.querySelector('#nav-subnav a').textContent.trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');

    const categoryLinks = document.querySelectorAll("#wayfinding-breadcrumbs_feature_div .a-link-normal.a-color-tertiary");
    categoryTree = Array.from(categoryLinks).map(link => link.textContent.trim()).join(" - ");


    categoryLinks.forEach(link => {
        categories.push(link.textContent.trim());
    });
    if (categories.length > 0) category1 = categories[0];
    if (categories.length > 1) category2 = categories[1];
    if (categories.length > 2) category3 = categories[2];


    const url = window.location.href;
    const match = url.match(/\/dp\/([A-Z0-9]{10})/);
    
    if (match && match[1]) {
        asin = match[1];
    }

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
        category1: category1,
        category2: category2,
        category3: category3,
        categoryTree: categoryTree,
        lexileLevel:LexileMeasure,
        image: document.getElementById('landingImage').getAttribute('src'),
    };
}

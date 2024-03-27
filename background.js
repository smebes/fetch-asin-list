let isStopped = false;
let asinList = [];
let currentProcessingTabs = {};
let maxConcurrentTabs = 25;
let repeatCount = 0;
const repeatLimit = 4; 
let openTabIds = [];
let tabStates = {};
const flaskAppUrl = 'http://127.0.0.1:8080';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "stop") {
        isStopped = true;
        openTabIds.forEach(tabId => chrome.tabs.remove(tabId));
        openTabIds = [];
    } else if (request.action === "fetchDetails" && !isStopped) {
        repeatCount = 0; 
        fetchIsbnListAndContinue();
    }
});

function fetchIsbnListAndContinue() {
    if (repeatCount < repeatLimit) {
        fetch(`${flaskAppUrl}/get-isbn10-list?start=${repeatCount * maxConcurrentTabs}`)
            .then(response => response.json())
            .then(data => {
                asinList = data; 
                if (repeatCount === 0) { 
                    openInitialTabs();
                } else {
                    updateTabsWithIsbn();
                }
                repeatCount++; 
            })
            .catch(error => console.error('Error fetching ISBN list:', error));
    }
}

function openInitialTabs() {
    for (let i = 0; i < maxConcurrentTabs; i++) {
        chrome.tabs.create({ url: 'about:blank' }, function(tab) {
            openTabIds.push(tab.id);
            currentProcessingTabs[tab.id] = { status: 'readyForNext' };
            if (openTabIds.length === maxConcurrentTabs) {
                updateTabsWithIsbn();
            }
        });
    }
}

function updateTabsWithIsbn() {
    openTabIds.forEach((tabId, index) => {
        if (asinList.length > index) {
            let isbn = asinList[index];
            let amazonUrl = `https://www.amazon.de/dp/${isbn}`;
            chrome.tabs.update(tabId, { url: amazonUrl }, () => {
                currentProcessingTabs[tabId].status = 'loading';
            });
        }
    });

    // Tüm sekmeler güncellendikten sonra bir sonraki liste için fetchIsbnListAndContinue çağrısı yapılmalı.
    // Bu işlem, onUpdated dinleyicisi içinde bir sekme güncellendiğinde ve 'readyForNext' durumuna geçtiğinde tetiklenir.
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
                fetch('http://127.0.0.1:8080/update-product', {
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
                    fetch('http://127.0.0.1:8080/update-product', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ category: '1' })
                    })
                    .then(response => response.json())
                    .then(data => console.log('Ürün başarıyla eklendi:', data))
                    .catch(error => console.error('Hata:', error));
                }      
            }
        });    
        let allTabsReady = openTabIds.every(id => currentProcessingTabs[id].status === 'readyForNext');
        if (allTabsReady && repeatCount < repeatLimit) {
            fetchIsbnListAndContinue();
        }
    }
});


// function postDatabase() {
//   return {isbn10: "0007425724", title: "Test Kitabı123123", author: "Yazar123123123"};
// }

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
    let rankNumber = 0;

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

            

        // } else if (item.textContent.includes('ASIN')) {
        //     asin = item.textContent.split(':')[1].trim().replace(/\s/g, '');
        } else if (item.textContent.includes('ISBN-13')) {
            ISBN13 = item.textContent.split(':')[1].trim().replace(/\s/g, '').replace(/^\W+|\W+$/g, '').replace('-','');
        } else if (item.textContent.includes('ISBN-10')) {
            ISBN10 = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
        // } else if (item.textContent.includes('Language')) {
        //     language = item.textContent.split(':')[1].trim().replace(/\s\s+/g, ' ').replace(/^\W+|\W+$/g, '');
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

    const rankListItem = Array.from(document.querySelectorAll('#detailBullets_feature_div .a-list-item'))
                              .find(item => item.textContent.includes('Best Sellers Rank'));

    if (rankListItem) {
        const rankText = rankListItem.innerText || rankListItem.textContent;
        const rankMatch = rankText.match(/Best Sellers Rank:.*?(\d+,\d+|\d+)/i);

        if (rankMatch && rankMatch.length > 1) {
            rankNumber = rankMatch[1].replace(',', ''); 
            console.log('Best Sellers Rank:', rankNumber);
        }
    }


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

    // const url = window.location.href;
    // const match = url.match(/\/dp\/([0-9X]{10})/);
    
    // if (match && match[1]) {
    //     ISBN10 = match[1];
    // }


    return {
        category: ISBN13,
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
        lexileLevel:LexileMeasure,
        image: document.getElementById('landingImage').getAttribute('src'),
    };
}




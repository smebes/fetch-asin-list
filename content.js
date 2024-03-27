const productTitle = document.getElementById('productTitle').textContent.trim();
chrome.runtime.sendMessage({headerTitle: productTitle});


const url = window.location.href;
const match = url.match(/\/dp\/([0-9X]{10})/);

if (match && match[1]) {
    console.log("ISBN10:", match[1]);
    // Burada ISBN10'u kullanarak istediğiniz işlemi yapabilirsiniz.
    // Örneğin, bu bilgiyi arka plan betiğine göndermek.
    chrome.runtime.sendMessage({isbn10: match[1]});
}


// B00000I0IO
// B00001IVC0
// B00004THMC
// B00004U473
// B00005R08V
// B00005R09J
// B00005TNWM
// B00005TNX4
// B00005U8UT
// B00005U8VJ
// B00005U8VK
// B00005U8WJ
// B00005VA5Y
// B00005VBJ7
// B00005VBO9
// B00005VBQ6
// B00005VD2B
// B00005VD3I
// B00005VD3O
// B00005VDHN
// B00005VE1F
// B00005VEF9
// 0062060619
// 1250773628
// 1250855578
// 0316422967
// 0316444006

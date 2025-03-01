document.addEventListener("DOMContentLoaded", () => {
    let url = new URL(document.location);
    let params = url.searchParams;
    if (params.has("ht") && params.has("hs")) {
        codeInput.value = huffmanDecoding(decodeURIComponent(params.get("ht")), decodeURIComponent(params.get("hs")));
        compressCheck.checked = true;
    } else if (params.has("ln")) {
        codeInput.value = decodeURIComponent(params.get("ln"));
    }
    updateLink();
})

compressCheck.addEventListener("change", () => {
    updateLink();
})

function updateLink() {
    let linkParams = "";
    let compressionSuccess = false;
    let uncompressed = encodeURIComponent(codeInput.value);
    if (compressCheck.checked) {
        let [tree, encoded] = huffmanEncoding();
        if (tree !== false) {
            linkParams = "ht=" + tree + "&hs=" + encoded;
            compressionSuccess = true;
            compressInfo.innerText = "Compression: " + Math.floor(100 * (tree.length + encoded.length + 7) / (uncompressed.length + 3)) + "%";
        }
    }
    if (!compressionSuccess) {
        linkParams = "ln=" + uncompressed
    }
    compressInfo.hidden = !compressionSuccess;
    link.innerText = "erikhaag.github.io/Pointing/?" + linkParams + "\nMake sure to test this link first before posting!";
}
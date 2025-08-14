document.addEventListener("DOMContentLoaded", () => {
    let url = new URL(document.location);
    let params = url.searchParams;
    if (params.has("ht") && params.has("hs")) {
        codeInput.value = huffmanDecoding(params.get("ht"), params.get("hs"));
        compressCheck.checked = true;
    } else if (params.has("ln")) {
        codeInput.value = params.get("ln");
    }
    updateLink();
    //line numbers
    let i = -1; 
    lineCount = 0;
    do {
        i = codeInput.value.indexOf("\n", i + 1);
        lineCount++
    } while (i != -1)
    updateLineNumbers();
});

compressCheck.addEventListener("change", () => {
    updateLink();
});

function updateLink() {
    function fullEncode(s) {
        return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    }

    let linkParams = "";
    let compressionSuccess = false;
    let uncompressed = fullEncode(codeInput.value);
    if (compressCheck.checked) {
        let [tree, encoded] = huffmanEncoding();
        tree = fullEncode(tree);
        encoded = fullEncode(encoded);
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
    link.innerText = "https://erikhaag.github.io/Pointing/?" + linkParams + "\nMake sure to test this link first before posting!";
}
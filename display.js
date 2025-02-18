codeInput.addEventListener("input", (e) => {
    let force = parsed;
    if (force) {
        reset();
        updateButtons();
    }
    switch (force ? "forced" : e.inputType) {
        case "insertLineBreak":
            lineCount++;
            updateLineNumbers();
            break;
        case "deleteByCut":
        case "deleteContentBackward":
        case "deleteContentForward":
        case "deleteWordForward":
        case "deleteWordBackward":
        case "force":
        case "historyRedo":
        case "historyUndo":
        case "insertFromPaste":
            let newLineCount = 0n;
            let i = -1;
            do {
                i = codeInput.value.indexOf("\n", i + 1);
                newLineCount++;
            } while (i != -1)
            if (newLineCount != lineCount) {
                lineCount = newLineCount;
                updateLineNumbers();
            }
            break;
        default:
            // console.log(e.inputType);
            break;
    }
})

codeInput.addEventListener("scroll", () => {
    updateLineNumbers();
})

let resizeEvent = new MutationObserver(
    (records) => {
        for (let r of records) {
            if (r.type == "attributes") {
                if (r.attributeName == "style") {
                    let codeInputHeight = Number(getComputedStyle(codeInput).height.slice(0, -2));
                    lineNumContainer.style.height = codeInputHeight + 6.8 + "px";
                    lineBackgroundContainer.style.height = codeInputHeight + 4 + "px";
                    updateLineNumbers();
                    break;
                }
            }
        }
    }
);

resizeEvent.observe(codeInput, {attributes: true});

function bigMax(a, b) {
    return a > b ? a : b;
}

function bigMin(a, b) {
    return a < b ? a : b;
}

let prideMonthOverride = (new Date().getMonth()) == 5;

function getLineBannerColor(i) {
    if (prideMonthOverride) {
        return ["red", "orange", "yellow", "green", "blue", "purple"][(i-1n) % 6n];
    }
    return "blue";
}

function updateLineNumbers() {
    let vScroll = codeInput.scrollTop;
    //chop the units
    let lineHeight = 17;
    let codeInputHeight = Number(getComputedStyle(codeInput).height.slice(0, -2)) + 6.8;
    let codeInputWidth = Number(getComputedStyle(codeInput).width.slice(0, -2)) + 4;
    // keep an extra line above and below
    let lineOff = vScroll % lineHeight;
    let topLine = bigMax(BigInt(Math.round((vScroll - lineOff) / lineHeight)) + 1n, 1n)
    let bottomLine = bigMin(BigInt(Math.round((vScroll + codeInputHeight - lineOff) / lineHeight)) + 2n, lineCount);
    //shimmy the margin
    lineNumBox.style.marginTop = -lineOff + "px";
    lineBackgroundBox.style.marginTop = - lineOff + "px";
    //ensure the alternation fully extends horizontally
    lineBackgroundBox.style.width = codeInputWidth + "px";
    //create HTML
    let lineBackgroundHTML = "";
    let lineNumHtml = "";
    let tp = tokenPointerStack.at(-1) ?? -1n;
    let currentLine = 0n;
    if (tp != -1) {
        currentLine = tokenIndexToLineNumber(tp);
    }
    for (let i = topLine; i <= bottomLine; i++) {
        let n = String(i);
        for (let j = n.length - 3; j > 0; j -= 4) {
            // If this loop runs once in an actually script, I'll be very impressed
            n = n.substring(0, j) + "," + n.substring(j)
        }
        lineBackgroundHTML += "<div class=\"" + ((i & 1n) == 0n ? "odd" : "") + (parsed && i == currentLine ? " current" : "") + (i == lastErrorLine ? " error": "") + "\"></div>";
        lineNumHtml += "<div class=\"" + getLineBannerColor(i) + (i == lastErrorLine ? " error": "") + "\">" + n + "</div>";
    }
    lineBackgroundBox.innerHTML = lineBackgroundHTML;
    lineNumBox.innerHTML = lineNumHtml;
}

updateLineNumbers();
codeInput.addEventListener("input", (e) => {
    let force = parsed;
    if (force) {
        reset();
        parsed = false;
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

resizeEvent.observe(codeInput, { attributes: true });

function addSeparators(s) {
    for (let i = s.length - 3; i > 0; i -= 4) {
        s = s.substring(0, i) + "," + s.substring(i);
    }
    return s;
}

function bigMax(a, b) {
    return a > b ? a : b;
}

function bigMin(a, b) {
    return a < b ? a : b;
}

function displayError() {
    infoBox.innerHTML += "<span class=\"error\">Error: " + lastError + "</span>";
}

function getLineBannerColor(i) {
    if (prideMonthOverride) {
        return ["red", "orange", "yellow", "green", "blue", "purple"][(i - 1n) % 6n];
    }
    return "blue";
}

function getName(iden) {
    let d;
    [iden, d] = iden.split(",");
    if (d == "0") {
        return "@" + iden + " (Global)";
    } else if (BigInt(d) == callDepth) {
        return "@" + iden + " (Local)";
    }
    return "";
}

function getSizeClass(int) {
    if (typeof int != "bigint") {
        return "";
    }
    let digits = 0;
    do {
        digits++;
        int /= 10n;
    } while (int > 31n)
    if (digits >= 30) {
        return "longer";
    } else if (digits >= 15) {
        return "long";
    }
    return ""
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
        n = addSeparators(n);
        lineBackgroundHTML += "<div class=\"" + ((i & 1n) == 0n ? "odd" : "") + (running && i == currentLine ? " current" : "") + (i == lastErrorLine ? " error" : "") + "\"></div>";
        lineNumHtml += "<div class=\"" + getLineBannerColor(i) + (i == lastErrorLine ? " error" : "") + "\">" + n + "</div>";
    }
    lineBackgroundBox.innerHTML = lineBackgroundHTML;
    lineNumBox.innerHTML = lineNumHtml;
}

function updateMemoryDisplay() {
    let memoryHTML = "";
    for (let i = -BigInt(orphanedPointers.length); i < 0n; i++) {
        let odd = (i & 1n) == 1n;
        let v = read(i);
        memoryHTML += "<div  class=\"" + (odd ? " odd" : "") + "\">" + getName(inverseIdentifiers.get(i)) + "<br>" + i + "</div>";
        memoryHTML += "<div  class=\"" + getSizeClass(v) + (odd ? "odd" : "") + "\">" + v + "</div>";
    }
    memoryHTML += "<div>@ROZ<br>0</div><div>0</div>";
    let mainMemoryLength = BigInt(mainMemory.length);
    let previousI = 0n;
    for (let i = 1n; i <= mainMemoryLength; i++) {
        if (read(i) == undefined) {
            continue;
        }
        if (i - previousI <= 3n) {
            for (let j = previousI + 1n; j < i; j++) {
                let odd = (j & 1n) == 1n;
                memoryHTML += "<div" + (odd ? " class=\"odd\"" : "") + "><br>" + j + "</div>"
                memoryHTML += "<div" + (odd ? " class=\"odd\"" : "") + ">&lt;empty&gt;</div>";
            }
        } else {
            memoryHTML += "<div class=\"space\"><br>...</div><div class=\"space\"></div>";
        }
        let odd = (i & 1n) == 1n
        let v = read(i);
        memoryHTML += "<div class=\"" + (odd ? "odd" : "") + "\"><br>" + i + "</div>";
        memoryHTML += "<div  class=\"" + getSizeClass(v) + (odd ? " odd" : "") + "\">" + v + "</div>";
        previousI = i;
    }
    memoryContainer.innerHTML = memoryHTML;
}

function updateOutput() {
    outputP.innerText = output;
}

updateLineNumbers();
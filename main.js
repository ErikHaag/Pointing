//indexed > 0
let mainMemory = [];
//indexed < 0
let orphanedPointers = [];
//interpreter's state
let stateStack = [];
let resultStack = [];
let tokenPointerStack = [0n];
let callDepth = 0n;
//every variable, local or global 
let identifiers = new Map();
//trimmed lines split before tokenizing
let lines = [];
//The tokens this code is composed of
let tokens = [];
let tokenNames = [];
let tokenIndicesBeforeNewLine = [];
//functions!
let functions = new Map();
let output = "";

const texts = {
    errors: {
        found: {
            assign: "Unexpected \"=\"",
            break: "Unexpected \"break\"",
            closeBrac: "Unexpected \"}\"",
            closeParen: "Unexpected \")\"",
            continue: "Unexpected \"continue\"",
            else: "Unexpected \"else\"",
            elseif: "Unexpected \"elseif\"",
            empty: "Found \"empty\" in expression starting",
            emptyReturn: "Function that doesn't return found in expression starting",
            function: "Unexpected \"function\"",
            identifier: "Unexpected identifier",
            if: "Unexpected \"if\"",
            openBrac: "Unexpected \"{\"",
            openParen: "Unexpected \"(\"",
            return: "Unexpected \"return\"",
            semicolon: "Unexpected \";\"",
            token: "Unexpected token",
            while: "Unexpected \"while\""
        },
        functionInBlock: "Function in a block",
        functionInFunction: "Function in another function",
        functionWithoutName: "Unnamed function",
        incorrectPairing: " is paired with ",
        invalidToken: "Invalid token",
        linePrefix: " on line ",
        missingIdentifier: "Missing identifier",
        unpairedBrackets: "Unpaired brackets ",
        expected: {
            closeBrac: "Expected \"}\"",
            closeParen: "Expected \")\"",
            identifier: "Expected identifier",
            openBrac: "Expected \"{\"",
            openParen: "Expected \"(\""
        }
    }
};

let lastError = "";

function reset() {
    //reset the state
    mainMemory = [];
    orphanedPointers = [];
    stateStack = [];
    tokenPointerStack = [0n];
    callDepth = 0n;
    identifiers = new Map();
    functions = new Map();
    output = "";
}

//Not alphabetized due to explicit priority
const tokenRegexes = [/^\[[\S\s]*?\]/, /^\(/, /^\)/, /^\{/, /^\}/, /^function /, /^return( |(?=[,;\n]))/, /^if /, /^elseif /, /^else /, /^while /, /^continue(?=[,\n])/, /^continue(?=[,\n])/, /^[A-Za-z]+(?![A-Za-z])/, /^(0|[1-9]\d*)(?![\d])/, /^\$/, /^\+/, /^_/, /^-/, /^\*/, /^\//, /^%/, /^==/, /^=/, /^<=/, /^>=/, /^</, /^>/, /^\u00AC/, /^\u2227/, /^\u2228/, /^\u22BB/, /^~/, /^&/, /^\|/, /^\^/, /^\?/, /^;/];
const tokenName = ["comment", "openParen", "closeParen", "openBrac", "closeBrac", "function", "return", "if", "elseif", "else", "while", "continue", "break", "identifier", "integer", "follow", "add", "negate", "subtract", "multiply", "divide", "mod", "equal", "assign", "lessEqual", "greaterEqual", "less", "greater", "boolNot", "boolAnd", "boolOr", "boolXor", "bitNot", "bitAnd", "bitOr", "bitXor", "ternary", "semicolon"];

function tokenIndexToLine(tI) {
    return texts.errors.linePrefix + (tokenIndicesBeforeNewLine.findIndex((e) => e > tI) + 1);
}


function parse() {
    reset();
    lines = codeInput.value.split("\n").map((s) => s.trim());
    let input = lines.join("\n");
    tokens = [];
    tokenNames = [];
    tokenIndicesBeforeNewLine = [];
    //tokenize
    {
        let currentLine = 0;
        invalid = false;
        tokenize: while (input.length > 0) {
            if (input[0] == "\n") {
                input = input.substring(1);
                tokenIndicesBeforeNewLine.push(tokens.length);
                continue;
            }
            if (input[0] == " " || input[0] == ",") {
                input = input.substring(1);
                continue;
            }
            for (let i = 0; i < 38; i++) {
                let test = tokenRegexes[i].exec(input);
                if (test !== null) {
                    tokenNames.push(tokenName[i]);
                    tokens.push(test[0]);
                    input = input.substring(test[0].length);
                    continue tokenize;
                }
            }
            invalid = true;
            break;
        }

        if (invalid) {
            lastError = texts.errors.invalidToken + texts.errors.linePrefix + currentLine;
            return false;
        }
    }

    //function seperation
    {
        let current = 0;
        let state = 0;
        let brackets = 0n
        let parentheses = 0n
        let bracketTokenIndices = [];
        let functionName = "";
        let args = [];
        let functionI = -1;
        for (let i = 0; i < tokens.length; i++) {
            let lastBracket = parentheses > 0n ? "(" : brackets > 0n ? "{" : "";
            switch (state) {
                case 1:
                    state = 2;
                    break;
                case 2:
                    lastError = texts.errors.functionWithoutName + tokenIndexToLine(i);
                    return false;
                case 3:
                    state = 4
                    break;
                case 4:
                    lastError = texts.errors.missing.openParen + tokenIndexToLine(i);
                    return false;
                default:
                    break;
            }
            switch (tokenNames[i]) {
                case "function":
                    if (state != 0) {
                        lastError = texts.errors.functionInFunction + tokenIndexToLine(i);
                        return false;
                    }
                    if (brackets.length != 0) {
                        lastError = texts.errors.functionInBlock + tokenIndexToLine(i);
                        return false;
                    }
                    functionI = i;
                    state = 1;
                    break;
                case "identifier":
                    if (state != 0 && state != 2 && state != 5 && state != 7) {
                        lastError = texts.errors.found.identifier + tokenIndexToLine(i);
                        return false;
                    }
                    if (state == 2) {
                        functionName = tokens[i];
                        state = 3;
                    }
                    if (state == 5) {
                        args.push(tokens[i]);
                    }
                    break;
                case "openParen":
                    if (state != 0 && state != 4 && state != 7) {
                        lastError = texts.errors.found.openParen + tokenIndexToLine(i);
                        return false;
                    }
                    if (state == 4) {
                        state = 5;
                    }
                    parentheses++
                    bracketTokenIndices.push(current);
                    break;
                case "closeParen":
                    if (state != 0 && state != 5 && state != 7) {
                        lastError = texts.errors.found.closeParen + tokenIndexToLine(i);
                        return false;
                    }
                    if (lastBracket == "") {
                        lastError = texts.errors.found.closeParen + tokenIndexToLine(i);
                        return false;
                    }
                    if (lastBracket == "{") {
                        lastError = "{" + tokenIndexToLine(bracketTokenIndices.pop()) + texts.errors.incorrectPairing + ")" + tokenIndexToLine(i);
                        return false;
                    }
                    parentheses--;
                    bracketTokenIndices.pop();
                    if (state == 5) {
                        state = 6;
                    }
                    break;
                case "openBrac":
                    if (state != 0 && state != 6 && state != 7 || lastBracket == "(") {
                        lastError = texts.errors.found.openBrac + tokenIndexToLine(i);
                        return false;
                    }
                    if (state == 6) {
                        state = 7;
                    }
                    brackets++;
                    bracketTokenIndices.push(current);
                    break;
                case "closeBrac":
                    if (state != 0 && state != 7) {
                        lastError = texts.errors.found.closeBrac + tokenIndexToLine(i);
                        return false;
                    }
                    if (lastBracket == "") {
                        lastError = texts.errors.found.closeBrac + tokenIndexToLine(i);
                        return false;
                    }
                    if (lastBracket == "(") {
                        lastError = "(" + texts.errors.linePrefix + tokenLineNumber[bracketTokenIndices.pop()] + texts.errors.incorrectPairing + "}    " + tokenIndexToLine(i);
                        return false
                    }
                    brackets--;
                    if (brackets == 0) {
                        functions.set(functionName, [args, functionI, functionI + args.length + 6, i - 1]);
                        arguments = [];
                        state = 0;
                    }
                case "comment":
                    break;
                case "return":
                    if (state != 7) {
                        lastError = texts.errors.found.return;
                        return false;
                    }
                default:
                    if (state != 0 && state != 7) {
                        lastError = texts.errors.found.token + tokenIndexToLine(i);
                        return false;
                    }
                    break;

            }
        }
        if (brackets > 0n || parentheses > 0n) {
            let missing = [];
            for (; parentheses > 0n; parentheses--) {
                missing.push("(" + tokenIndexToLine(bracketTokenIndices.pop()));
            }
            for (; brackets > 0n; brackets--) {
                missing.push("{" + tokenIndexToLine(bracketTokenIndices.pop()));
            }
            lastError = texts.errors.unpairedBrackets + missing.join(", ");
            return false;
        }
    }

    //ensure if, elseif, and else are in a sensible order
    {
        let branchTokenStack = ["none"];
        for (let i = 0n; i < tokenNames.length; i++) {
            let lastBranchIndex = branchTokenStack.length - 1;
            let lastBranch = branchTokenStack[lastBranchIndex];
            switch (tokenNames[i]) {
                case "closeBrac":
                    branchTokenStack.pop();
                    break;
                case "else":
                    if (tokenNames[i + 1n] != "openBrac") {
                        lastError = texts.errors.expected.openBrac + tokenIndexToLine(tp + 1n);
                        return false;
                    }
                    if (lastBranch == "none") {
                        lastError = texts.errors.found.else + tokenIndexToLine(i);
                        return false;
                    }
                    branchTokenStack[lastBranchIndex] = "none";
                    branchTokenStack.push("none");
                    i++;
                    break;
                case "elseif":
                    if (lastBranch == "none") {
                        lastError = texts.errors.found.elseif + tokenIndexToLine(i);
                        return false;
                    }
                    if (tokenNames[tp + 1n] != "openParen") {
                        lastError = texts.errors.expected.openParen + tokenIndexToLine(tp + 1n);
                        return false;
                    }
                    {
                        let afterCondition = nextSubExpression(i + 2n);
                        if (tokenNames[afterCondition] != "closeParen") {
                            lastError = texts.errors.expected.closeParen + tokenIndexToLine(afterCondition);
                            return false;
                        }
                        if (tokenNames[afterCondition + 1n] != "openBrac") {
                            lastError = texts.errors.expected.openBrac + tokenIndexToLine(afterCondition + 1n);
                            return false;
                        }
                        i = afterCondition + 1n;
                    }
                    branchTokenStack[lastBranchIndex] = "if";
                    branchTokenStack.push("none");
                    break;
                case "if":
                    if (tokenNames[i + 1n] != "openParen") {
                        lastError = texts.errors.expected.openParen + tokenIndexToLine(tp + 1n);
                        return false;
                    }
                    {
                        let afterCondition = nextSubExpression(tp + 2n);
                        if (tokenNames[afterCondition] != "closeParen") {
                            lastError = texts.errors.expected.closeParen + tokenIndexToLine(afterCondition);
                            return false;
                        }
                        if (tokenNames[afterCondition + 1n] != "openBrac") {
                            lastError = texts.errors.expected.openBrac + tokenIndexToLine(afterCondition + 1n);
                        }
                        i = afterCondition + 1n;
                    }
                    branchTokenStack[lastBranchIndex] = "if";
                    branchTokenStack.push("none");
                    break;
                case "openBrac":
                    lastError = texts.errors.found.openBrac + tokenIndexToLine(i);
                    return false;
                case "while":
                    if (tokenNames[tp + 1n] != "openParen") {
                        lastError = texts.errors.expected.openParen + tokenIndexToLine(tp + 1n);
                        return false;
                    }
                    {
                        let afterCondition = nextSubExpression(tp + 2n);
                        if (tokenNames[afterCondition] != "closeParen") {
                            lastError = texts.errors.expected.closeParen + tokenIndexToLine(afterCondition);
                            return false;
                        }
                        if (tokenNames[afterCondition + 1n] != "openBrac") {
                            lastError = texts.errors.expected.openBrac + tokenIndexToLine(afterCondition + 1n);
                        }
                    }
                    branchTokenStack[lastBranchIndex] = "none";
                    branchTokenStack.push("none");
                    break;
                default:
                    break;
            }
        }
    }
}

function allocate(slots) {
    if (slots <= 0n) {
        //ROZ;
        return 0n;
    }
    let i = 0n;
    o: for (; i < mainMemory.length; i++) {
        for (let j = 0n; j < slots; j++) {
            if (mainMemory[i + j] != undefined) {
                i += j;
                continue o;
            }
        }
        //slightly cursed
        break;
    }
    for (let j = 0n; j < slots; j++) {
        mainMemory[i + j] = 0n;
    }
    return ++i;
}

function free(pointer, slots = 0n) {
    if (typeof pointer == "string") {
        if (!identifiers.has(pointer)) {
            lastError = texts.errors.missingIdentifier;
            return false;
        }
        //I hope this works!
        //Hey, it does!
        [pointer,] = [identifiers.get(pointer), identifiers.delete(pointer)];
    }
    let pointed = read(pointer);
    if (pointer == 0n) {
        //can't free ROZ, so skip it.
        pointed++;
        slots--;
    }
    {
        let deleted = false;
        //only delete if it makes sense to
        if (slots > 0n && pointed > 0n) {
            deleted = true;
            for (let i = 0n; i < slots; i++) {
                delete mainMemory[pointed + i - 1n];
            }
        }
        if (pointer > 0n) {
            // delete the pointer if it was in memory
            deleted = true;
            delete mainMemory[pointer - 1n];
        }
        if (deleted) {
            //clean up end of mainMemory
            mainMemory.length = mainMemory.findLastIndex((e) => e != undefined) + 1n;
        }
    }
    if (pointer < 0n) {
        orphanedPointers.splice(Number(-pointer - 1n), 1);
        for (let [k, v] of identifiers) {
            if (v < pointer) {
                identifiers.set(k, v + 1n);
            }
        }
    }
}

function read(index) {
    if (index == 0n) {
        //ROZ
        return 0n;
    }
    if (index > 0n) {
        return mainMemory?.[index - 1n] ?? "empty";
    }
    return orphanedPointers?.[-index - 1n] ?? "empty";
}

function write(index, value) {
    if (index == 0n) {
        //ROZ
        return;
    }
    if (index > 0n) {
        if (value == "empty") {
            if (index > mainMemory.length) {
                return;
            }
            if (index == mainMemory.length) {
                mainMemory.pop();
                return;
            }
            delete mainMemory[index - 1n];
            return;
        }
        mainMemory[index - 1n] = value;
        return;
    }
    if (value == "empty") {
        orphanedPointers.splice(Number(-index - 1n), 1);
        for (let [k, v] of identifiers) {
            if (v < index) {
                identifiers.set(k, v + 1n);
            }
        }
        return;
    }
    orphanedPointers[-index - 1n] = value;
}

function nextSubExpression(tp) {
    if (tp === false) {
        return false
    }
    let counter = 1;
    while (counter > 0) {
        if (tokenNames[tp] == "identifier" && tokenNames[tp + 1n] == "openParen") {
            // function
            switch (tokens[tp]) {
                case "inputInt":
                case "allocate":
                case "inputStr":
                case "outputChar":
                case "outputInt":
                    counter += 1;
                    break;
                case "free":
                    counter += 2;
                    break;
                default:
                    counter += functions.get(tokens[tp])[0].length;
                    break;
            }
            tp += 2n;
            continue;
        }
        switch (tokenNames[tp]) {
            case "assign":
                lastError = texts.errors.found.assign + tokenIndexToLine(tp);
                return false;
            case "closeBrac":
                lastError = texts.errors.found.closeBrac + tokenIndexToLine(tp);
                return false;
            case "else":
                lastError = texts.errors.found.else + tokenIndexToLine(tp);
                return false;
            case "elseif":
                lastError = texts.errors.found.elseif + tokenIndexToLine(tp);
                return false;
            case "function":
                lastError = texts.errors.found.function + tokenIndexToLine(tp);
                return false;
            case "if":
                lastError = texts.errors.found.if + tokenIndexToLine(tp);
                return false;
            case "openParen":
                lastError = texts.errors.found.openParen + tokenIndexToLine(tp);
                return false;
            case "openBrac":
                lastError = texts.errors.found.openBrac + tokenIndexToLine(tp);
                return false;
            case "return":
                lastError = texts.errors.found.return + tokenIndexToLine(tp);
                return false;
            case "semicolon":
                lastError = texts.errors.found.semicolon + tokenIndexToLine(tp);
                return false;
            case "while":
                lastError = texts.errors.found.while + tokenIndexToLine(tp);
                return false;
            case "closeParen":
            case "identifier":
            case "integer":
                counter--;
                break;
            case "bitNot":
            case "boolNot":
            case "comment":
            case "follow":
            case "negate":
                break;
            case "add":
            case "bitAnd":
            case "bitOr":
            case "bitXor":
            case "boolAnd":
            case "boolOr":
            case "boolXor":
            case "divide":
            case "equal":
            case "greater":
            case "greaterEqual":
            case "less":
            case "lessEqual":
            case "mod":
            case "multiply":
            case "subtract":
                counter++;
                break;
            case "ternary":
                counter += 2;
                break;
            default:
                lastError = texts.errors.found.token;
                return false;
        }
        tp++;
    }
    return tp;
}

function evaluateExpression() {
    //Messiest function I've ever written, I'm sorry fellow programmers.
    evalutron: while (stateStack.at(-1) != "output") {
        if (stateStack.at(-1) instanceof Array) {
            let CWTP = stateStack[stateStack.length - 1].pop();
            let lastResultIndex = resultStack.length - 1;
            if (stateStack.at(-1).length == 0) {
                stateStack.pop();
            }
            switch (tokenNames[CWTP]) {
                case "identifier":
                    switch (tokens[CWTP]) {
                        case "empty":
                            resultStack[lastResultIndex].push("empty");
                            break;
                        case "false":
                        case "ROZ":
                            resultStack[lastResultIndex].push(0n);
                            break;
                        case "true":
                            resultStack[lastResultIndex].push(-1n);
                            break;
                        default:
                            if (tokenNames[CWTP + 1n] == "openParen") {
                                let functionName = "";
                                let argCount = 0;
                                switch (tokens[CWTP]) {
                                    case "inputInt":
                                    case "allocate":
                                    case "inputStr":
                                    case "outputChar":
                                    case "outputInt":
                                        functionName = tokens[CWTP];
                                        argCount = 1;
                                        break;
                                    case "free":
                                        functionName = tokens[CWTP];
                                        argCount = 2;
                                        break;
                                    default:
                                        functionName = tokens[CWTP];
                                        if (!functions.has(functionName)) {
                                            lastError = texts.errors.missingFunction + tokenIndexToLine(CWTP);
                                            return false;
                                        }
                                        argCount = functions.get(functionName)[0].length;
                                        break;
                                }
                                stateStack.push({ type: "function", name: functionName });
                                if (argCount > 0) {
                                    let eI = [CWTP + 2n];
                                    for (let i = 0; i < argCount - 1; i++) {
                                        let n = nextSubExpression(eI[0]);
                                        if (n === false) {
                                            return false;
                                        }
                                        eI.unshift(n);
                                    }
                                    stateStack.push(eI);
                                }
                                resultStack.push([]);
                                break;
                            }
                            if (identifiers.has(tokens[CWTP] + "," + callDepth)) {
                                //local variable
                                resultStack[lastResultIndex].push(identifiers.get(tokens[CWTP] + "," + callDepth));
                                break;
                            } else if (identifiers.has(tokens[CWTP] + ",0")) {
                                //global variable
                                resultStack[lastResultIndex].push(identifiers.get(tokens[CWTP] + ",0"));
                                break;
                            }
                            lastError = texts.errors.missingIdentifier + tokenIndexToLine(CWTP);
                            return false;
                    }
                    if (stateStack[stateStack.length - 1].length == 0) {
                        stateStack.pop();
                    }
                    break;
                case "integer":
                    resultStack[lastResultIndex].push(BigInt(tokens[CWTP]));
                    break;
                case "bitNot":
                case "boolNot":
                case "follow":
                case "negate":
                    stateStack.push({ type: tokenNames[CWTP] }, [CWTP + 1n]);
                    resultStack.push([]);
                    break;
                case "bitAnd":
                case "bitOr":
                    {
                        let n = nextSubExpression(CWTP + 1n);
                        if (n === false) {
                            return false;
                        }
                        stateStack.push([n], { type: tokenNames[CWTP] }, [CWTP + 1n]);
                        resultStack.push([]);
                    }
                    break;
                case "boolAnd":
                case "boolOr":
                    {
                        let n = nextSubExpression(CWTP + 1n);
                        if (n === false) {
                            return false;
                        }
                        stateStack.push({ type: "bool" }, [n], { type: tokenNames[CWTP] }, [CWTP + 1n]);
                        resultStack.push([], []);
                    }
                    break;
                case "add":
                case "boolXor":
                case "bitXor":
                case "divide":
                case "equal":
                case "greater":
                case "greaterEqual":
                case "less":
                case "lessEqual":
                case "mod":
                case "multiply":
                case "subtract":
                    {
                        let n = nextSubExpression(CWTP + 1n);
                        if (n === false) {
                            return false;
                        }
                        stateStack.push({ type: tokenNames[CWTP] }, [n, CWTP + 1n]);
                        resultStack.push([]);
                    }
                    break;
                case "ternary":
                    {
                        let eI = [nextSubExpression(CWTP + 1n)];
                        eI.unshift(nextSubExpression(eI[0]));
                        if (eI[0] === false) {
                            return false;
                        }
                        stateStack.push(eI, { type: tokenNames[CWTP] }, [CWTP + 1n]);
                    }
                    resultStack.push([]);
                    break;
                default:
                    lastError = texts.errors.found.token;
                    return false;
            }
            continue;
        }
        let op = stateStack.pop();
        let arg = resultStack.pop();
        let lastResultIndex = resultStack.length - 1;
        if (arg.includes("none")) {
            lastError = texts.errors.found.emptyReturn + tokenIndexToLine(tp);
            return false;
        }
        if (op.type != "function" && op.type != "equal" && op.type[0] != "b" && arg.includes("empty")) {
            lastError = texts.errors.found.empty + tokenIndexToLine(tp);
            return false;
        }
        switch (op.type) {
            case "add":
                resultStack[lastResultIndex].push(arg[0] + arg[1]);
                break;
            case "bitNot":
                resultStack[lastResultIndex].push(arg[0] == "empty" ? -1n : ~arg[0]);
                break;
            case "bitAnd":
                if (arg.length == 1) {
                    if (arg[0] == 0n || arg[0] == "empty") {
                        //short-circuit
                        stateStack.pop();
                        resultStack[lastResultIndex].push(0n);
                        break;
                    }
                    resultStack.push([arg[0]]);
                    stateStack.splice(-1, 0, { type: "bitAnd" });
                    break;
                }
                resultStack[lastResultIndex].push(arg[0] & (arg[1] == "empty" ? 0n : arg[1]));
                break;
            case "bitOr":
                if (arg.length == 1) {
                    if (arg[0] != 0n && arg[0] != "empty") {
                        //short-circuit
                        stateStack.pop();
                        resultStack[lastResultIndex].push(-1n);
                        break;
                    }
                    resultStack.push([arg[0]]);
                    stateStack.splice(-1, 0, { type: "bitOr" });
                    break;
                }
                resultStack[lastResultIndex].push(arg[0] | (arg[1] == "empty" ? 0n : arg[1]));
                break;
            case "bitXor":
                resultStack[lastResultIndex].push((arg[0] == "empty" ? 0n : arg[0]) ^ (arg[1] == "empty" ? 0n : arg[1]))
                break;
            case "bool":
                resultStack[lastResultIndex].push((arg[0] == 0n || arg[0] == "empty") ? 0n : -1n);
                break;
            case "boolNot":
                resultStack[lastResultIndex].push((arg[0] == 0n || arg[0] == "empty") ? -1n : 0n);
                break;
            case "boolAnd":
                if (arg[0] == 0n || arg[0] == "empty") {
                    //short-circuit
                    stateStack.pop();
                    stateStack.pop();
                    resultStack.pop();
                    resultStack[lastResultIndex - 1].push(0n);
                }
                break;
            case "boolOr":
                if (arg[0] != 0n && arg[0] != "empty") {
                    //short-circuit
                    stateStack.pop();
                    stateStack.pop();
                    resultStack.pop();
                    resultStack[lastResultIndex - 1].push(-1n);
                }
                break;
            case "boolXor":
                resultStack[lastResultIndex].push((arg[0] == 0n || arg[0] == "empty") == (arg[0] == 0n || arg[0] == "empty") ? 0n : -1n);
                break;
            case "divide":
                resultStack[lastResultIndex].push(arg[0] / arg[1]);
                break;
            case "equal":
                resultStack[lastResultIndex].push(arg[0] == arg[1] ? -1n : 0n);
                break;
            case "follow":
                resultStack[lastResultIndex].push(read(arg[0]));
                break;
            case "function":
                switch (op.name) {
                    case "allocate":
                        if (arg[0] == "empty") {
                            lastError = texts.errors.found.empty + tokenIndexToLine(tp);
                            return false;
                        }
                        resultStack[lastResultIndex].push(allocate(arg[0]));
                        continue evalutron;
                    case "free":
                        if (arg[0] == "empty" || arg[1] == "empty") {
                            lastError = texts.errors.found.empty + tokenIndexToLine(tp);
                            return false;
                        }
                        free(arg[0], arg[1]);
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    case "inputInt":
                        {
                            if (arg[0] == "empty") {
                                lastError = texts.errors.found.empty + tokenIndexToLine(tp);
                                return false;
                            }
                            let inp = prompt(texts.integer);
                            if (/^-?(?:0|[1-9]\d*)$/.test(inp)) {
                                write(arg[0], BigInt(inp));
                            } else {
                                write(arg[0], "empty");
                            }
                        }
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    case "inputStr":
                        {
                            if (arg[0] == "empty") {
                                lastError = texts.errors.found.empty + tokenIndexToLine(tp);
                                return false;
                            }
                            let inp = prompt(texts.string) + "\n";
                            let p = allocate(inp.length);
                            write(arg[0], p);
                            for (let i = 0; i < inp.length; i++) {
                                write(p + i, inp.charCodeAt(i));
                            }
                        }
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    case "outputInt":
                        if (arg[0] == "empty") {
                            lastError = texts.errors.found.empty + tokenIndexToLine(tp);
                            return false;
                        }
                        output += arg[0].toString();
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    case "outputChar":
                        if (arg[0] == "empty") {
                            lastError = texts.errors.found.empty + tokenIndexToLine(tp);
                            return false;
                        }
                        output += String.fromCharCode(arg[0] & 65535n);
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    default:
                        let f = functions.get(op.name);
                        tokenPointerStack.push(f[2]);
                        stateStack.push("functionCall")
                        callDepth++
                        for (let i = 0; i < f[0].length; i++) {
                            let p = allocate(1);
                            identifiers.set(f[0][i] + "," + callDepth, p);
                            write(p, arg[i]);
                        }
                        break;
                }
                return "functionCall";
            case "greater":
                resultStack[lastResultIndex].push(arg[0] > arg[1] ? -1n : 0n);
                break;
            case "greaterEqual":
                resultStack[lastResultIndex].push(arg[0] >= arg[1] ? -1n : 0n);
                break;
            case "less":
                resultStack[lastResultIndex].push(arg[0] < arg[1] ? -1n : 0n);
                break;
            case "lessEqual":
                resultStack[lastResultIndex].push(arg[0] <= arg[1] ? -1n : 0n);
                break;
            case "mod":
                resultStack[lastResultIndex].push(arg[0] % arg[1]);
                break;
            case "multiply":
                resultStack[lastResultIndex].push(arg[0] * arg[1]);
                break;
            case "negate":
                resultStack[lastResultIndex].push(-arg[0]);
                break;
            case "return":
                resultStack[lastResultIndex].push(arg[0]);
                //remove local variables
                for (let k of identifiers.keys()) {
                    if (k.endsWith("," + callDepth)) {
                        free(k, 0);
                    }
                }
                callDepth--;
                break;
            case "subtract":
                resultStack[lastResultIndex].push(arg[0] - arg[1]);
                break;
            case "ternary":
                if (arg[0] == 0n) {
                    stateStack[stateStack.length - 1].pop();
                    break;
                }
                stateStack[stateStack.length - 1].shift();
                break;
        }
    }
    stateStack.pop()
    return resultStack.pop()[0];
}

function afterBlock(tp) {
    let depth = 1n;
    if (tokenNames[tp] != "openBrac") {
        throw "Invalid start token!";
    }
    tp++;
    while (depth > 0n) {
        //any mismatched brackets and parentheses would've been caught by parse()
        switch (tokenNames[tp]) {
            case "openBrac":
                depth++;
                break;
            case "closeBrac":
                depth--;
                break;
            default:
                break;
        }
        tp++;
    }
    return tp;
}

function doInstruction() {
    //jump over function definitions
    while (tokenNames[tokenPointerStack[tokenPointerStack.length - 1]] == "function") {
        tokenPointerStack[tokenPointerStack.length - 1] = functions.get(tokens[tokenPointerStack.at(-1) + 1n])[3] + 2n;
    }
    let lastTokenPointerIndex = tokenPointerStack.length - 1;
    let tp = tokenPointerStack.at(lastTokenPointerIndex);
    //Well, that's certainly a comparisonee(?)
    switch (stateStack.at(-1) instanceof Array ? "continueEvaluation" : stateStack.at(-1)?.instruction ?? "") {
        case "block":
            if (tokenNames[tp] == "closeBrac") {
                //leave block
                stateStack.pop();
                tp++;
                return "again!";
            }
            //fall through
        case "fall":
        case "functionCall":
        case "":
            switch (tokenNames[tp]) {
                case "break":
                    while (stateStack.at(-1)?.instruction != "while") {
                        if (stateStack.pop() ?? "function" == "function") {
                            lastError = texts.errors.breakOutsideLoop + tokenIndexToLine(tp);
                            return false;
                        }
                    }
                    tokenPointerStack[lastTokenPointerIndex] = stateStack.pop().after;
                    break;
                case "continue":
                    while (stateStack.at(-1)?.instruction != "while") {
                        if (stateStack.pop() ?? "function" == "function") {
                            lastError = texts.errors.continueOutsideLoop + tokenIndexToLine(tp);
                            return false;
                        }
                    }
                    tokenPointerStack[lastTokenPointerIndex] = stateStack.pop().condition - 2n;
                    break;
                case "else":
                    {
                        let afterBlock = afterBlock(tp + 1n);
                        if (stateStack.pop().instruction == "fall") {
                            tokenPointerStack[lastTokenPointerIndex] = afterBlock;
                            break;
                        }
                        tokenPointerStack[lastTokenPointerIndex] = tp + 2n;
                        stateStack.push({instruction: "block"});
                    }
                    break;
                case "elseif":
                    {
                        let afterCondition = nextSubExpression(tp + 2n);
                        let afterBlock = afterBlock(afterCondition + 1n);
                        if (stateStack.at(-1).instruction == "fall") {
                            tokenPointerStack[lastTokenPointerIndex] = afterBlock
                            if (tokenNames[afterBlock] != "elseif" && tokenNames[afterBlock] != "else") {
                                stateStack.pop();
                            }
                            break;
                        }
                        stateStack.splice(-1, 1, { instruction: "if", start: afterCondition + 2n, after: afterBlock }, "output", [tp + 2n]);
                        resultStack.push([]);
                    }
                    break;
                case "if":
                    {
                        let afterCondition = nextSubExpression(tp + 2n);
                        stateStack.push({ instruction: "if", start: afterCondition + 2n, after: afterBlock(afterCondition + 1n) }, "output", [tp + 2n]);
                        resultStack.push([]);
                    }
                    break;
                case "return":
                    if (callDepth == 0n) {
                        lastError = texts.errors.returnOutsideFunction + tokenIndexToLine(tp);
                        return false;
                    }
                    while (stateStack.pop() != "functionCall") { }
                    if (tokenNames[tp + 1n] == "semicolon") {
                        resultStack[resultStack.length - 1].push("none");
                        //remove local variables
                        for (let k of identifiers.keys()) {
                            if (k.endsWith("," + callDepth)) {
                                free(k, 0);
                            }
                        }
                        callDepth--;
                        break;
                    }
                    stateStack.push({ type: "return" }, [tp + 1n]);
                    break;
                case "while":
                    {
                        let afterCondition = nextSubExpression(tp + 2n);
                        stateStack.push({ instruction: "while", loc: tp, start: afterCondition + 2n, after: afterBlock(afterCondition + 1n) }, "output", [tp + 2n]);
                        resultStack.push([]);
                    }
                    break;
                case "identifier":
                    if (tokenNames[tp + 1n] == "assign" && !identifiers.has(tokens[tp] + ",0") && !identifiers.has(tokens[tp] + "," + callDepth)) {
                        identifiers.set(tokens[tp] + "," + callDepth, -BigInt(orphanedPointers.push(allocate(0))));
                    }
                //fall through
                default:
                    {
                        let nse = nextSubExpression(tp);
                        if (tokenNames[nse] == "assign") {
                            stateStack.push({ instruction: "assign", loc: tp, val: nse + 1n, locEvaled: false }, "output", [tp]);
                            resultStack.push([]);
                            break;
                        }
                        stateStack.push({ instruction: "evaluate", after: nse }, "output", [tp]);
                        resultStack.push([]);
                    }
                    break;
            }
            if (tokenNames[tp] == "break" || tokenNames[tp] == "continue") {
                return true;
            }
        //fall through
        case "continueEvaluation":
        default:
            let evaluation = evaluateExpression();
            if (evaluation === false) {
                return false;
            }
            if (evaluation == "functionCall") {
                return true;
            }
            instr = stateStack.at(-1);
            switch (instr.instruction) {
                case "assign":
                    if (instr.locEvaled) {
                        write(instr.loc, evaluation)
                        let afterAssign = nextSubExpression(instr.val);
                        if (afterAssign === false) {
                            return false;
                        }
                        tokenPointerStack[lastTokenPointerIndex] = afterAssign;
                        stateStack.pop();
                        break;
                    }
                    stateStack[stateStack.length - 1].loc = evaluation;
                    stateStack[stateStack.length - 1].locEvaled = true;
                    stateStack.push("output", [instr.val]);
                    resultStack.push([]);
                    return "again!";
                case "elseif":
                case "if":
                    if (evaluation != 0n && evaluation != "empty") {
                        tokenPointerStack[lastTokenPointerIndex] = instr.start;
                        let nextTokenAfterBlock = tokenNames[instr.blockEnd];
                        if (nextTokenAfterBlock == "elseif" || nextTokenAfterBlock == "else") {
                            stateStack.splice(-1, 1, { instruction: "fall" });
                        }
                        break;
                    }
                    tokenPointerStack[lastTokenPointerIndex] = instr.after;
                    break;
                case "evaluate":
                    tokenPointerStack[lastTokenPointerIndex] = stateStack.pop().after;
                    break;
                case "while":
                    if (evaluation != 0n && evaluation != "empty") {
                        tokenPointerStack[lastTokenPointerIndex] = instr.start;
                        break;
                    }
                    tokenPointerStack[lastTokenPointerIndex] = instr.after;
                    break;
            }
    }
    return true;
}
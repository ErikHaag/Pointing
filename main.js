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
let inverseIdentifiers = new Map();
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
            breakOutsideLoop: "Found \"break\' outside a loop",
            closeBrac: "Unexpected \"}\"",
            closeParen: "Unexpected \")\"",
            continue: "Unexpected \"continue\"",
            continueOutsideLoop: "Found \"continue\' outside a loop",
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
        missingFunction: "Missing function",
        missingIdentifier: "Missing identifier",
        unpairedBrackets: "Unpaired brackets ",
        expected: {
            closeBrac: "Expected \"}\"",
            closeParen: "Expected \")\"",
            identifier: "Expected identifier",
            openBrac: "Expected \"{\"",
            openParen: "Expected \"(\""
        }
    },
    integer: "Enter an integer:",
    string: "Enter a string:"
};

let lastError = "";
let lastErrorLine = 0n;

//Not alphabetized due to explicit priority
const tokenRegexes = [/^\[[^\n]*?\]/, /^\(/, /^\)/, /^\{/, /^\}/, /^function /, /^return( |(?=[,;]))/, /^if /, /^elseif /, /^else /, /^while /, /^continue(?=[,\n])/, /^break(?=[,\n])/, /^[A-Za-z]+(?![A-Za-z])/, /^@[A-Za-z]+(?![A-Za-z])/, /^(0|[1-9]\d*)(?![\d])/, /^\$/, /^\+/, /^_/, /^-/, /^\*/, /^\//, /^%/, /^==/, /^=/, /^<=/, /^>=/, /^</, /^>/, /^\u00AC/, /^\u2227/, /^\u2228/, /^\u22BB/, /^~/, /^&/, /^\|/, /^\^/, /^\?/, /^;/];
const tokenName = ["comment", "openParen", "closeParen", "openBrac", "closeBrac", "function", "return", "if", "elseif", "else", "while", "continue", "break", "identifier", "identifierLocation", "integer", "follow", "add", "negate", "subtract", "multiply", "divide", "mod", "equal", "assign", "lessEqual", "greaterEqual", "less", "greater", "boolNot", "boolAnd", "boolOr", "boolXor", "bitNot", "bitAnd", "bitOr", "bitXor", "ternary", "semicolon"];

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

function doInstruction() {
    jumpOverFunctions();
    let lastTokenPointerIndex = tokenPointerStack.length - 1;
    let tp = tokenPointerStack.at(lastTokenPointerIndex);
    if (tokenNames?.[tp] == undefined) {
        return "EOP";
    }
    //Well, that's certainly a comparee(?)
    switch (stateStack.at(-1) instanceof Array ? "continueEvaluation" : stateStack.at(-1)?.instruction ?? "") {
        case "block":
        case "functionCall":
            if (tokenNames[tp] == "closeBrac") {
                if (stateStack.pop().instruction == "block") {
                    switch (stateStack.at(-1)?.instruction) {
                        case "else":
                            stateStack.pop();
                            tokenPointerStack[lastTokenPointerIndex]++;
                            break;
                        case "while":
                            tokenPointerStack[lastTokenPointerIndex] = stateStack.at(-1).loc;
                            stateStack.pop();
                            break;
                        default:
                            //leave block
                            tokenPointerStack[lastTokenPointerIndex]++;
                            break;
                    }
                } else {
                    //leave function
                    resultStack[resultStack.length - 1].push("none");
                    popFunctionCall();
                    stateStack.push({ instruction: "continueEvaluation" });
                }
                return "again!";
            }
        //fall through
        case "fall":
        case "":
            switch (tokenNames[tp]) {
                case "break":
                    while (stateStack.at(-1)?.instruction != "while") {
                        let top = stateStack.pop();
                        if (top?.instruction == "function" || top == undefined) {
                            lastError = texts.errors.found.breakOutsideLoop + tokenIndexToLineMessage(tp);
                            return false;
                        }
                    }
                    tokenPointerStack[lastTokenPointerIndex] = stateStack.pop().after;
                    break;
                case "continue":
                    while (stateStack.at(-1)?.instruction != "while") {
                        let top = stateStack.pop();
                        if (top?.instruction == "function" || top == undefined) {
                            lastError = texts.errors.found.continueOutsideLoop + tokenIndexToLineMessage(tp);
                            return false;
                        }
                    }
                    tokenPointerStack[lastTokenPointerIndex] = stateStack.pop().loc;
                    break;
                case "else":
                    {
                        let aB = afterBlock(tp + 1n);
                        if (stateStack.at(-1)?.instruction == "fall") {
                            stateStack.pop();
                            tokenPointerStack[lastTokenPointerIndex] = aB;
                            return true;
                        }
                        tokenPointerStack[lastTokenPointerIndex] = tp + 2n;
                        stateStack.push({ instruction: "else" }, { instruction: "block" })
                    }
                    break;
                case "elseif":
                    {
                        let aC = nextSubExpression(tp + 2n);
                        let aB = afterBlock(aC + 1n);
                        if (stateStack.at(-1)?.instruction == "fall") {
                            tokenPointerStack[lastTokenPointerIndex] = aB
                            if (tokenNames[aB] != "elseif" && tokenNames[aB] != "else") {
                                stateStack.pop();
                                return true;
                            }
                            return "again!";
                        }
                        stateStack.push({ instruction: "if", start: aC + 2n, after: aB }, "output", [tp + 2n]);
                        resultStack.push([]);
                    }
                    break;
                case "if":
                    {
                        let aC = nextSubExpression(tp + 2n);
                        stateStack.push({ instruction: "if", start: aC + 2n, after: afterBlock(aC + 1n) }, "output", [tp + 2n]);
                        resultStack.push([]);
                    }
                    break;
                case "return":
                    if (callDepth == 0n) {
                        lastError = texts.errors.returnOutsideFunction + tokenIndexToLineMessage(tp);
                        return false;
                    }
                    while (stateStack.pop()?.instruction != "functionCall") { }
                    if (tokenNames[tp + 1n] == "semicolon") {
                        resultStack[resultStack.length - 1].push("none");
                        popFunctionCall();
                        break;
                    }
                    stateStack.push({ type: "return" }, [tp + 1n]);
                    resultStack.push([]);
                    break;
                case "while":
                    {
                        let aC = nextSubExpression(tp + 2n);
                        stateStack.push({ instruction: "while", loc: tp, start: aC + 2n, after: afterBlock(aC + 1n) }, "output", [tp + 2n]);
                        resultStack.push([]);
                    }
                    break;
                case "identifierLocation":
                    {
                        let iden = tokens[tp].substring(1);
                        if (tokenNames[tp + 1n] == "assign" && !identifiers.has(iden + ",0") && !identifiers.has(iden + "," + callDepth)) {
                            let k = iden + "," + callDepth;
                            let v = -BigInt(orphanedPointers.push(allocate(0)));
                            identifiers.set(k, v);
                            inverseIdentifiers.set(v, k);
                        }
                    }
                //fall through
                default:
                    {
                        let nse = nextSubExpression(tp);
                        if (tokenNames[nse] == "assign") {
                            stateStack.push({ instruction: "assign", loc: null, val: nse + 1n }, "output", [tp]);
                            resultStack.push([]);
                            break;
                        }
                        stateStack.push({ instruction: "evaluate", after: nse }, "output", [tp]);
                        resultStack.push([]);
                    }
                    break;
            }
            if (tokenNames[tp] != "identifier" && tokenNames[tp] != "identifierLocation") {
                return true;
            }
        //fall through
        case "continueEvaluation":
        default:
            if (stateStack.at(-1)?.instruction == "continueEvaluation") {
                stateStack.pop();
            }
            let evaluation = evaluateExpression();
            if (evaluation === false) {
                return false;
            }
            if (evaluation == "functionCall") {
                return true;
            }
            let instr = stateStack.at(-1);
            lastTokenPointerIndex = tokenPointerStack.length - 1;
            switch (instr.instruction) {
                case "assign":
                    if (instr.loc != null) {
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
                    stateStack.push("output", [instr.val]);
                    resultStack.push([]);
                    return "again!";
                case "elseif":
                case "if":
                    if (evaluation != 0n && evaluation != "empty") {
                        tokenPointerStack[lastTokenPointerIndex] = instr.start;
                        let nextTokenAfterBlock = tokenNames[instr.after];
                        if (nextTokenAfterBlock == "elseif" || nextTokenAfterBlock == "else") {
                            stateStack.splice(-1, 1, { instruction: "fall" }, { instruction: "block" });
                            break;
                        }
                        stateStack.splice(-1, 1, { instruction: "block" });
                        break;
                    }
                    stateStack.pop();
                    tokenPointerStack[lastTokenPointerIndex] = instr.after;
                    break;
                case "evaluate":
                    tokenPointerStack[lastTokenPointerIndex] = stateStack.pop().after;
                    break;
                case "while":
                    if (evaluation != 0n && evaluation != "empty") {
                        tokenPointerStack[lastTokenPointerIndex] = instr.start;
                        stateStack.push({ instruction: "block" })
                        break;
                    }
                    tokenPointerStack[lastTokenPointerIndex] = instr.after;
                    stateStack.pop();
                    break;
                default:
                    lastError = texts.errors.unknownState + tokenIndexToLineMessage(tokenPointerStack[lastTokenPointerIndex]) + "\n" + stateStack.reverse().join(", ");
                    return false;
            }
    }
    return true;
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
                    {
                        let iden = tokens[CWTP];
                        switch (iden) {
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
                                    let argCount = 0n;
                                    functionName = iden;
                                    switch (iden) {
                                        case "inputInt":
                                        case "allocate":
                                        case "inputStr":
                                        case "outputChar":
                                        case "outputInt":
                                            argCount = 1n;
                                            break;
                                        case "free":
                                            argCount = 2n;
                                            break;
                                        case "fread":
                                            argCount = 3n;
                                            break;
                                        default:
                                            if (!functions.has(functionName)) {
                                                lastError = texts.errors.missingFunction + tokenIndexToLineMessage(CWTP);
                                                return false;
                                            }
                                            argCount = functions.get(functionName)[0];
                                            break;
                                    }
                                    stateStack.push({ type: "function", name: functionName });
                                    if (argCount > 0n) {
                                        let eI = [CWTP + 2n];
                                        for (let i = 0n; i < argCount - 1n; i++) {
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
                                if (identifiers.has(iden + "," + callDepth)) {
                                    //local variable
                                    resultStack[lastResultIndex].push(read(identifiers.get(iden + "," + callDepth)));
                                    break;
                                } else if (identifiers.has(iden + ",0")) {
                                    //global variable
                                    resultStack[lastResultIndex].push(read(identifiers.get(iden + ",0")));
                                    break;
                                }
                                lastError = texts.errors.missingIdentifier + tokenIndexToLineMessage(CWTP);
                                return false;
                        }
                    }
                    break;
                case "identifierLocation":
                    {
                        let iden = tokens[CWTP].substring(1);
                        switch (iden) {
                            case "empty":
                            case "true":
                            case "false":
                            case "ROZ":
                                lastError = texts.errors.constantLocation;
                                return false;
                            default:
                                if (identifiers.has(iden + "," + callDepth)) {
                                    //local variable
                                    resultStack[lastResultIndex].push(identifiers.get(iden + "," + callDepth));
                                    break;
                                } else if (identifiers.has(iden + ",0")) {
                                    //global variable
                                    resultStack[lastResultIndex].push(identifiers.get(iden + ",0"));
                                    break;
                                }
                                lastError = texts.errors.missingIdentifier + tokenIndexToLineMessage(CWTP);
                                return false;
                        }
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
            lastError = texts.errors.found.emptyReturn + tokenIndexToLineMessage(tokenPointerStack.at(-1));
            return false;
        }
        if (op.type != "function" && op.type != "equal" && op.type[0] != "b" && arg.includes("empty")) {
            lastError = texts.errors.found.empty + tokenIndexToLineMessage(tokenPointerStack.at(-1));
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
                            lastError = texts.errors.found.empty + tokenIndexToLineMessage(tp);
                            return false;
                        }
                        resultStack[lastResultIndex].push(allocate(arg[0]));
                        continue evalutron;
                    case "free":
                        if (arg[0] == "empty" || arg[1] == "empty") {
                            lastError = texts.errors.found.empty + tokenIndexToLineMessage(tp);
                            return false;
                        }
                        free(arg[0], arg[1]);
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    case "fread":
                        if (arg[0] == "empty" || arg[1] == "empty" || arg[2] == "empty") {
                            lastError = texts.errors.found.empty + tokenIndexToLineMessage(tp);
                            return false;
                        }
                        {
                            let r = arg[0];
                            for (let i = 0n; i < arg[2]; i++) {
                                r = read(r);
                            }
                            resultStack[lastResultIndex].push(r);
                        }
                        free(arg[0], arg[1]);
                        continue evalutron;
                    case "inputInt":
                        {
                            if (arg[0] == "empty") {
                                lastError = texts.errors.found.empty + tokenIndexToLineMessage(tp);
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
                                lastError = texts.errors.found.empty + tokenIndexToLineMessage(tp);
                                return false;
                            }
                            let inp = prompt(texts.string) + "\n";
                            let p = allocate(inp.length);
                            write(arg[0], p);
                            for (let i = 0; i < inp.length; i++) {
                                write(p + BigInt(i), BigInt(inp.charCodeAt(i)));
                            }
                        }
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    case "outputInt":
                        if (arg[0] == "empty") {
                            lastError = texts.errors.found.empty + tokenIndexToLineMessage(tp);
                            return false;
                        }
                        output += arg[0].toString();
                        updateOutput();
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    case "outputChar":
                        if (arg[0] == "empty") {
                            lastError = texts.errors.found.empty + tokenIndexToLineMessage(tp);
                            return false;
                        }
                        output += String.fromCharCode(Number(arg[0] & 65535n));
                        updateOutput();
                        resultStack[lastResultIndex].push("none");
                        continue evalutron;
                    default:
                        let f = functions.get(op.name);
                        tokenPointerStack.push(f[3]);
                        stateStack.push({ instruction: "functionCall" })
                        callDepth++
                        for (let i = 0; i < f[0]; i++) {
                            let p = allocate(1);
                            let k = f[1][i] + "," + callDepth;
                            let v = -BigInt(orphanedPointers.push(p));
                            identifiers.set(k, v);
                            inverseIdentifiers.set(v, k);
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
                popFunctionCall();
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
            mainMemory.length = mainMemory.findLastIndex((e) => e != undefined) + 1;
        }
    }
    if (pointer < 0n) {
        removeOrphanedPointer(pointer);
    }
}

function jumpOverFunctions() {
    //jump over function definitions
    while (tokenNames[tokenPointerStack.at(-1)] == "function") {
        tokenPointerStack[tokenPointerStack.length - 1] = functions.get(tokens[tokenPointerStack.at(-1) + 1n])[4] + 2n;
    }
}

function nextSubExpression(tp) {
    if (tp === false) {
        return false
    }
    let counter = 1n;
    while (counter > 0n) {
        if (tokenNames[tp] == "identifier" && tokenNames[tp + 1n] == "openParen") {
            // function
            switch (tokens[tp]) {
                case "inputInt":
                case "allocate":
                case "inputStr":
                case "outputChar":
                case "outputInt":
                    counter += 1n;
                    break;
                case "free":
                    counter += 2n;
                    break;
                default:
                    if (!functions.has(tokens[tp])) {
                        lastError = texts.errors.missingFunction + tokenIndexToLineMessage(tp);
                        return false
                    }
                    counter += functions.get(tokens[tp])[0];
                    break;
            }
            tp += 2n;
            continue;
        }
        switch (tokenNames[tp]) {
            case "assign":
                lastError = texts.errors.found.assign + tokenIndexToLineMessage(tp);
                return false;
            case "closeBrac":
                lastError = texts.errors.found.closeBrac + tokenIndexToLineMessage(tp);
                return false;
            case "else":
                lastError = texts.errors.found.else + tokenIndexToLineMessage(tp);
                return false;
            case "elseif":
                lastError = texts.errors.found.elseif + tokenIndexToLineMessage(tp);
                return false;
            case "function":
                lastError = texts.errors.found.function + tokenIndexToLineMessage(tp);
                return false;
            case "if":
                lastError = texts.errors.found.if + tokenIndexToLineMessage(tp);
                return false;
            case "openParen":
                lastError = texts.errors.found.openParen + tokenIndexToLineMessage(tp);
                return false;
            case "openBrac":
                lastError = texts.errors.found.openBrac + tokenIndexToLineMessage(tp);
                return false;
            case "return":
                lastError = texts.errors.found.return + tokenIndexToLineMessage(tp);
                return false;
            case "semicolon":
                lastError = texts.errors.found.semicolon + tokenIndexToLineMessage(tp);
                return false;
            case "while":
                lastError = texts.errors.found.while + tokenIndexToLineMessage(tp);
                return false;
            case "closeParen":
            case "identifier":
            case "identifierLocation":
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
                counter += 2n;
                break;
            default:
                lastError = texts.errors.found.token + tokenIndexToLineMessage(tp);
                return false;
        }
        tp++;
    }
    return tp;
}

function parse() {
    reset();
    parsed = false;
    lines = codeInput.value.split("\n").map((s) => s.trim());
    let input = lines.join("\n");
    tokens = [];
    tokenNames = [];
    tokenIndicesBeforeNewLine = [];
    //tokenize
    {
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
            let commentTest = tokenRegexes[0].exec(input);
            if (commentTest !== null) {
                //remove comment
                input = input.substring(commentTest[0].length);
                continue;
            }
            for (let i = 1; i < 39; i++) {
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
            lastError = texts.errors.invalidToken + tokenIndexToLineMessage(tokenNames.length);
            return false;
        }
    }

    //function seperation
    functions.clear();
    {
        let state = 0;
        let brackets = 0n
        let parentheses = 0n
        let bracketTokenIndices = [];
        let functionName = "";
        let args = [];
        let argCount = 0n
        let functionI = -1n;
        for (let i = 0n; i < tokens.length; i++) {
            let lastBracket = parentheses > 0n ? "(" : brackets > 0n ? "{" : "";
            switch (state) {
                case 1:
                    state = 2;
                    break;
                case 2:
                    lastError = texts.errors.functionWithoutName + tokenIndexToLineMessage(i);
                    return false;
                case 3:
                    state = 4
                    break;
                case 4:
                    lastError = texts.errors.expected.openParen + tokenIndexToLineMessage(i);
                    return false;
                default:
                    break;
            }
            switch (tokenNames[i]) {
                case "function":
                    if (state != 0) {
                        lastError = texts.errors.functionInFunction + tokenIndexToLineMessage(i);
                        return false;
                    }
                    if (lastBracket != "") {
                        lastError = texts.errors.functionInBlock + tokenIndexToLineMessage(i);
                        return false;
                    }
                    functionI = i;
                    state = 1;
                    break;
                case "identifier":
                    if (state != 0 && state != 2 && state != 5 && state != 7) {
                        lastError = texts.errors.found.identifier + tokenIndexToLineMessage(i);
                        return false;
                    }
                    if (state == 2) {
                        functionName = tokens[i];
                        state = 3;
                    }
                    if (state == 5) {
                        args.push(tokens[i]);
                        argCount++;
                    }
                    break;
                case "openParen":
                    if (state != 0 && state != 4 && state != 7) {
                        lastError = texts.errors.found.openParen + tokenIndexToLineMessage(i);
                        return false;
                    }
                    if (state == 4) {
                        state = 5;
                    }
                    parentheses++
                    bracketTokenIndices.push(i);
                    break;
                case "closeParen":
                    if (state != 0 && state != 5 && state != 7) {
                        lastError = texts.errors.found.closeParen + tokenIndexToLineMessage(i);
                        return false;
                    }
                    if (lastBracket == "") {
                        lastError = texts.errors.found.closeParen + tokenIndexToLineMessage(i);
                        return false;
                    }
                    if (lastBracket == "{") {
                        lastError = "{" + tokenIndexToLineMessage(bracketTokenIndices.pop()) + texts.errors.incorrectPairing + ")" + tokenIndexToLineMessage(i, false);
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
                        lastError = texts.errors.found.openBrac + tokenIndexToLineMessage(i);
                        return false;
                    }
                    if (state == 6) {
                        state = 7;
                    }
                    brackets++;
                    bracketTokenIndices.push(i);
                    break;
                case "closeBrac":
                    if (state != 0 && state != 7 || lastBracket == "") {
                        lastError = texts.errors.found.closeBrac + tokenIndexToLineMessage(i);
                        return false;
                    }
                    if (lastBracket == "(") {
                        lastError = "(" + tokenIndexToLineMessage(bracketTokenIndices.pop()) + texts.errors.incorrectPairing + "}" + tokenIndexToLineMessage(i, false);
                        return false
                    }
                    brackets--;
                    if (state == 7 && brackets == 0) {
                        functions.set(functionName, [argCount, args, functionI, functionI + argCount + 5n, i - 1n]);
                        args = [];
                        argCount = 0n;
                        state = 0;
                    }
                    break;
                case "comment":
                    break;
                case "return":
                    if (state != 7) {
                        lastError = texts.errors.found.return + tokenIndexToLineMessage(i);
                        return false;
                    }
                default:
                    if (state != 0 && state != 7) {
                        lastError = texts.errors.found.token + tokenIndexToLineMessage(i);
                        return false;
                    }
                    break;

            }
        }
        if (brackets > 0n || parentheses > 0n) {
            let missing = [];
            for (; parentheses > 0n; parentheses--) {
                missing.push("(" + tokenIndexToLineMessage(bracketTokenIndices.pop()));
            }
            for (; brackets > 0n; brackets--) {
                missing.push("{" + tokenIndexToLineMessage(bracketTokenIndices.pop()));
            }
            lastError = texts.errors.unpairedBrackets + missing.join(", ");
            return false;
        }
        jumpOverFunctions();
        updateLineNumbers();
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
                        lastError = texts.errors.expected.openBrac + tokenIndexToLineMessage(i + 1n);
                        return false;
                    }
                    if (lastBranch == "none") {
                        lastError = texts.errors.found.else + tokenIndexToLineMessage(i);
                        return false;
                    }
                    branchTokenStack[lastBranchIndex] = "none";
                    branchTokenStack.push("none");
                    i++;
                    break;
                case "elseif":
                    if (lastBranch == "none") {
                        lastError = texts.errors.found.elseif + tokenIndexToLineMessage(i);
                        return false;
                    }
                    if (tokenNames[i + 1n] != "openParen") {
                        lastError = texts.errors.expected.openParen + tokenIndexToLineMessage(i + 1n);
                        return false;
                    }
                    {
                        let afterCondition = nextSubExpression(i + 2n);
                        if (tokenNames[afterCondition] != "closeParen") {
                            lastError = texts.errors.expected.closeParen + tokenIndexToLineMessage(afterCondition);
                            return false;
                        }
                        if (tokenNames[afterCondition + 1n] != "openBrac") {
                            lastError = texts.errors.expected.openBrac + tokenIndexToLineMessage(afterCondition + 1n);
                            return false;
                        }
                        i = afterCondition + 1n;
                    }
                    branchTokenStack[lastBranchIndex] = "if";
                    branchTokenStack.push("none");
                    break;
                case "function":
                    // functions are already checked so just grab the data.
                    i = functions.get(tokens[i + 1n])[3] - 1n;
                    branchTokenStack[lastBranchIndex] = "none";
                    branchTokenStack.push("none");
                    break;
                case "if":
                    if (tokenNames[i + 1n] != "openParen") {
                        lastError = texts.errors.expected.openParen + tokenIndexToLineMessage(i + 1n);
                        return false;
                    }
                    {
                        let afterCondition = nextSubExpression(i + 2n);
                        if (tokenNames[afterCondition] != "closeParen") {
                            lastError = texts.errors.expected.closeParen + tokenIndexToLineMessage(afterCondition);
                            return false;
                        }
                        if (tokenNames[afterCondition + 1n] != "openBrac") {
                            lastError = texts.errors.expected.openBrac + tokenIndexToLineMessage(afterCondition + 1n);
                        }
                        i = afterCondition + 1n;
                    }
                    branchTokenStack[lastBranchIndex] = "if";
                    branchTokenStack.push("none");
                    break;
                case "openBrac":
                    lastError = texts.errors.found.openBrac + tokenIndexToLineMessage(i);
                    return false;
                case "while":
                    if (tokenNames[i + 1n] != "openParen") {
                        lastError = texts.errors.expected.openParen + tokenIndexToLineMessage(i + 1n);
                        return false;
                    }
                    {
                        let afterCondition = nextSubExpression(i + 2n);
                        if (tokenNames[afterCondition] != "closeParen") {
                            lastError = texts.errors.expected.closeParen + tokenIndexToLineMessage(afterCondition);
                            return false;
                        }
                        if (tokenNames[afterCondition + 1n] != "openBrac") {
                            lastError = texts.errors.expected.openBrac + tokenIndexToLineMessage(afterCondition + 1n);
                        }
                        i = afterCondition + 1n;
                    }
                    branchTokenStack[lastBranchIndex] = "none";
                    branchTokenStack.push("none");
                    break;
                default:
                    break;
            }
        }
    }
    parsed = true
    return true;
}

function popFunctionCall() {
    //remove local variables
    for (let k of identifiers.keys()) {
        if (k.endsWith("," + callDepth)) {
            free(k, 0);
        }
    }
    tokenPointerStack.pop();
    callDepth--;
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

function removeOrphanedPointer(index) {
    orphanedPointers.splice(Number(-index - 1n), 1);
    inverseIdentifiers.clear();
    for (let [k, v] of identifiers) {
        if (v < index) {
            identifiers.set(k, v + 1n);
            inverseIdentifiers.set(v + 1n, k);
        } else {
            inverseIdentifiers.set(v, k);
        }
    }
}

function reset() {
    //reset the state
    mainMemory = [];
    orphanedPointers = [];
    stateStack = [];
    resultStack = [];
    tokenPointerStack = [0n];
    callDepth = 0n;
    identifiers.clear()
    inverseIdentifiers.clear();
    output = "";
    infoBox.innerHTML = "";
    lastErrorLine = 0n;
    clearInterval(clock);
    running = false;
    updateOutput();
    updateMemoryDisplay();
}

function step(stepCount = 1) {
    let result;
    for (let i = 0; i < stepCount; i++) {
        do {
            result = doInstruction();
            //This is the best backwards jump I can do.
            //Probably programmed in MoreMathRPN too long.
        } while (result === "again!")
        if (result == false) break;
    }

    if (result === false) {
        clearInterval(clock);
        running = false;
        updateButtons();
        displayError();
    }
    if (result === "EOP") {
        clearInterval(clock);
        running = false;
        updateButtons();
        infoBox.innerHTML += "<span>&lt;Halt&gt;";
    }
    updateLineNumbers();
    updateMemoryDisplay()
}

function tokenIndexToLineMessage(tI, setLEL = true) {
    let l = tokenIndexToLineNumber(tI);
    if (setLEL) {
        lastErrorLine = l;
    }
    return texts.errors.linePrefix + l;
}

function tokenIndexToLineNumber(tI) {
    if (tokenIndicesBeforeNewLine.length == 0) {
        return 1;
    }
    if (tokenIndicesBeforeNewLine.at(-1) <= tI) {
        return tokenIndicesBeforeNewLine.length + 1;
    }
    return tokenIndicesBeforeNewLine.findIndex((e) => e > tI) + 1;
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
        removeOrphanedPointer(index);
        return;
    }
    orphanedPointers[-index - 1n] = value;
}
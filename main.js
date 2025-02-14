//indexed > 0
let mainMemory = [];
//indexed < 0
let orphanedPointers = [];
//functions being called
let callStack = [];
//every variable, local or global 
let identifiers = new Map();
//trimmed lines split before tokenizing
let lines = [];
//The tokens this code is composed of
let tokens = [];
let tokenNames = [];
let spaces = [];
//functions!
let functions = new Map();
let output = "";

const texts = {
    errors: {
        found: {
            closeBrac: "Unexpected \"{\"",
            closeParen: "Unexpected \")\"",
            identifier: "Unexpected identifier",
            openBrac: "Unexpected \"}\"",
            openParen: "Unexpected \"(\"",
            token: "Unexpected token"
        },
        functionInBlock: "Function in a block",
        functionInFunction: "Function in another function",
        functionWithoutName: "Unnamed function",
        incorrectPairing: " is paired with ",
        invalidToken: "Invalid token",
        missingIdentifier: "Missing idenifier",
        expected: {
            closeBrac: "Expected \"{\"",
            closeParen: "Expected \")\"",
            identifier: "Expected identifier",
            openBrac: "Expected \"}\"",
            openParen: "Expected \"(\"",
            token: "Expected token"
        }
    }
};

let lastError = "";

function reset() {
    //reset the state
    mainMemory = [];
    orphanedPointers = [];
    callStack = [];
    identifiers = new Map();
    functions = new Map();
    output = "";
}

const tokenRegexes = [/^\[[\S\s]*?\]/, /^\(/, /^\)/, /^\{/, /^\}/, /^function /, /^[A-Za-z]+(?![A-Za-z])/, /^(0|[1-9]\d*)(?![\d])/, /^\$/, /^@/, /^\+/, /^_/, /^-/, /^\*/, /^\//, /^%/, /^==/, /^=/, /^<=/, /^>=/, /^</, /^>/, /^\u00AC/, /^\u2227/, /^\u2228/, /^\u22BB/, /^~/, /^&/, /^\|/, /^\^/];
const tokenName = ["comment", "openParen", "closeParen", "openBrac", "closeBrac", "function", "identifier", "integer", "follow", "followFree", "add", "negate", "subtract", "multiply", "divide", "mod", "equal", "assign", "lessEqual", "greaterEqual", "less", "greater", "boolNot", "boolAnd", "boolOr", "boolXor", "bitNot", "bitAnd", "bitOr", "bitXor"];

function parse() {
    lines = codeInput.value.split("\n").map((s) => s.trim());
    let input = lines.join("");
    tokens = [];
    tokenNames = [];
    spaces = [];
    //tokenize
    let current = 0;
    invalid = false;
    tokenize: while (input.length > 0) {
        spaces.push(0);
        while (input[0] == " " || input[0] == ",") {
            input = input.substring(1);
            spaces[spaces.length - 1]++;
            current++;
        }
        for (let i = 0; i < 29; i++) {
            let test = tokenRegexes[i].exec(input);
            if (test !== null) {
                tokenNames.push(tokenName[i]);
                tokens.push(test[0]);
                input = input.substring(test[0].length);
                current += test[0].length;
                continue tokenize;
            }
        }
        invalid = true;
        break;
    }

    function indexToLine(i) {
        let accumulation = 0;
        let line = 0
        while (accumulation < i) {
            // if we hit the end, just hammer it home.
            accumulation += lines[line]?.length ?? i + 1;
            line++;
        }
        return " on line " + --line;
    }

    if (invalid) {
        lastError = texts.errors.invalidToken + indexToLine(current);
        return false;
    }

    //function seperation
    current = 0;
    state = 0;
    brackets = [];
    bracketCurrent = []
    functionName = "";
    arguments = [];
    functionI = -1;
    for (let i = 0; i < tokens.length; i++) {
        switch (state) {
            case 1:
                state = 2;
                break;
            case 2:
                lastError = texts.errors.functionWithoutName + indexToLine(current);
                return false;
            case 3:
                state = 4
                break;
            case 4:
                lastError = texts.errors.missing.openParen + indexToLine(current);
                return false;
            default:
                break;
        }
        switch (tokenNames[i]) {
            case "function":
                if (state != 0) {
                    lastError = texts.errors.functionInFunction + indexToLine(current);
                    return false;
                }
                if (brackets.length != 0) {
                    lastError = texts.errors.functionInBlock + indexToLine(current);
                    return false;
                }
                functionI = i;
                state = 1;
                break;
            case "identifier":
                if (state != 0 && state != 2 && state != 5 && state != 7) {
                    lastError = texts.errors.found.identifier + indexToLine(current)
                    return false;
                }
                if (state == 2) {
                    functionName = tokens[i];
                    state = 3;
                }
                if (state == 5) {
                    arguments.push(tokens[i]);
                }
                break;
            case "openParen":
                if (state != 0 && state != 4 && state != 7) {
                    lastError = texts.errors.found.openParen + indexToLine(current);
                    return false;
                }
                if (state == 4) {
                    state = 5;
                }
                brackets.push("(");
                bracketCurrent.push(current);
                break;
            case "closeParen":
                if (state != 5 && state != 7) {
                    lastError = texts.errors.found.closeParen + indexToLine(current);
                }
                {
                    let bracket = brackets.pop();
                    if (bracket != "(") {
                        lastError = bracket + indexToLine(bracketCurrent.pop()) + texts.errors.incorrectPairing + ")" + indexToLine(current);
                        return false;
                    }
                }
                bracketCurrent.pop();
                if (state == 5) {
                    state = 6;
                }
                break;
            case "openBrac":
                if (state != 0 && state != 6 && state != 7) {
                    lastError = texts.errors.found.openBrac + indexToLine(current);
                    return false;
                }
                if (state == 6) {
                    state = 7;
                }
                brackets.push("{");
                break;
            case "closeBrac":
                if (state != 0 && state != 7 || brackets.pop() != "{") {
                    lastError = texts.errors.found.closeBrac + indexToLine(current);
                    return false;
                }
                {
                    let bracket = brackets.pop();
                    if (bracket != "(") {
                        lastError = bracket + indexToLine(bracketCurrent.pop()) + texts.errors.incorrectPairing + ")" + indexToLine(current);
                        return false
                    }
                }
                bracketCurrent.pop();
                if (brackets.length == 0) {
                    functions.set(functionName, [arguments, functionI, functionI + arguments.length + 6, i]);
                    arguments = [];
                    state = 0;
                }
            case "comment":
                break;
            default:
                if (state != 0 && state != 7) {
                    lastError = texts.errors.found.token + indexToLine(current);
                    return false;
                }
                break;

        }
        current += tokens[i].length + spaces[i];
    }
    if (brackets.length > 0) {

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
    return i + 1n;
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
            delete mainMemory[pointer - 1];
        }
        if (deleted) {
            //clean up end of mainMemory
            mainMemory.length = mainMemory.findLastIndex((e) => e != undefined) + 1;
        }
    }
    if (pointer < 0n) {
        orphanedPointers.splice(Number(pointer + 1n), 1);
        for (let [k, v] of identifiers) {
            if (v > 1n - pointer) {
                identifiers.set(k, v - 1n);
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
        return mainMemory[index - 1n];
    }
    return orphanedPointers[-index - 1n];
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
            }
            delete mainMemory[index - 1];
            return;
        }
        mainMemory[index - 1] = value;
        return;
    }
    if (value == "empty") {
        orphanedPointers.splice(-index - 1, 1);
        return;
    }
    orphanedPointers[-index - 1] = value;
}
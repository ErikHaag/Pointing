//indexed > 0
let mainMemory = [];
//indexed < 0
let orphanedPointers = [];
//functions being called
let callStack = [];
//every variable, local or global 
let identifiers = new Map();
let functionTokens = new Map();
let output = "";

const texts = {
    errors: {
        missingIdentifier: "Missing idenifier!"
    }
};

let lastError = "";

function reset() {
    //reset the state
    mainMemory = [];
    orphanedPointers = [];
    callStack = [];
    identifiers = new Map();
    functionTokens = new Map();
    output = "";
    //parse!
}

const tokenRegexes = [/^[A-Za-z]+($|[^A-Za-z])/, /^(0|[1-9]\d*)($|[^\d])/, /^/];
const tokenNames = ["identifier", "integer"];

function parse() {
    
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
        return 0n;
    }
    if (index > 0n) {
        return mainMemory[index - 1n];
    }
    return orphanedPointers[-index - 1n];
}
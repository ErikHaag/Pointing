runButton.addEventListener("click", () => {
    if (!parsed) {
        return;
    }
    if (!running) {
        clearInterval(clock);
        parse();
        if (!paused) {
            startClock();
            updateButtons();
        }
    }
    if (paused) {
        step();
        return;
    }
});

pauseButton.addEventListener("click", () => {
    if (!parsed) {
        return;
    }
    paused = !paused;
    if (running) {
        if (paused) {
            clearInterval(clock);
        } else {
            startClock();
        }
    }
    updateButtons();
});

resetButton.addEventListener("click", () => {
    if (parse() === false) {
        updateLineNumbers();
    } 
    updateButtons();
});

function startClock() {
    clock = setInterval(() => {
        step();
    }, 500);
    running = true;
}

function updateButtons() {
    if (!parsed || running && !paused) {
        runButton.classList.add("off");
    } else {
        runButton.classList.remove("off");
    }
    if (!parsed) {
        pauseButton.classList.add("off");
    } else {
        pauseButton.classList.remove("off");
    }
    if (paused) {
        runButton.innerText = "Step";
        pauseButton.innerText = "Continue";
    } else {
        runButton.innerText = "Run";
        pauseButton.innerText = "Pause";
    }
}
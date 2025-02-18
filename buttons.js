runButton.addEventListener("click", () => {
    if (!parsed) {
        return;
    }
    if (!running) {
        reset();
        running = true;
        if (!paused) {
            startClock();
        }
        updateLineNumbers();
        updateButtons();
    } else if (paused) {
        step();
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
    reset();
    //love when you can use short circuiting to your advantage!
    if (!parsed && !parse()) {
        displayError();
    }
    updateLineNumbers();
    updateButtons();
});

function startClock() {
    clock = setInterval(() => {
        step();
    }, 500);
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
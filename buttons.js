runButton.addEventListener("click", () => {
    if (!parsed) {
        return;
    }
    if (!running) {
        reset();
        jumpOverFunctions();
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
        step(stepCount);
    }, stepPeriod);
}

speedButton.addEventListener("click", () => {
    if (!parsed) {
        return;
    }
    speed = (speed + 1n) % 5n;
    clearInterval(clock);
    updateSpeed();
    if (running && !paused) {
        startClock();
    }
});

function updateButtons() {
    if (!parsed || running && !paused) {
        runButton.classList.add("off");
    } else {
        runButton.classList.remove("off");
    }
    if (!parsed) {
        pauseButton.classList.add("off");
        speedButton.classList.add("off");
    } else {
        pauseButton.classList.remove("off");
        speedButton.classList.remove("off");
    }
    if (paused) {
        runButton.innerText = "Step";
        pauseButton.innerText = "Continue";
    } else {
        runButton.innerText = "Run";
        pauseButton.innerText = "Pause";
    }
}

function updateSpeed() {
    switch (speed) {
        case 0n:
            stepPeriod = 500;
            stepCount = 1;
            speedButton.innerHTML = "&gt;";
            break;
        case 1n:
            stepPeriod = 250;
            stepCount = 1;
            speedButton.innerHTML = "&gt;&gt;";
            break;
        case 2n:
            stepPeriod = 100;
            stepCount = 1;
            speedButton.innerHTML = "&gt;&gt;&gt;";
            break;
        case 3n:
            stepPeriod = 100;
            stepCount = 2;
            speedButton.innerHTML = "&gt;&gt;&gt;&gt;";
            break;
        case 4n:
            stepPeriod = 100;
            stepCount = 5;
            speedButton.innerHTML = "&gt;&gt;&gt;&gt;&gt;";
            break;
        default:
            speed = 0n;
            stepPeriod = 500;
            stepCount = 1;
            speedButton.innerHTML = "&gt;"
            break;
    }
}
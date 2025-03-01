//buttons.js
let running = false;
let paused = false;
let parsed = false;
let clock;

let speed = 0n;
let stepPeriod = 500;
let stepCount = 1;

//display.js
let lineCount = 1n;
let prideMonthOverride = (new Date().getMonth()) == 5;
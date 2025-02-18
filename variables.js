//buttons.js
let running = false;
let paused = false;
let parsed = false;
let clock;

//display.js
let lineCount = 1n;
let prideMonthOverride = (new Date().getMonth()) == 5;
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const menuOverlay = document.getElementById('menu-overlay');
    const carSelectOverlay = document.getElementById('car-select-overlay');
    const startBtn = document.getElementById('start-btn');
    const raceBtn = document.getElementById('race-btn');
    const carOptions = document.querySelectorAll('.car-option');

    // Set canvas size
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Initialize game components
    const game = new Game(canvas);
    const input = new InputHandler();
    const renderer = new Renderer(game.ctx);
    const audio = new AudioManager();

    game.input = input;
    game.renderer = renderer;
    game.audio = audio;

    const endOverlay = document.getElementById('end-overlay');
    const againBtn = document.getElementById('again-btn');
    const changeCarBtn = document.getElementById('change-car-btn');
    const touchControls = document.getElementById('touch-controls');
    const laneUpBtn = document.getElementById('lane-up-btn');
    const laneDownBtn = document.getElementById('lane-down-btn');
    const brakeBtn = document.getElementById('brake-btn');

    // Selected car type
    let selectedCarType = null;
    let lastCarType = null;
    let gameLoopStarted = false;
    let endTimer = null;

    // ---- Scale the fixed 1000x600 game to fit the window ----
    const container = document.getElementById('game-container');
    function fitToWindow() {
        const w = container.offsetWidth || CANVAS_WIDTH + 8;
        const h = container.offsetHeight || CANVAS_HEIGHT + 8;
        const scale = Math.min(window.innerWidth / w, window.innerHeight / h, 1.2);
        document.documentElement.style.setProperty('--game-scale', String(scale));
    }
    fitToWindow();
    window.addEventListener('resize', fitToWindow);
    window.addEventListener('orientationchange', fitToWindow);

    // ---- Touch mode: picture hints, on-screen buttons, car drives itself ----
    let touchMode = false;
    function setTouchMode(on) {
        if (touchMode === on) return;
        touchMode = on;
        document.body.classList.toggle('touch', on);
        input.autoAccelerate = on;
        if (game.state === GameState.PLAYING) touchControls.classList.toggle('hidden', !on);
    }
    setTouchMode(
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        (navigator.maxTouchPoints > 0 && window.matchMedia && window.matchMedia('(hover: none)').matches)
    );
    window.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') setTouchMode(true);
    }, true);

    function flash(btn) {
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 140);
    }

    function laneTap(dir, btn) {
        if (game.state !== GameState.PLAYING) return;
        input.queueLane(dir);
        if (btn) flash(btn);
    }

    laneUpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); laneTap(-1, laneUpBtn); });
    laneDownBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); laneTap(1, laneDownBtn); });

    // Hold the turtle to slow down
    let brakePointer = null;
    brakeBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        brakePointer = e.pointerId;
        input.touchBrake = true;
        brakeBtn.classList.add('pressed');
    });
    const releaseBrake = (e) => {
        if (brakePointer === null || e.pointerId !== brakePointer) return;
        brakePointer = null;
        input.touchBrake = false;
        brakeBtn.classList.remove('pressed');
    };
    window.addEventListener('pointerup', releaseBrake);
    window.addEventListener('pointercancel', releaseBrake);

    // Tap the road above or below your car to move that way
    canvas.addEventListener('pointerdown', (e) => {
        if (game.state !== GameState.PLAYING || !game.player) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const y = (e.clientY - rect.top) / rect.height * CANVAS_HEIGHT;
        const carMid = game.player.groundY + game.player.height / 2;
        if (y < carMid - 25) laneTap(-1, laneUpBtn);
        else if (y > carMid + 25) laneTap(1, laneDownBtn);
    });

    // Long-press menus and text selection get in a small child's way
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---- Screens ----
    function hideEndScreen() {
        clearTimeout(endTimer);
        endOverlay.classList.add('hidden');
    }

    function showCarSelect() {
        hideEndScreen();
        touchControls.classList.add('hidden');
        input.clearTouch();
        carSelectOverlay.classList.remove('hidden');
        game.state = GameState.CAR_SELECT;
        // Keep the last car picked so one tap on RACE! goes again
        carOptions.forEach(opt => opt.classList.toggle('selected', lastCarType && CAR_TYPES[opt.dataset.car] === lastCarType));
        selectedCarType = lastCarType;
        raceBtn.classList.toggle('hidden', !selectedCarType);
    }

    function startRace(carType) {
        if (!carType) return;
        lastCarType = carType;
        hideEndScreen();
        menuOverlay.classList.add('hidden');
        carSelectOverlay.classList.add('hidden');
        input.clearTouch();
        input.autoAccelerate = touchMode;
        game.init(carType);
        game.lastTime = performance.now();
        touchControls.classList.toggle('hidden', !touchMode);

        if (!gameLoopStarted) {
            gameLoopStarted = true;
            requestAnimationFrame((time) => game.gameLoop(time));
        }
    }

    game.onRaceEnd = () => {
        touchControls.classList.add('hidden');
        input.clearTouch();
        clearTimeout(endTimer);
        // A short pause so frantic tapping at the finish can't skip the results
        endTimer = setTimeout(() => {
            if (game.state === GameState.RACE_END) endOverlay.classList.remove('hidden');
        }, 1200);
    };

    // Start button - go to car selection
    startBtn.addEventListener('click', () => {
        audio.init();
        menuOverlay.classList.add('hidden');
        showCarSelect();
    });

    // Car option selection
    carOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove selection from all
            carOptions.forEach(opt => opt.classList.remove('selected'));
            // Select this one
            option.classList.add('selected');
            selectedCarType = CAR_TYPES[option.dataset.car];
            // Show race button
            raceBtn.classList.remove('hidden');

            // Play selection sound
            audio.playLaneChange();
        });
    });

    // Race button - start the game
    raceBtn.addEventListener('click', () => startRace(selectedCarType));

    againBtn.addEventListener('click', () => startRace(lastCarType));
    changeCarBtn.addEventListener('click', () => showCarSelect());

    // Keyboard: Enter races again with the same car, Space picks a new car
    window.addEventListener('keydown', (e) => {
        if (game.state !== GameState.GAME_OVER && game.state !== GameState.RACE_END) return;
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault();
            startRace(lastCarType);
        } else if (e.code === 'Space') {
            e.preventDefault();
            showCarSelect();
        }
    });

    // Read-only state for automated play-testing
    window.__game = {
        get state() { return game.state; },
        get touchMode() { return touchMode; },
        get car() { return game.player && game.player.carType ? game.player.carType.id : (lastCarType ? lastCarType.id : null); },
        get progress() {
            if (!game.player || !game.level) return 0;
            return Math.round(Math.min(Math.max(game.player.x / game.level.finishLineX, 0), 1) * 100);
        },
        get position() {
            if (!game.player) return 0;
            return game.state === GameState.RACE_END ? game.getPlayerPlacement() : game.getLivePosition();
        },
        get lives() { return game.player ? game.player.lives : PLAYER_START_LIVES; },
        get lane() { return game.player ? game.player.currentLane : 1; },
        get speed() { return game.player ? Math.round(game.player.velocityX * 10) / 10 : 0; },
        get finished() { return !!(game.player && game.player.finished); },
        get timeMs() { return Math.round(game.gameTime); },
        get endButtonsVisible() { return !endOverlay.classList.contains('hidden'); },
        snapshot() {
            const g = window.__game;
            return {
                state: g.state, touchMode: g.touchMode, car: g.car, progress: g.progress,
                position: g.position, lives: g.lives, lane: g.lane, speed: g.speed,
                finished: g.finished, timeMs: g.timeMs, endButtonsVisible: g.endButtonsVisible
            };
        }
    };

    // Draw initial state on canvas while on menu
    renderer.drawTrack(0, canvas.width, canvas.height);

    // Draw preview cars on the menu (showing all 3 types)
    const previewPlayer = {
        x: 200,
        y: LANE_HEIGHT * 1.5 - PLAYER_HEIGHT,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        color: COLORS.car,
        visible: true,
        isJumping: false,
        jumpScale: 1,
        groundY: LANE_HEIGHT * 1.5 - PLAYER_HEIGHT,
        hasBoost: () => false,
        shieldActive: false
    };
    renderer.drawCar(previewPlayer, 0);
});

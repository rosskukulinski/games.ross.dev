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

    // Selected car type
    let selectedCarType = null;
    let gameLoopStarted = false;

    // Start button - go to car selection
    startBtn.addEventListener('click', () => {
        audio.init();
        menuOverlay.classList.add('hidden');
        carSelectOverlay.classList.remove('hidden');
        game.state = GameState.CAR_SELECT;
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
    raceBtn.addEventListener('click', () => {
        if (!selectedCarType) return;

        carSelectOverlay.classList.add('hidden');
        game.init(selectedCarType);
        game.lastTime = performance.now();

        if (!gameLoopStarted) {
            gameLoopStarted = true;
            requestAnimationFrame((time) => game.gameLoop(time));
        }
    });

    // Space to restart when race ends
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            if (game.state === GameState.GAME_OVER || game.state === GameState.RACE_END) {
                // Go back to car selection
                carSelectOverlay.classList.remove('hidden');
                game.state = GameState.CAR_SELECT;
                // Reset selection
                carOptions.forEach(opt => opt.classList.remove('selected'));
                raceBtn.classList.add('hidden');
                selectedCarType = null;
            }
        }
    });

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

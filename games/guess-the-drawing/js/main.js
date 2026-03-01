// Main Entry Point
// Initializes all modules and sets up the application

const INPUT_MODE_KEY = 'guess-the-drawing-input-mode';

function getSelectedMode() {
    const checked = document.querySelector('input[name="input-mode"]:checked');
    return checked ? checked.value : 'speak';
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI first
    UI.init();

    // Initialize audio (context created on first interaction)
    Audio.init();

    // Initialize speech recognition
    const speechSupported = Speech.init();

    // Show text fallback if speech not supported
    if (!speechSupported) {
        UI.showTextFallback();
    }

    // Initialize drawing engine
    Drawing.init(UI.getCanvas(), UI.getPencil());

    // Initialize game logic
    Game.init();

    // Load saved input mode preference from localStorage
    const savedMode = localStorage.getItem(INPUT_MODE_KEY) || 'speak';
    const modeInputs = document.querySelectorAll('input[name="input-mode"]');
    modeInputs.forEach(input => {
        input.checked = input.value === savedMode;
        input.addEventListener('change', () => {
            if (input.checked) {
                localStorage.setItem(INPUT_MODE_KEY, input.value);
            }
        });
    });

    // Set up button handlers
    UI.onStartClick(() => {
        Game.inputMode = getSelectedMode();
        Game.start();
    });

    UI.onPlayAgainClick(() => {
        Game.start();
    });

    // Handle visibility change (pause/resume)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && Game.getState() === 'PLAYING') {
            // Could pause the game here if desired
        }
    });

    // Handle window resize for canvas
    window.addEventListener('resize', () => {
        if (Drawing.canvas) {
            Drawing.setupCanvas();
        }
    });

    console.log('Guess the Drawing loaded!');
});

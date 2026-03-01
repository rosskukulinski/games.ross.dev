// Main Entry Point
// Initializes all modules and sets up the application

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

    // Set up button handlers
    UI.onStartClick(() => {
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

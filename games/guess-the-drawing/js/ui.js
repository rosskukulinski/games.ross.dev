// UI Controller Module
// Handles all UI updates and screen transitions

const UI = {
    elements: {},

    init() {
        // Cache DOM elements
        this.elements = {
            // Screens
            startScreen: document.getElementById('start-screen'),
            gameScreen: document.getElementById('game-screen'),
            endScreen: document.getElementById('end-screen'),

            // Game elements
            starCount: document.getElementById('star-count'),
            roundNumber: document.getElementById('round-number'),
            timer: document.getElementById('timer'),
            micBtn: document.getElementById('mic-btn'),
            guessDisplay: document.getElementById('guess-display'),
            textFallback: document.getElementById('text-fallback'),
            canvas: document.getElementById('game-canvas'),
            pencil: document.getElementById('pencil'),

            // Feedback
            feedbackOverlay: document.getElementById('feedback-overlay'),
            feedbackIcon: document.getElementById('feedback-icon'),
            feedbackText: document.getElementById('feedback-text'),

            // End screen
            finalStars: document.getElementById('final-stars'),
            correctCount: document.getElementById('correct-count'),
            timeoutCount: document.getElementById('timeout-count'),

            // Buttons
            startBtn: document.getElementById('start-btn'),
            playAgainBtn: document.getElementById('play-again-btn')
        };
    },

    // Screen management
    showScreen(screenName) {
        const screens = ['startScreen', 'gameScreen', 'endScreen'];

        screens.forEach(screen => {
            if (screen === screenName) {
                this.elements[screen].classList.remove('hidden');
            } else {
                this.elements[screen].classList.add('hidden');
            }
        });
    },

    showStartScreen() {
        this.showScreen('startScreen');
    },

    showGameScreen() {
        this.showScreen('gameScreen');
    },

    showEndScreen(stats) {
        this.elements.finalStars.textContent = stats.stars;
        this.elements.correctCount.textContent = stats.correct;
        this.elements.timeoutCount.textContent = stats.timeouts;
        this.showScreen('endScreen');
    },

    // Game UI updates
    updateStars(count) {
        this.elements.starCount.textContent = count;
        // Add a little bounce animation
        this.elements.starCount.style.transform = 'scale(1.3)';
        setTimeout(() => {
            this.elements.starCount.style.transform = 'scale(1)';
        }, 200);
    },

    updateRound(current, total = 10) {
        this.elements.roundNumber.textContent = current;
    },

    updateTimer(seconds) {
        this.elements.timer.textContent = Timer.formatTime(seconds);

        // Add warning class when time is low
        if (seconds <= 5) {
            this.elements.timer.classList.add('warning');
        } else {
            this.elements.timer.classList.remove('warning');
        }
    },

    resetTimer() {
        this.elements.timer.classList.remove('warning');
        this.elements.timer.textContent = '0:30';
    },

    // Microphone button
    setMicActive(active) {
        if (active) {
            this.elements.micBtn.classList.add('active');
        } else {
            this.elements.micBtn.classList.remove('active');
        }
    },

    // Guess display
    updateGuessDisplay(text) {
        if (text && text.trim()) {
            this.elements.guessDisplay.textContent = text;
            this.elements.guessDisplay.classList.add('has-text');
        } else {
            this.elements.guessDisplay.textContent = 'Press the microphone and say what you see...';
            this.elements.guessDisplay.classList.remove('has-text');
        }
    },

    clearGuessDisplay() {
        this.elements.guessDisplay.textContent = 'Press the microphone and say what you see...';
        this.elements.guessDisplay.classList.remove('has-text');
    },

    // Text fallback for browsers without speech support
    showTextFallback() {
        this.elements.textFallback.classList.remove('hidden');
        this.elements.micBtn.style.display = 'none';
    },

    hideTextFallback() {
        this.elements.textFallback.classList.add('hidden');
        this.elements.textFallback.value = '';
    },

    // Feedback overlays
    showCorrectFeedback() {
        this.elements.feedbackIcon.className = 'feedback-icon correct';
        this.elements.feedbackText.innerHTML = 'Correct!';
        this.elements.feedbackOverlay.classList.remove('hidden');
    },

    showTimeoutFeedback(answer) {
        this.elements.feedbackIcon.className = 'feedback-icon timeout';
        this.elements.feedbackText.innerHTML = `Time's up!<span class="answer">It was: ${answer}</span>`;
        this.elements.feedbackOverlay.classList.remove('hidden');
    },

    hideFeedback() {
        this.elements.feedbackOverlay.classList.add('hidden');
    },

    // Error displays
    showMicPermissionError() {
        this.elements.guessDisplay.textContent = 'Microphone access denied. Please allow microphone access or type your guess below.';
        this.showTextFallback();
    },

    // Get canvas and pencil elements
    getCanvas() {
        return this.elements.canvas;
    },

    getPencil() {
        return this.elements.pencil;
    },

    // Button handlers
    onStartClick(callback) {
        this.elements.startBtn.addEventListener('click', callback);
    },

    onPlayAgainClick(callback) {
        this.elements.playAgainBtn.addEventListener('click', callback);
    },

    onMicClick(callback) {
        this.elements.micBtn.addEventListener('click', callback);
    },

    onTextInput(callback) {
        this.elements.textFallback.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                callback(e.target.value);
                e.target.value = '';
            }
        });
    }
};

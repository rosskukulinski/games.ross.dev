// Game State Management
// Controls game flow, scoring, and round progression

const Game = {
    state: 'IDLE', // IDLE, PLAYING, ROUND_END, GAME_OVER

    data: {
        stars: 0,
        currentRound: 0,
        totalRounds: 10,
        correctGuesses: 0,
        timeouts: 0,
        currentDrawing: null
    },

    usedDrawings: [],
    isMicActive: false,
    inputMode: 'speak', // 'speak' or 'type' - set from main.js before start()

    init() {
        this.reset();
        this.setupEventHandlers();
    },

    reset() {
        this.state = 'IDLE';
        this.data = {
            stars: 0,
            currentRound: 0,
            totalRounds: 10,
            correctGuesses: 0,
            timeouts: 0,
            currentDrawing: null
        };
        this.usedDrawings = [];
        this.isMicActive = false;
    },

    setupEventHandlers() {
        // Mic button click
        UI.onMicClick(() => this.toggleMic());

        // Text fallback input
        UI.onTextInput((text) => this.checkGuess(text));

        // Speech recognition results
        Speech.onResult((text) => this.checkGuess(text));
        Speech.onInterim((text) => UI.updateGuessDisplay(text));

        // Timer callbacks
        Timer.onTick((seconds) => {
            UI.updateTimer(seconds);
        });

        Timer.onWarning((seconds) => {
            Audio.playTick();
        });
    },

    start() {
        this.reset();
        Audio.resume();
        Audio.playStart();

        UI.showGameScreen();
        UI.updateStars(0);

        this.state = 'PLAYING';
        this.nextRound();
    },

    nextRound() {
        if (this.data.currentRound >= this.data.totalRounds) {
            this.endGame();
            return;
        }

        this.data.currentRound++;
        this.data.currentDrawing = this.selectRandomDrawing();

        if (!this.data.currentDrawing) {
            // No more drawings available
            this.endGame();
            return;
        }

        // Reset UI for new round
        UI.hideFeedback();
        UI.updateRound(this.data.currentRound);
        UI.resetTimer();
        UI.clearGuessDisplay(this.inputMode);
        UI.setMicActive(false);
        this.isMicActive = false;

        // Auto-start input based on mode
        if (this.inputMode === 'speak') {
            Audio.resume();
            const started = Speech.startListening();
            if (started) {
                UI.setMicActive(true);
                this.isMicActive = true;
            } else {
                UI.showTextFallback();
            }
        } else {
            UI.showTypingInput();
        }

        // Start drawing animation
        Drawing.startDrawing(this.data.currentDrawing, () => {
            // Drawing complete callback (optional handling)
        });

        // Start timer
        Timer.start(30, () => this.onTimeout());
    },

    selectRandomDrawing() {
        const allIds = getDrawingIds();
        const available = allIds.filter(id => !this.usedDrawings.includes(id));

        if (available.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * available.length);
        const selectedId = available[randomIndex];

        this.usedDrawings.push(selectedId);
        return DRAWINGS[selectedId];
    },

    toggleMic() {
        if (this.state !== 'PLAYING') return;
        if (this.inputMode === 'speak') return; // mic is always on in speak mode
    },

    checkGuess(spokenText) {
        if (this.state !== 'PLAYING' || !this.data.currentDrawing) return;

        const normalized = spokenText.toLowerCase().trim();
        const accepted = this.data.currentDrawing.acceptedAnswers;

        // Check if any accepted answer is contained in the spoken text
        const isCorrect = accepted.some(answer =>
            normalized.includes(answer.toLowerCase())
        );

        if (isCorrect) {
            this.onCorrectGuess();
        }
        // Don't penalize wrong guesses - just keep listening
    },

    onCorrectGuess() {
        this.state = 'ROUND_END';

        // Stop everything
        Timer.stop();
        Speech.stopListening();
        Drawing.stopDrawing();
        UI.setMicActive(false);
        this.isMicActive = false;
        if (this.inputMode === 'type') UI.hideTypingInput();

        // Update score
        this.data.stars += 1;
        this.data.correctGuesses++;

        // Play sound and show feedback
        Audio.playCorrect();
        UI.updateStars(this.data.stars);
        UI.showCorrectFeedback();

        // Next round after delay
        setTimeout(() => {
            this.state = 'PLAYING';
            this.nextRound();
        }, 2000);
    },

    onTimeout() {
        this.state = 'ROUND_END';

        // Stop everything
        Speech.stopListening();
        Drawing.stopDrawing();
        UI.setMicActive(false);
        this.isMicActive = false;
        if (this.inputMode === 'type') UI.hideTypingInput();

        // Update score (minimum 0 stars)
        this.data.stars = Math.max(0, this.data.stars - 2);
        this.data.timeouts++;

        // Play sound and show feedback
        Audio.playTimeout();
        UI.updateStars(this.data.stars);
        UI.showTimeoutFeedback(this.data.currentDrawing.name);

        // Next round after delay
        setTimeout(() => {
            this.state = 'PLAYING';
            this.nextRound();
        }, 2500);
    },

    endGame() {
        this.state = 'GAME_OVER';

        // Stop everything
        Timer.stop();
        Speech.stopListening();
        Drawing.stopDrawing();
        UI.setMicActive(false);

        // Show end screen with stats
        UI.showEndScreen({
            stars: this.data.stars,
            correct: this.data.correctGuesses,
            timeouts: this.data.timeouts,
            total: this.data.totalRounds
        });
    },

    getState() {
        return this.state;
    },

    getData() {
        return { ...this.data };
    }
};

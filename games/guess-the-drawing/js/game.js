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
    inputMode: 'pick', // 'pick', 'speak' or 'type' - set from main.js before start()
    choiceCount: 4,    // picture buttons shown in pick mode
    hintAt: 15,        // seconds left when the hint appears
    secondHintAt: 8,   // seconds left when pick mode removes another wrong picture
    roundSeconds: 30,
    hintShown: false,
    currentChoices: [],

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

        // Typed guesses (type mode, or the fallback when speech is unavailable)
        UI.onTextInput((text) => this.submitTypedGuess(text));

        // Picture buttons (pick mode)
        UI.onChoiceClick((id) => this.pickChoice(id));

        // Speech recognition results
        Speech.onResult((text) => this.checkGuess(text));
        Speech.onInterim((text) => UI.updateGuessDisplay(text));

        // Timer callbacks
        Timer.onTick((seconds) => {
            UI.updateTimer(seconds);
            if (this.state !== 'PLAYING') return;
            if (seconds === this.hintAt) this.showHint();
            if (seconds === this.secondHintAt && this.inputMode === 'pick') {
                UI.removeWrongChoice(this.data.currentDrawing.id);
            }
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
        UI.hideHint();
        UI.hideChoices();
        UI.hideMicArea();
        if (this.inputMode !== 'type') UI.hideTextFallback();
        this.isMicActive = false;
        this.hintShown = false;
        this.currentChoices = [];

        // Auto-start input based on mode
        if (this.inputMode === 'pick') {
            this.currentChoices = this.buildChoices(this.data.currentDrawing.id);
            UI.showChoices(this.currentChoices);
        } else if (this.inputMode === 'speak') {
            UI.showMicArea();
            Audio.resume();
            const started = Speech.startListening();
            if (started) {
                UI.setMicActive(true);
                this.isMicActive = true;
            } else {
                this.fallBackFromSpeech();
            }
        } else {
            UI.showTypingInput();
        }

        // Start drawing animation
        Drawing.startDrawing(this.data.currentDrawing, () => {
            // Drawing complete callback (optional handling)
        });

        // Start timer
        Timer.start(this.roundSeconds, () => this.onTimeout());
    },

    // Pick mode: the answer plus random other drawings, shuffled.
    buildChoices(answerId) {
        const others = getDrawingIds().filter(id => id !== answerId);
        for (let i = others.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [others[i], others[j]] = [others[j], others[i]];
        }
        const ids = [answerId, ...others.slice(0, this.choiceCount - 1)];
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        return ids.map(id => ({ id, name: DRAWINGS[id].name, picture: getPicture(id) }));
    },

    pickChoice(id) {
        if (this.state !== 'PLAYING' || !this.data.currentDrawing) return;
        if (id === this.data.currentDrawing.id) {
            UI.markChoice(id, true);
            this.onCorrectGuess();
        } else {
            // No penalty: the wrong picture wobbles and greys out, try again.
            UI.markChoice(id, false);
            Audio.playWrong();
        }
    },

    // Speech is unavailable or was refused: a pre-reader can still play by
    // picking the picture, and the typing box stays for older players.
    fallBackFromSpeech() {
        if (this.state !== 'PLAYING' || !this.data.currentDrawing) return;
        UI.setMicActive(false);
        this.isMicActive = false;
        UI.showTextFallback();
        if (!this.currentChoices.length) {
            this.currentChoices = this.buildChoices(this.data.currentDrawing.id);
            UI.showChoices(this.currentChoices);
        }
    },

    showHint() {
        if (this.hintShown || !this.data.currentDrawing) return;
        this.hintShown = true;
        Audio.playHint();
        if (this.inputMode === 'pick' || this.currentChoices.length) {
            UI.removeWrongChoice(this.data.currentDrawing.id);
        }
        if (this.inputMode !== 'pick') {
            UI.showHint(this.data.currentDrawing.name);
        }
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

    // The mic listens on its own in speak mode. Tapping it makes sure it is
    // (re)listening and shows a big "Say it!" cue, so the tap always does
    // something a pre-reader can see.
    toggleMic() {
        if (this.state !== 'PLAYING') return;
        if (this.inputMode !== 'speak') return;
        Audio.resume();
        if (!Speech.isListening) {
            const started = Speech.startListening();
            if (!started) {
                this.fallBackFromSpeech();
                return;
            }
        }
        UI.setMicActive(true);
        this.isMicActive = true;
        UI.pulseSayIt();
        Audio.playPop();
    },

    isMatch(text, fuzzy = false) {
        const normalized = (text || '').toLowerCase().trim();
        if (!normalized) return false;
        const accepted = this.data.currentDrawing.acceptedAnswers.map(a => a.toLowerCase());

        // Any accepted answer contained in the text
        if (accepted.some(answer => normalized.includes(answer))) return true;
        if (!fuzzy) return false;

        // Typed guesses forgive small spelling slips ("elefant", "buterfly").
        // Short words must be exact so "car" never matches "cat".
        const words = normalized.split(/[^a-z]+/).filter(Boolean);
        words.push(normalized.replace(/[^a-z]/g, ''));
        return accepted.some(answer => {
            const target = answer.replace(/[^a-z]/g, '');
            const allowed = target.length >= 8 ? 2 : target.length >= 5 ? 1 : 0;
            if (!allowed) return false;
            return words.some(w => Math.abs(w.length - target.length) <= allowed &&
                editDistance(w, target) <= allowed);
        });
    },

    checkGuess(spokenText) {
        if (this.state !== 'PLAYING' || !this.data.currentDrawing) return false;
        if (this.isMatch(spokenText)) {
            this.onCorrectGuess();
            return true;
        }
        // Don't penalize wrong guesses - just keep listening
        return false;
    },

    submitTypedGuess(text) {
        if (this.state !== 'PLAYING' || !this.data.currentDrawing) return false;
        if (!text || !text.trim()) return false;
        if (this.isMatch(text, true)) {
            this.onCorrectGuess();
            return true;
        }
        UI.showTryAgain(text.trim());
        Audio.playWrong();
        return false;
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
        UI.showCorrectFeedback(this.data.currentDrawing);

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

        // No stars are taken away: the round just ends and shows the answer
        this.data.timeouts++;

        // Play sound and show feedback
        Audio.playTimeout();
        UI.showTimeoutFeedback(this.data.currentDrawing);

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
        UI.hideChoices();
        UI.hideHint();

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

// Levenshtein distance, for forgiving typed spellings
function editDistance(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = prev[j];
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
            diag = tmp;
        }
    }
    return prev[b.length];
}

// Read-only debug view for play-test harnesses
window.__game = {
    get state() { return Game.state; },
    get mode() { return Game.inputMode; },
    get round() { return Game.data.currentRound; },
    get stars() { return Game.data.stars; },
    get correct() { return Game.data.correctGuesses; },
    get timeouts() { return Game.data.timeouts; },
    get answer() { return Game.data.currentDrawing ? Game.data.currentDrawing.id : null; },
    get choices() { return Game.currentChoices.map(c => c.id); },
    get hintShown() { return Game.hintShown; },
    get timeLeft() { return Timer.getRemainingTime(); }
};

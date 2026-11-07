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
            micArea: document.getElementById('mic-area'),
            sayBubble: document.getElementById('say-bubble'),
            choices: document.getElementById('choices'),
            hint: document.getElementById('hint'),
            guessDisplay: document.getElementById('guess-display'),
            textFallback: document.getElementById('text-fallback'),
            canvas: document.getElementById('game-canvas'),
            pencil: document.getElementById('pencil'),

            // Feedback
            feedbackOverlay: document.getElementById('feedback-overlay'),
            feedbackIcon: document.getElementById('feedback-icon'),
            feedbackText: document.getElementById('feedback-text'),
            feedbackPicture: document.getElementById('feedback-picture'),

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
            this.elements.guessDisplay.textContent = '🎤 Say what you see!';
            this.elements.guessDisplay.classList.remove('has-text');
        }
    },

    clearGuessDisplay(inputMode = 'speak') {
        const display = this.elements.guessDisplay;
        display.classList.remove('has-text', 'try-again');
        // Pick mode needs no words at all: the picture buttons are the input
        display.classList.toggle('hidden', inputMode === 'pick');
        if (inputMode === 'type') {
            display.textContent = '⌨️ Type what you see';
        } else {
            display.textContent = '🎤 Say what you see!';
        }
    },

    // Wrong typed guess: wobble the box and say so, instead of silently ignoring it
    showTryAgain(text) {
        const display = this.elements.guessDisplay;
        display.classList.remove('hidden', 'has-text');
        display.textContent = `"${text}"? Try again!`;
        this.restartAnimation(display, 'try-again');
        this.restartAnimation(this.elements.textFallback, 'shake');
    },

    restartAnimation(el, cls) {
        el.classList.remove(cls);
        void el.offsetWidth; // reflow so the animation replays
        el.classList.add(cls);
    },

    // Mic area (speak mode)
    showMicArea() {
        this.elements.micArea.classList.remove('hidden');
        this.elements.micBtn.style.display = '';
    },

    hideMicArea() {
        this.elements.micArea.classList.add('hidden');
    },

    pulseSayIt() {
        this.restartAnimation(this.elements.sayBubble, 'show');
    },

    // Picture choices (pick mode)
    showChoices(choices) {
        const box = this.elements.choices;
        box.innerHTML = '';
        choices.forEach(choice => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'choice';
            btn.dataset.id = choice.id;
            btn.setAttribute('aria-label', choice.name);
            btn.innerHTML = `<span class="choice-picture" aria-hidden="true">${choice.picture}</span><span class="choice-name">${choice.name}</span>`;
            box.appendChild(btn);
        });
        box.classList.remove('hidden');
    },

    hideChoices() {
        this.elements.choices.classList.add('hidden');
        this.elements.choices.innerHTML = '';
    },

    choiceButton(id) {
        return this.elements.choices.querySelector(`.choice[data-id="${id}"]`);
    },

    markChoice(id, correct) {
        const btn = this.choiceButton(id);
        if (!btn) return;
        if (correct) {
            btn.classList.add('right');
        } else {
            btn.disabled = true;
            this.restartAnimation(btn, 'wrong');
        }
    },

    // Hint: grey out one wrong picture that is still in play
    removeWrongChoice(answerId) {
        const left = [...this.elements.choices.querySelectorAll('.choice:not(:disabled)')]
            .filter(b => b.dataset.id !== answerId);
        if (left.length <= 1) return;
        const btn = left[Math.floor(Math.random() * left.length)];
        btn.disabled = true;
        btn.classList.add('gone');
    },

    onChoiceClick(callback) {
        // pointerdown, not click: a 5-year-old's long or wobbly press still counts
        this.elements.choices.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('.choice');
            if (!btn || btn.disabled) return;
            e.preventDefault();
            callback(btn.dataset.id);
        });
        // Keyboard users still get click (Enter / Space)
        this.elements.choices.addEventListener('click', (e) => {
            if (e.detail !== 0) return; // pointer clicks were handled on pointerdown
            const btn = e.target.closest('.choice');
            if (btn && !btn.disabled) callback(btn.dataset.id);
        });
    },

    // Hint for speak / type: the first letter and the length, "C _ _"
    showHint(name) {
        const letters = name.toUpperCase().split('');
        const shown = letters.map((ch, i) => (i === 0 ? ch : ch === ' ' ? ' ' : '_')).join(' ');
        this.elements.hint.textContent = `💡 ${shown}`;
        this.elements.hint.classList.remove('hidden');
        this.restartAnimation(this.elements.hint, 'pop');
    },

    hideHint() {
        this.elements.hint.classList.add('hidden');
        this.elements.hint.textContent = '';
    },

    // Text fallback for browsers without speech support
    showTextFallback() {
        this.elements.textFallback.classList.remove('hidden');
        this.elements.micBtn.style.display = 'none';
        this.hideMicArea();
    },

    hideTextFallback() {
        this.elements.textFallback.classList.add('hidden');
        this.elements.textFallback.value = '';
    },

    // Intentional typing mode (user chose to type)
    showTypingInput() {
        this.elements.textFallback.classList.remove('hidden');
        this.elements.textFallback.value = '';
        this.hideMicArea();
        this.elements.textFallback.focus();
    },

    hideTypingInput() {
        this.elements.textFallback.classList.add('hidden');
        this.elements.textFallback.value = '';
    },

    // Feedback overlays
    // Both feedback screens show the answer as a picture, so a pre-reader
    // knows what it was without reading the word under it.
    showCorrectFeedback(drawing) {
        this.elements.feedbackIcon.className = 'feedback-icon correct';
        this.elements.feedbackPicture.textContent = getPicture(drawing.id);
        this.elements.feedbackText.innerHTML = `${drawing.name}!<span class="answer gain">+1 <span class="star-icon">&#9733;</span></span>`;
        this.elements.feedbackOverlay.className = 'feedback-overlay is-correct';
    },

    showTimeoutFeedback(drawing) {
        this.elements.feedbackIcon.className = 'feedback-icon timeout';
        this.elements.feedbackPicture.textContent = getPicture(drawing.id);
        this.elements.feedbackText.innerHTML = `It was: ${drawing.name}<span class="answer">Next one! ➜</span>`;
        this.elements.feedbackOverlay.className = 'feedback-overlay is-timeout';
    },

    hideFeedback() {
        this.elements.feedbackOverlay.classList.add('hidden');
    },

    // Error displays
    showMicPermissionError() {
        this.elements.guessDisplay.classList.remove('hidden');
        this.elements.guessDisplay.textContent = '🎤🚫 No mic. Tap a picture or type!';
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
        this.elements.textFallback.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                callback(e.target.value);
                e.target.value = '';
            }
        });
    }
};

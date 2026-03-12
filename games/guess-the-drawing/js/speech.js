// Voice Recognition Module
// Handles Web Speech API integration

const Speech = {
    recognition: null,
    isListening: false,
    isSupported: false,
    onResultCallback: null,
    onInterimCallback: null,

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported in this browser');
            this.isSupported = false;
            return false;
        }

        this.isSupported = true;
        this.recognition = new SpeechRecognition();

        // Configuration
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 3;

        // Event handlers
        this.recognition.onresult = (event) => {
            this.handleResult(event);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            if (event.error === 'not-allowed') {
                UI.showMicPermissionError();
            } else if (event.error === 'no-speech') {
                // Restart if no speech detected
                if (this.isListening) {
                    this.restartListening();
                }
            }
        };

        this.recognition.onend = () => {
            // Auto-restart if we're supposed to be listening
            if (this.isListening) {
                this.restartListening();
            }
        };

        return true;
    },

    handleResult(event) {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // Update display with top alternative
        if (this.onInterimCallback && (interimTranscript || finalTranscript)) {
            this.onInterimCallback(interimTranscript || finalTranscript);
        }

        // Check all alternatives for final results (not just the top one)
        if (this.onResultCallback) {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    for (let j = 0; j < event.results[i].length; j++) {
                        this.onResultCallback(event.results[i][j].transcript);
                    }
                }
            }
        }

        // Also check interim transcripts to catch answers before a session restart
        if (interimTranscript && this.onResultCallback) {
            this.onResultCallback(interimTranscript);
        }
    },

    startListening() {
        if (!this.isSupported || !this.recognition) {
            console.warn('Speech recognition not available');
            return false;
        }

        if (this.isListening) return true;

        try {
            this.recognition.start();
            this.isListening = true;
            return true;
        } catch (e) {
            console.error('Failed to start speech recognition:', e);
            return false;
        }
    },

    stopListening() {
        if (!this.recognition) return;

        this.isListening = false;
        try {
            this.recognition.stop();
        } catch (e) {
            // Ignore errors when stopping
        }
    },

    restartListening() {
        if (!this.isSupported || !this.recognition) return;

        try {
            this.recognition.start();
        } catch (e) {
            // May fail if already started, that's ok
        }
    },

    onResult(callback) {
        this.onResultCallback = callback;
    },

    onInterim(callback) {
        this.onInterimCallback = callback;
    },

    clearCallbacks() {
        this.onResultCallback = null;
        this.onInterimCallback = null;
    }
};

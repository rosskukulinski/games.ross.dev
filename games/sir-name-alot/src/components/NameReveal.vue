<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  nickname: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['reset'])

const showName = ref(false)
const copied = ref(false)
const confetti = ref([])

// Generate confetti pieces
const generateConfetti = () => {
  const colors = ['#f472b6', '#22c55e', '#fef08a', '#7c3aed', '#06b6d4', '#f97316']
  const pieces = []
  for (let i = 0; i < 50; i++) {
    pieces.push({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 8 + Math.random() * 8,
      rotation: Math.random() * 360
    })
  }
  return pieces
}

onMounted(() => {
  confetti.value = generateConfetti()
  setTimeout(() => {
    showName.value = true
  }, 300)
})

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.nickname)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<template>
  <div class="reveal-container">
    <!-- Confetti -->
    <div class="confetti-container">
      <div
        v-for="piece in confetti"
        :key="piece.id"
        class="confetti-piece"
        :style="{
          left: piece.left + '%',
          animationDelay: piece.delay + 's',
          animationDuration: piece.duration + 's',
          backgroundColor: piece.color,
          width: piece.size + 'px',
          height: piece.size + 'px',
          transform: 'rotate(' + piece.rotation + 'deg)'
        }"
      />
    </div>

    <div class="intro-text" :class="{ visible: showName }">
      Yo, check it! Your new name is...
    </div>

    <div class="nickname-display" :class="{ visible: showName }">
      <span class="nickname-text">{{ nickname }}</span>
    </div>

    <div class="actions" :class="{ visible: showName }">
      <button class="action-btn copy-btn" @click="copyToClipboard">
        {{ copied ? '✅ Copied!' : '📋 Copy Name' }}
      </button>
      <button class="action-btn reset-btn" @click="$emit('reset')">
        🔄 Try Again
      </button>
    </div>

    <div class="boombox">🎧</div>
  </div>
</template>

<style scoped>
.reveal-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  position: relative;
  overflow: hidden;
  min-height: 300px;
}

.confetti-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.confetti-piece {
  position: absolute;
  top: -20px;
  border-radius: 2px;
  animation: fall linear forwards;
}

@keyframes fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(400px) rotate(720deg);
    opacity: 0;
  }
}

.intro-text {
  font-family: 'Fredoka', sans-serif;
  font-size: 1.3rem;
  color: #fef08a;
  text-shadow: 2px 2px 0 #7c3aed;
  opacity: 0;
  transform: translateY(-20px);
  transition: all 0.5s ease;
}

.intro-text.visible {
  opacity: 1;
  transform: translateY(0);
}

.nickname-display {
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  border: 6px solid #fef08a;
  border-radius: 20px;
  padding: 1.5rem 2.5rem;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  transition-delay: 0.3s;
  box-shadow:
    0 0 0 4px #f472b6,
    0 10px 30px rgba(0, 0, 0, 0.3);
}

.nickname-display.visible {
  opacity: 1;
  transform: scale(1);
}

.nickname-text {
  font-family: 'Bangers', cursive;
  font-size: 2.5rem;
  color: #22c55e;
  text-shadow:
    3px 3px 0 #166534,
    -1px -1px 0 #fef08a;
  letter-spacing: 3px;
  display: block;
  text-align: center;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

.actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.5s ease;
  transition-delay: 0.8s;
}

.actions.visible {
  opacity: 1;
  transform: translateY(0);
}

.action-btn {
  padding: 0.875rem 1.5rem;
  font-family: 'Fredoka', sans-serif;
  font-weight: 600;
  font-size: 1.1rem;
  border: 3px solid;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-btn {
  background: #22c55e;
  border-color: #16a34a;
  color: white;
}

.copy-btn:hover {
  background: #16a34a;
  transform: translateY(-2px);
}

.reset-btn {
  background: #7c3aed;
  border-color: #6d28d9;
  color: white;
}

.reset-btn:hover {
  background: #6d28d9;
  transform: translateY(-2px);
}

.boombox {
  font-size: 4rem;
  animation: bounce 1s ease-in-out infinite;
  margin-top: 1rem;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (max-width: 500px) {
  .nickname-text {
    font-size: 1.8rem;
  }

  .nickname-display {
    padding: 1rem 1.5rem;
  }
}
</style>

<script setup>
import { ref, computed } from 'vue'
import NameForm from './components/NameForm.vue'
import NameReveal from './components/NameReveal.vue'
import { generateNickname } from './data/nicknames.js'

const formData = ref(null)
const nickname = computed(() => {
  if (!formData.value) return ''
  return generateNickname(
    formData.value.name,
    formData.value.month,
    formData.value.dessert
  )
})

const handleGenerate = (data) => {
  formData.value = data
}

const handleReset = () => {
  formData.value = null
}
</script>

<template>
  <div class="app">
    <div class="background-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <header class="header">
      <h1 class="title">
        <span class="title-sir">Sir</span>
        <span class="title-name">-Name-</span>
        <span class="title-alot">Alot</span>
      </h1>
      <p class="subtitle">🎤 Get Your Fresh Hip-Hop Name! 🎤</p>
    </header>

    <main class="main-card">
      <Transition name="fade" mode="out-in">
        <NameReveal
          v-if="nickname"
          :nickname="nickname"
          @reset="handleReset"
        />
        <NameForm v-else @generate="handleGenerate" />
      </Transition>
    </main>

    <footer class="footer">
      <p>Made with 💜 and fresh beats</p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  position: relative;
  overflow: hidden;
}

.background-decoration {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.15;
  animation: float 8s ease-in-out infinite;
}

.circle-1 {
  width: 400px;
  height: 400px;
  background: #f472b6;
  top: -100px;
  right: -100px;
  animation-delay: 0s;
}

.circle-2 {
  width: 300px;
  height: 300px;
  background: #22c55e;
  bottom: -50px;
  left: -50px;
  animation-delay: 2s;
}

.circle-3 {
  width: 200px;
  height: 200px;
  background: #fef08a;
  top: 50%;
  left: 10%;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-30px) scale(1.05);
  }
}

.header {
  text-align: center;
  margin-bottom: 2rem;
  position: relative;
  z-index: 1;
}

.title {
  font-family: 'Bangers', cursive;
  font-size: 4rem;
  margin: 0;
  line-height: 1;
  letter-spacing: 4px;
}

.title-sir {
  color: #f472b6;
  text-shadow:
    4px 4px 0 #9d174d,
    -2px -2px 0 #fef08a;
}

.title-name {
  color: #fef08a;
  text-shadow:
    4px 4px 0 #a16207,
    -2px -2px 0 #f472b6;
}

.title-alot {
  color: #22c55e;
  text-shadow:
    4px 4px 0 #166534,
    -2px -2px 0 #fef08a;
}

.subtitle {
  font-family: 'Fredoka', sans-serif;
  font-size: 1.3rem;
  color: white;
  margin-top: 0.75rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.main-card {
  background: linear-gradient(145deg, rgba(124, 58, 237, 0.9) 0%, rgba(109, 40, 217, 0.95) 100%);
  border-radius: 24px;
  padding: 2rem;
  width: 100%;
  max-width: 500px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.3),
    0 0 0 4px rgba(254, 240, 138, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 1;
}

.footer {
  margin-top: auto;
  padding-top: 2rem;
  position: relative;
  z-index: 1;
}

.footer p {
  font-family: 'Fredoka', sans-serif;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

/* Transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.4s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@media (max-width: 500px) {
  .title {
    font-size: 2.8rem;
  }

  .subtitle {
    font-size: 1.1rem;
  }

  .main-card {
    padding: 1.5rem;
  }
}
</style>

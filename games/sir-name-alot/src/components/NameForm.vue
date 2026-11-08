<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { monthOptions, dessertOptions } from '../data/nicknames.js'

// One question at a time, so the big button is always on screen. The answers
// object belongs to App (it survives "Try Again"); the form edits it in place.
const props = defineProps({
  answers: { type: Object, required: true }
})
const emit = defineEmits(['generate'])
const a = props.answers

const STEPS = ['name', 'month', 'dessert']
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// Desserts are stored as "🍩 Donuts"; split off the emoji to draw it big.
const desserts = dessertOptions.map((d) => {
  const i = d.label.indexOf(' ')
  return { value: d.value, emoji: d.label.slice(0, i), word: d.label.slice(i + 1) }
})

const nameInput = ref(null)
const hint = ref(null)
let hintTimer = null
let advanceTimer = null

const done = computed(() => ({
  name: !!a.name.trim(),
  month: !!a.month,
  dessert: !!a.dessert
}))
const allDone = computed(() => STEPS.every((s) => done.value[s]))
// Only the first letter of the name matters to the generator, so the
// letter tiles and a typed name are interchangeable.
const firstLetter = computed(() => a.name.trim().charAt(0).toUpperCase())
const monthInfo = computed(() => monthOptions.find((m) => m.value === a.month))
const dessertInfo = computed(() => desserts.find((d) => d.value === a.dessert))
const nameTab = computed(() => {
  const n = a.name.trim()
  return n.length > 8 ? n.slice(0, 7) + '…' : n
})

const hints = {
  name: '👆 Type your name or tap a letter!',
  month: '👆 Tap your birthday month!',
  dessert: '👆 Tap a yummy dessert!'
}

const hasKeyboard = () => window.matchMedia?.('(pointer: fine)').matches
const focusNameIfKeyboard = () => {
  // On touch screens a focused input pops the on-screen keyboard over the
  // letter tiles, so only auto-focus when there is a real keyboard.
  if (hasKeyboard()) nextTick(() => nameInput.value?.focus())
}

const goTo = (step) => {
  clearTimeout(advanceTimer)
  a.step = step
  hint.value = null
  if (step === 'name') focusNameIfKeyboard()
}

const nextIncomplete = () => {
  const start = STEPS.indexOf(a.step)
  for (let i = 1; i <= STEPS.length; i++) {
    const s = STEPS[(start + i) % STEPS.length]
    if (!done.value[s]) return s
  }
  return null
}

// After a tap-pick, slide on to whatever is still missing.
const autoAdvance = () => {
  clearTimeout(advanceTimer)
  hint.value = null
  const next = nextIncomplete()
  if (next) advanceTimer = setTimeout(() => goTo(next), 380)
}

const pickLetter = (l) => {
  // Keep a typed name that already starts with this letter.
  if (firstLetter.value !== l) a.name = l
  autoAdvance()
}
const pickMonth = (m) => {
  a.month = m
  autoAdvance()
}
const pickDessert = (d) => {
  a.dessert = d
  // The last step ends on the big button instead of moving on.
  if (allDone.value) hint.value = null
  else autoAdvance()
}

const showHint = (step) => {
  if (a.step !== step) a.step = step
  // Re-trigger the wiggle even if the same hint is already showing.
  hint.value = null
  nextTick(() => { hint.value = step })
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = null }, 2600)
}

const mainLabel = computed(() => (allDone.value ? '🎤 Get Your Name! 🎤' : 'Next ➜'))

const handleMain = () => {
  if (allDone.value) {
    emit('generate', { name: a.name, month: a.month, dessert: a.dessert })
    return
  }
  if (!done.value[a.step]) {
    showHint(a.step)
    return
  }
  goTo(nextIncomplete())
}

// Letters typed while the name box isn't focused (a missed click) still land
// in the name instead of vanishing. Enter works as the big button.
const onKey = (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'Enter') {
    if (e.target instanceof HTMLButtonElement) return
    e.preventDefault()
    handleMain()
    return
  }
  if (a.step !== 'name' || e.target instanceof HTMLInputElement) return
  if (e.key.length === 1 && /\S/.test(e.key)) {
    e.preventDefault()
    if (a.name.length < 50) a.name += e.key
    nameInput.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (a.step === 'name') focusNameIfKeyboard()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(hintTimer)
  clearTimeout(advanceTimer)
})
</script>

<template>
  <div class="form-container">
    <nav class="steps" aria-label="Questions">
      <button
        type="button"
        class="step-tab"
        data-step="name"
        :class="{ active: a.step === 'name', done: done.name, missing: hint && !done.name }"
        @click="goTo('name')"
      >
        <span class="tab-icon">👤</span>
        <span class="tab-value">{{ done.name ? nameTab : 'Name' }}</span>
      </button>
      <button
        type="button"
        class="step-tab"
        data-step="month"
        :class="{ active: a.step === 'month', done: done.month, missing: hint && !done.month }"
        @click="goTo('month')"
      >
        <span class="tab-icon">{{ monthInfo ? monthInfo.emoji : '🎂' }}</span>
        <span class="tab-value">{{ monthInfo ? monthInfo.short : 'Month' }}</span>
      </button>
      <button
        type="button"
        class="step-tab"
        data-step="dessert"
        :class="{ active: a.step === 'dessert', done: done.dessert, missing: hint && !done.dessert }"
        @click="goTo('dessert')"
      >
        <span class="tab-icon">{{ dessertInfo ? dessertInfo.emoji : '🍰' }}</span>
        <span class="tab-value">{{ dessertInfo ? dessertInfo.word : 'Dessert' }}</span>
      </button>
    </nav>

    <div class="step-body">
      <Transition name="slide" mode="out-in">
        <section v-if="a.step === 'name'" key="name" class="form-group">
          <label for="name">What's your name? 👤</label>
          <input
            id="name"
            ref="nameInput"
            v-model="a.name"
            type="text"
            placeholder="Type your name..."
            class="input-field"
            maxlength="50"
            autocomplete="off"
            autocapitalize="words"
            enterkeyhint="next"
          />
          <p class="or-line">…or tap the first letter</p>
          <div class="letter-grid" :class="{ wiggle: hint === 'name' }">
            <button
              v-for="l in letters"
              :key="l"
              type="button"
              class="letter-btn"
              :data-letter="l"
              :class="{ selected: firstLetter === l }"
              @click="pickLetter(l)"
            >
              {{ l }}
            </button>
          </div>
        </section>

        <section v-else-if="a.step === 'month'" key="month" class="form-group">
          <label>When's your birthday? 🎂</label>
          <div class="month-grid" :class="{ wiggle: hint === 'month' }">
            <button
              v-for="m in monthOptions"
              :key="m.value"
              type="button"
              class="month-btn"
              :data-month="m.value"
              :aria-label="m.label"
              :class="{ selected: a.month === m.value }"
              @click="pickMonth(m.value)"
            >
              <span class="big-emoji">{{ m.emoji }}</span>
              <span class="tile-word">{{ m.short }}</span>
            </button>
          </div>
        </section>

        <section v-else key="dessert" class="form-group">
          <label>What's your favorite dessert? 🍰</label>
          <div class="dessert-grid" :class="{ wiggle: hint === 'dessert' }">
            <button
              v-for="d in desserts"
              :key="d.value"
              type="button"
              class="dessert-btn"
              :data-dessert="d.value"
              :class="{ selected: a.dessert === d.value }"
              @click="pickDessert(d.value)"
            >
              <span class="big-emoji">{{ d.emoji }}</span>
              <span class="tile-word">{{ d.word }}</span>
            </button>
          </div>
        </section>
      </Transition>

      <Transition name="pop">
        <div v-if="hint" class="hint-bubble" role="status">{{ hints[hint] }}</div>
      </Transition>
    </div>

    <button
      type="button"
      class="submit-btn"
      :class="{ ready: allDone, waiting: !allDone && !done[a.step] }"
      @click="handleMain"
    >
      {{ mainLabel }}
    </button>
  </div>
</template>

<style scoped>
.form-container {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

/* ---- Step tabs ---- */
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.step-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 60px;
  padding: 0.4rem 0.5rem;
  border: 3px solid rgba(254, 240, 138, 0.35);
  border-radius: 14px;
  background: rgba(30, 27, 75, 0.45);
  color: rgba(255, 255, 255, 0.8);
  font-family: 'Fredoka', sans-serif;
  font-weight: 600;
  font-size: 1.05rem;
  transition: all 0.2s ease;
  position: relative;
  min-width: 0;
  touch-action: manipulation;
}

.step-tab:active {
  transform: scale(0.95);
}

.tab-icon {
  font-size: 1.7rem;
  line-height: 1;
}

.tab-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-tab.done {
  border-color: #22c55e;
  color: white;
}

.step-tab.done::after {
  content: '✓';
  position: absolute;
  top: -10px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #22c55e;
  color: white;
  font-size: 0.9rem;
  line-height: 24px;
  text-align: center;
  box-shadow: 0 2px 0 #166534;
}

.step-tab.active {
  background: #fef08a;
  border-color: #fef08a;
  color: #1e1b4b;
  box-shadow: 0 4px 0 #a16207;
}

.step-tab.missing {
  animation: wiggle 0.5s ease-in-out 2;
  border-color: #f472b6;
}

/* ---- Step body ---- */
.step-body {
  position: relative;
  min-height: 330px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.form-group label {
  font-family: 'Fredoka', sans-serif;
  font-weight: 600;
  font-size: 1.25rem;
  color: #fef08a;
  text-shadow: 2px 2px 0 #7c3aed;
  text-align: center;
}

.input-field {
  padding: 0.8rem 1.1rem;
  font-size: 1.3rem;
  font-family: 'Fredoka', sans-serif;
  border: 4px solid #7c3aed;
  border-radius: 12px;
  background: white;
  color: #1e1b4b;
  transition: all 0.2s ease;
  min-height: 60px;
  text-align: center;
}

.input-field:focus {
  outline: none;
  border-color: #f472b6;
  box-shadow: 0 0 0 4px rgba(244, 114, 182, 0.3);
}

.or-line {
  font-family: 'Fredoka', sans-serif;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
}

/* ---- Tile grids ---- */
.letter-grid {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 0.45rem;
}

.month-grid,
.dessert-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.6rem;
}

.letter-btn,
.month-btn,
.dessert-btn {
  border: 3px solid #7c3aed;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  color: #1e1b4b;
  font-family: 'Fredoka', sans-serif;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.letter-btn {
  min-height: 58px;
  font-family: 'Bangers', cursive;
  font-size: 1.9rem;
  letter-spacing: 1px;
  line-height: 1;
}

.month-btn,
.dessert-btn {
  min-height: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.35rem 0.2rem;
}

.big-emoji {
  font-size: 2.2rem;
  line-height: 1.1;
}

.tile-word {
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
}

.letter-btn:hover,
.month-btn:hover,
.dessert-btn:hover {
  background: #fef08a;
}

.letter-btn:active,
.month-btn:active,
.dessert-btn:active {
  transform: scale(0.9);
}

.letter-btn.selected,
.month-btn.selected,
.dessert-btn.selected {
  background: #22c55e;
  border-color: #16a34a;
  color: white;
  transform: scale(1.07);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.5);
  animation: picked 0.35s ease;
}

.wiggle {
  animation: wiggle 0.5s ease-in-out 2;
}

.hint-bubble {
  position: absolute;
  left: 50%;
  top: -0.3rem;
  transform: translateX(-50%);
  background: #f472b6;
  color: white;
  font-family: 'Fredoka', sans-serif;
  font-weight: 600;
  font-size: 1.15rem;
  padding: 0.55rem 1.1rem;
  border-radius: 999px;
  border: 3px solid #fef08a;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
  z-index: 3;
  pointer-events: none;
}

/* ---- Big button (sticky, so it never hides below the fold) ---- */
.submit-btn {
  position: sticky;
  bottom: 0.5rem;
  z-index: 2;
  min-height: 72px;
  padding: 0.9rem 1.5rem;
  font-family: 'Bangers', cursive;
  font-size: 1.9rem;
  letter-spacing: 2px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
  color: white;
  cursor: pointer;
  transition: all 0.25s ease;
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
  box-shadow: 0 6px 0 #5b21b6, 0 8px 20px rgba(0, 0, 0, 0.3);
  touch-action: manipulation;
}

.submit-btn.ready {
  background: linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #db2777 100%);
  box-shadow: 0 6px 0 #9d174d, 0 8px 20px rgba(219, 39, 119, 0.4);
  animation: ready-pulse 1.3s ease-in-out infinite;
}

.submit-btn.waiting {
  opacity: 0.7;
}

.submit-btn:active {
  transform: translateY(3px);
  box-shadow: 0 3px 0 #5b21b6, 0 6px 14px rgba(0, 0, 0, 0.3);
}

.submit-btn.ready:active {
  box-shadow: 0 3px 0 #9d174d, 0 6px 16px rgba(219, 39, 119, 0.4);
}

/* ---- Animations ---- */
@keyframes wiggle {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

@keyframes picked {
  0% { transform: scale(0.9); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1.07); }
}

@keyframes ready-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.pop-enter-active,
.pop-leave-active {
  transition: all 0.2s ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) scale(0.7);
}

@media (max-width: 560px) {
  .letter-grid {
    grid-template-columns: repeat(7, 1fr);
  }

  .month-grid,
  .dessert-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .step-tab {
    flex-direction: column;
    gap: 0.1rem;
    font-size: 0.9rem;
  }

  .tab-icon {
    font-size: 1.4rem;
  }

  .submit-btn {
    font-size: 1.6rem;
  }

  .hint-bubble {
    font-size: 1rem;
    white-space: normal;
    width: 90%;
    text-align: center;
  }
}
</style>

<script setup>
import { ref } from 'vue'
import { monthOptions, dessertOptions } from '../data/nicknames.js'

const emit = defineEmits(['generate'])

const name = ref('')
const month = ref(null)
const dessert = ref(null)

const isValid = () => name.value.trim() && month.value && dessert.value

const handleSubmit = () => {
  if (isValid()) {
    emit('generate', {
      name: name.value,
      month: month.value,
      dessert: dessert.value
    })
  }
}
</script>

<template>
  <div class="form-container">
    <div class="form-group">
      <label for="name">What's your name? 👤</label>
      <input
        id="name"
        v-model="name"
        type="text"
        placeholder="Enter your name..."
        class="input-field"
        maxlength="50"
      />
    </div>

    <div class="form-group">
      <label for="month">When were you born? 🎂</label>
      <select id="month" v-model="month" class="select-field">
        <option :value="null" disabled>Pick your birth month...</option>
        <option v-for="m in monthOptions" :key="m.value" :value="m.value">
          {{ m.label }}
        </option>
      </select>
    </div>

    <div class="form-group">
      <label>What's your favorite dessert? 🍰</label>
      <div class="dessert-grid">
        <button
          v-for="d in dessertOptions"
          :key="d.value"
          type="button"
          class="dessert-btn"
          :class="{ selected: dessert === d.value }"
          @click="dessert = d.value"
        >
          {{ d.label }}
        </button>
      </div>
    </div>

    <button
      class="submit-btn"
      :disabled="!isValid()"
      @click="handleSubmit"
    >
      🎤 Get Your Name! 🎤
    </button>
  </div>
</template>

<style scoped>
.form-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-family: 'Fredoka', sans-serif;
  font-weight: 600;
  font-size: 1.2rem;
  color: #fef08a;
  text-shadow: 2px 2px 0 #7c3aed;
}

.input-field,
.select-field {
  padding: 1rem 1.25rem;
  font-size: 1.1rem;
  font-family: 'Fredoka', sans-serif;
  border: 4px solid #7c3aed;
  border-radius: 12px;
  background: white;
  color: #1e1b4b;
  transition: all 0.2s ease;
}

.input-field:focus,
.select-field:focus {
  outline: none;
  border-color: #f472b6;
  box-shadow: 0 0 0 4px rgba(244, 114, 182, 0.3);
}

.dessert-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.dessert-btn {
  padding: 0.75rem;
  font-size: 1rem;
  font-family: 'Fredoka', sans-serif;
  border: 3px solid #7c3aed;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  color: #1e1b4b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dessert-btn:hover {
  background: #fef08a;
  transform: scale(1.05);
}

.dessert-btn.selected {
  background: #22c55e;
  border-color: #16a34a;
  color: white;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
}

.submit-btn {
  margin-top: 1rem;
  padding: 1.25rem 2rem;
  font-family: 'Bangers', cursive;
  font-size: 1.8rem;
  letter-spacing: 2px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #db2777 100%);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
  box-shadow: 0 6px 0 #9d174d, 0 8px 20px rgba(219, 39, 119, 0.4);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 0 #9d174d, 0 12px 24px rgba(219, 39, 119, 0.5);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 4px 0 #9d174d, 0 6px 16px rgba(219, 39, 119, 0.4);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #9ca3af;
  box-shadow: 0 6px 0 #6b7280;
}

@media (max-width: 500px) {
  .dessert-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

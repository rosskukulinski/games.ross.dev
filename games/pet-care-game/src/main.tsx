import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { useGameStore } from './store/useGameStore'

// Read-only snapshot for play-test tooling: window.__dragon()
;(window as unknown as { __dragon: () => unknown }).__dragon = () => {
  const s = useGameStore.getState()
  return {
    screen: s.currentScreen,
    currency: s.currency,
    hatchingElement: s.hatchingElement,
    dragon: s.dragon && { name: s.dragon.name, stage: s.dragon.stage, love: s.dragon.love, stats: { ...s.dragon.stats } },
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

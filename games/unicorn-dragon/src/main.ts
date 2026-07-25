import { Game } from './Game'

declare global {
  interface Window {
    /** Debug/testing hook — used by the smoke test harness. */
    __game: Game
  }
}

const game = new Game()
window.__game = game
game.init().catch(err => {
  console.error('Failed to start Unicorn Dragon', err)
})

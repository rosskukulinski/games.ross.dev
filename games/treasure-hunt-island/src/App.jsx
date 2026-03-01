import { useState } from 'react'

function App() {
  const [started, setStarted] = useState(false)

  return (
    <div className="app">
      <h1>Treasure Hunt Island</h1>
      {!started ? (
        <div className="menu">
          <p>Explore the island and find hidden treasure!</p>
          <button onClick={() => setStarted(true)}>Start Adventure</button>
        </div>
      ) : (
        <div className="game">
          <p>The adventure begins... game coming soon!</p>
          <button onClick={() => setStarted(false)}>Back to Menu</button>
        </div>
      )}
    </div>
  )
}

export default App

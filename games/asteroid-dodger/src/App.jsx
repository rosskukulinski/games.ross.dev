import { useRef, useEffect, useState, useCallback } from 'react'

const W = 400
const H = 700
const SHIP_W = 24
const SHIP_H = 18
const FUEL_MAX = 100
const FUEL_DRAIN = 4        // per second
const FUEL_REFILL = 25
const FUEL_SCORE = 50
const SHIELD_DURATION = 3   // seconds
const SHIP_SPEED = 220      // pixels per second
const LS_KEY = 'asteroid-dodger-hs'

// Asteroid size tiers
const SIZES = [
  { r: 8,  speed: [100, 180], color: '#8a7e6b' },   // small
  { r: 14, speed: [70, 140],  color: '#6e6358' },    // medium
  { r: 22, speed: [50, 110],  color: '#5a504a' },    // large
]

function rand(min, max) { return min + Math.random() * (max - min) }
function randInt(min, max) { return Math.floor(rand(min, max + 1)) }

export default function App() {
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const [fuel, setFuel] = useState(FUEL_MAX)
  const [highScore, setHighScore] = useState(() => {
    const s = localStorage.getItem(LS_KEY)
    return s ? parseInt(s, 10) : 0
  })

  const game = useRef({
    ship: { x: 60, y: H / 2 },
    asteroids: [],
    collectibles: [],
    stars: [],
    fuel: FUEL_MAX,
    shield: 0,
    score: 0,
    elapsed: 0,
    spawnTimer: 0,
    collectibleTimer: 0,
    keys: {},
    touch: null,
    animId: null,
    lastTime: 0,
  })

  // Initialize star field
  const initStars = useCallback(() => {
    const stars = []
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        size: rand(0.5, 2),
        speed: rand(20, 60),
        layer: Math.random() < 0.3 ? 1 : 0,
      })
    }
    game.current.stars = stars
  }, [])

  const spawnAsteroid = useCallback(() => {
    const g = game.current
    const difficulty = Math.min(g.elapsed / 60, 1) // ramps over 60s
    // Bias toward larger asteroids at higher difficulty
    const sizeIdx = Math.random() < 0.3 + difficulty * 0.2
      ? randInt(1, 2)
      : 0
    const tier = SIZES[sizeIdx]
    const speedMult = 1 + difficulty * 0.8
    g.asteroids.push({
      x: W + tier.r,
      y: rand(tier.r, H - tier.r),
      r: tier.r + rand(-2, 2),
      speed: rand(tier.speed[0], tier.speed[1]) * speedMult,
      color: tier.color,
      rotation: rand(0, Math.PI * 2),
      rotSpeed: rand(-2, 2),
      vertices: generateAsteroidVerts(tier.r + rand(-2, 2)),
    })
  }, [])

  const spawnCollectible = useCallback(() => {
    const g = game.current
    const type = Math.random() < 0.7 ? 'fuel' : 'shield'
    g.collectibles.push({
      x: W + 10,
      y: rand(20, H - 20),
      type,
      speed: rand(60, 100),
      pulse: 0,
    })
  }, [])

  const startGame = useCallback(() => {
    const g = game.current
    g.ship = { x: 60, y: H / 2 }
    g.asteroids = []
    g.collectibles = []
    g.fuel = FUEL_MAX
    g.shield = 0
    g.score = 0
    g.elapsed = 0
    g.spawnTimer = 0
    g.collectibleTimer = 0
    g.keys = {}
    g.touch = null
    initStars()
    setScore(0)
    setFuel(FUEL_MAX)
    setPhase('playing')
  }, [initStars])

  const endGame = useCallback(() => {
    const g = game.current
    const finalScore = Math.floor(g.score)
    setScore(finalScore)
    setPhase('gameover')
    setHighScore(prev => {
      const best = Math.max(prev, finalScore)
      localStorage.setItem(LS_KEY, best)
      return best
    })
  }, [])

  // Keyboard input
  useEffect(() => {
    const g = game.current
    const onDown = (e) => {
      const key = e.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault()
        g.keys[key] = true
      }
    }
    const onUp = (e) => {
      g.keys[e.key.toLowerCase()] = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // Touch input
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = game.current
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect()
      const t = e.touches[0]
      return {
        x: (t.clientX - rect.left) * (W / rect.width),
        y: (t.clientY - rect.top) * (H / rect.height),
      }
    }
    const onStart = (e) => {
      e.preventDefault()
      g.touch = getPos(e)
    }
    const onMove = (e) => {
      e.preventDefault()
      if (g.touch) g.touch = getPos(e)
    }
    const onEnd = (e) => {
      e.preventDefault()
      g.touch = null
    }
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
    }
  }, [])

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const g = game.current
    g.lastTime = performance.now()

    const loop = (now) => {
      let dt = (now - g.lastTime) / 1000
      g.lastTime = now
      if (dt > 0.1) dt = 0.1  // cap delta

      // --- Update ---
      g.elapsed += dt

      // Ship movement
      let dx = 0, dy = 0
      if (g.keys['arrowleft'] || g.keys['a']) dx -= 1
      if (g.keys['arrowright'] || g.keys['d']) dx += 1
      if (g.keys['arrowup'] || g.keys['w']) dy -= 1
      if (g.keys['arrowdown'] || g.keys['s']) dy += 1

      // Touch: move ship toward touch position
      if (g.touch) {
        const tdx = g.touch.x - g.ship.x
        const tdy = g.touch.y - g.ship.y
        const dist = Math.sqrt(tdx * tdx + tdy * tdy)
        if (dist > 5) {
          dx = tdx / dist
          dy = tdy / dist
        }
      }

      // Normalize diagonal
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0) {
        dx /= len
        dy /= len
      }

      g.ship.x += dx * SHIP_SPEED * dt
      g.ship.y += dy * SHIP_SPEED * dt
      // Clamp to bounds
      g.ship.x = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, g.ship.x))
      g.ship.y = Math.max(SHIP_H / 2, Math.min(H - SHIP_H / 2, g.ship.y))

      // Fuel drain
      g.fuel -= FUEL_DRAIN * dt
      if (g.fuel <= 0) {
        g.fuel = 0
        setFuel(0)
        endGame()
        return
      }

      // Shield countdown
      if (g.shield > 0) g.shield -= dt

      // Spawn asteroids
      const difficulty = Math.min(g.elapsed / 60, 1)
      const spawnInterval = Math.max(0.3, 1.2 - difficulty * 0.7)
      g.spawnTimer += dt
      if (g.spawnTimer >= spawnInterval) {
        g.spawnTimer -= spawnInterval
        spawnAsteroid()
      }

      // Spawn collectibles
      g.collectibleTimer += dt
      const collectibleInterval = Math.max(2, 4 - difficulty * 1.5)
      if (g.collectibleTimer >= collectibleInterval) {
        g.collectibleTimer -= collectibleInterval
        spawnCollectible()
      }

      // Update asteroids
      for (let i = g.asteroids.length - 1; i >= 0; i--) {
        const a = g.asteroids[i]
        a.x -= a.speed * dt
        a.rotation += a.rotSpeed * dt
        if (a.x < -a.r * 2) {
          g.asteroids.splice(i, 1)
          continue
        }
        // Collision with ship
        const cdx = a.x - g.ship.x
        const cdy = a.y - g.ship.y
        const dist = Math.sqrt(cdx * cdx + cdy * cdy)
        if (dist < a.r + SHIP_H / 2 - 2) {
          if (g.shield > 0) {
            // Destroy asteroid on shield hit
            g.asteroids.splice(i, 1)
          } else {
            endGame()
            return
          }
        }
      }

      // Update collectibles
      for (let i = g.collectibles.length - 1; i >= 0; i--) {
        const c = g.collectibles[i]
        c.x -= c.speed * dt
        c.pulse += dt * 4
        if (c.x < -20) {
          g.collectibles.splice(i, 1)
          continue
        }
        // Collision with ship
        const cdx = c.x - g.ship.x
        const cdy = c.y - g.ship.y
        const dist = Math.sqrt(cdx * cdx + cdy * cdy)
        if (dist < 18) {
          if (c.type === 'fuel') {
            g.fuel = Math.min(FUEL_MAX, g.fuel + FUEL_REFILL)
            g.score += FUEL_SCORE
          } else {
            g.shield = SHIELD_DURATION
          }
          g.collectibles.splice(i, 1)
        }
      }

      // Update stars
      for (const star of g.stars) {
        star.x -= star.speed * dt
        if (star.x < 0) {
          star.x = W
          star.y = rand(0, H)
        }
      }

      // Score
      g.score += dt * (10 + difficulty * 20)
      setScore(Math.floor(g.score))
      setFuel(Math.round(g.fuel))

      // --- Draw ---
      ctx.imageSmoothingEnabled = false

      // Background
      ctx.fillStyle = '#0a0a1a'
      ctx.fillRect(0, 0, W, H)

      // Stars
      for (const star of g.stars) {
        const brightness = star.layer === 1 ? 255 : 120
        const alpha = 0.4 + 0.3 * Math.sin(g.elapsed * 2 + star.x)
        ctx.fillStyle = `rgba(${brightness},${brightness},${brightness + 40},${alpha})`
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), Math.ceil(star.size), Math.ceil(star.size))
      }

      // Scanline effect (subtle)
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      for (let y = 0; y < H; y += 3) {
        ctx.fillRect(0, y, W, 1)
      }

      // Asteroids
      for (const a of g.asteroids) {
        ctx.save()
        ctx.translate(Math.floor(a.x), Math.floor(a.y))
        ctx.rotate(a.rotation)
        drawAsteroid(ctx, a)
        ctx.restore()
      }

      // Collectibles
      for (const c of g.collectibles) {
        const glow = 0.6 + 0.4 * Math.sin(c.pulse)
        if (c.type === 'fuel') {
          drawFuelCell(ctx, c.x, c.y, glow)
        } else {
          drawShieldPickup(ctx, c.x, c.y, glow)
        }
      }

      // Ship
      drawShip(ctx, g.ship.x, g.ship.y, g.shield > 0, g.elapsed)

      // Fuel bar (on canvas)
      drawFuelBar(ctx, g.fuel)

      // Score on canvas
      ctx.fillStyle = '#aaffaa'
      ctx.font = '14px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`SCORE: ${Math.floor(g.score)}`, W - 10, 22)

      // Shield indicator
      if (g.shield > 0) {
        ctx.fillStyle = '#44ccff'
        ctx.textAlign = 'left'
        ctx.fillText(`SHIELD: ${g.shield.toFixed(1)}s`, 10, 42)
      }

      g.animId = requestAnimationFrame(loop)
    }

    g.animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(g.animId)
  }, [phase, endGame, spawnAsteroid, spawnCollectible])

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
      />

      {phase === 'idle' && (
        <div className="overlay">
          <div className="title">ASTEROID DODGER</div>
          <div className="subtitle">Survive the asteroid field</div>
          <div className="legend">
            <div className="legend-row">
              <span className="legend-icon ship-icon">&#9654;</span>
              <span>Arrow keys / WASD to move</span>
            </div>
            <div className="legend-row">
              <span className="legend-icon fuel-icon">&#9632;</span>
              <span>Collect fuel cells to survive</span>
            </div>
            <div className="legend-row">
              <span className="legend-icon shield-icon">&#9670;</span>
              <span>Shields grant invincibility</span>
            </div>
          </div>
          {highScore > 0 && <div className="high-score">BEST: {highScore}</div>}
          <button className="start-btn" onClick={startGame}>START</button>
          <div className="touch-hint">Touch &amp; drag on mobile</div>
        </div>
      )}

      {phase === 'gameover' && (
        <div className="overlay">
          <div className="title gameover-title">GAME OVER</div>
          <div className="final-score">SCORE: {score}</div>
          {score >= highScore && score > 0 && (
            <div className="new-best">NEW BEST!</div>
          )}
          <div className="high-score">BEST: {highScore}</div>
          <button className="start-btn" onClick={startGame}>RETRY</button>
        </div>
      )}
    </div>
  )
}

// --- Drawing helpers ---

function generateAsteroidVerts(radius) {
  const count = randInt(6, 9)
  const verts = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    const r = radius * rand(0.7, 1.3)
    verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
  }
  return verts
}

function drawAsteroid(ctx, a) {
  const v = a.vertices
  // Main body
  ctx.beginPath()
  ctx.moveTo(Math.floor(v[0].x), Math.floor(v[0].y))
  for (let i = 1; i < v.length; i++) {
    ctx.lineTo(Math.floor(v[i].x), Math.floor(v[i].y))
  }
  ctx.closePath()
  ctx.fillStyle = a.color
  ctx.fill()
  // Highlight edge
  ctx.strokeStyle = '#9e9585'
  ctx.lineWidth = 1
  ctx.stroke()
  // Crater dots
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(-2, -1, 3, 2)
  ctx.fillRect(3, 2, 2, 2)
}

function drawShip(ctx, x, y, shielded, elapsed) {
  const sx = Math.floor(x)
  const sy = Math.floor(y)

  // Engine flame
  const flicker = Math.sin(elapsed * 30) > 0 ? 2 : 0
  ctx.fillStyle = '#ff6622'
  ctx.fillRect(sx - 14, sy - 2, 4 + flicker, 4)
  ctx.fillStyle = '#ffcc00'
  ctx.fillRect(sx - 12, sy - 1, 3, 2)

  // Body
  ctx.fillStyle = '#ccccdd'
  ctx.fillRect(sx - 8, sy - 6, 16, 12)
  // Nose
  ctx.fillStyle = '#eeeeff'
  ctx.fillRect(sx + 8, sy - 3, 4, 6)
  ctx.fillRect(sx + 12, sy - 1, 2, 2)
  // Cockpit
  ctx.fillStyle = '#44ccff'
  ctx.fillRect(sx + 4, sy - 2, 4, 4)
  // Wings
  ctx.fillStyle = '#8888aa'
  ctx.fillRect(sx - 4, sy - 9, 10, 3)
  ctx.fillRect(sx - 4, sy + 6, 10, 3)
  // Wing tips
  ctx.fillStyle = '#ff4444'
  ctx.fillRect(sx - 4, sy - 9, 2, 2)
  ctx.fillRect(sx - 4, sy + 7, 2, 2)

  // Shield bubble
  if (shielded) {
    const pulse = 0.3 + 0.2 * Math.sin(elapsed * 8)
    ctx.strokeStyle = `rgba(68,204,255,${pulse})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(sx, sy, 18, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = `rgba(68,204,255,${pulse * 0.3})`
    ctx.fill()
  }
}

function drawFuelCell(ctx, x, y, glow) {
  const fx = Math.floor(x)
  const fy = Math.floor(y)
  // Glow
  ctx.fillStyle = `rgba(0,255,100,${glow * 0.15})`
  ctx.fillRect(fx - 8, fy - 8, 16, 16)
  // Body
  ctx.fillStyle = `rgb(0,${Math.floor(180 + 75 * glow)},60)`
  ctx.fillRect(fx - 5, fy - 5, 10, 10)
  // Inner
  ctx.fillStyle = '#aaffaa'
  ctx.fillRect(fx - 2, fy - 4, 4, 8)
  ctx.fillRect(fx - 4, fy - 2, 8, 4)
}

function drawShieldPickup(ctx, x, y, glow) {
  const fx = Math.floor(x)
  const fy = Math.floor(y)
  // Glow
  ctx.fillStyle = `rgba(68,204,255,${glow * 0.15})`
  ctx.fillRect(fx - 8, fy - 8, 16, 16)
  // Diamond shape using rects (pixel style)
  const c = `rgb(${Math.floor(40 + 28 * glow)},${Math.floor(180 + 75 * glow)},255)`
  ctx.fillStyle = c
  ctx.fillRect(fx - 1, fy - 6, 2, 2)
  ctx.fillRect(fx - 3, fy - 4, 6, 2)
  ctx.fillRect(fx - 5, fy - 2, 10, 4)
  ctx.fillRect(fx - 3, fy + 2, 6, 2)
  ctx.fillRect(fx - 1, fy + 4, 2, 2)
  // Highlight
  ctx.fillStyle = '#aaeeff'
  ctx.fillRect(fx - 1, fy - 2, 2, 2)
}

function drawFuelBar(ctx, fuel) {
  const barW = 120
  const barH = 8
  const bx = 10
  const by = 14
  // Label
  ctx.fillStyle = '#88aa88'
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('FUEL', bx, by - 2)
  // Background
  ctx.fillStyle = '#1a1a2a'
  ctx.fillRect(bx, by, barW, barH)
  ctx.strokeStyle = '#334'
  ctx.lineWidth = 1
  ctx.strokeRect(bx, by, barW, barH)
  // Fill
  const pct = fuel / FUEL_MAX
  const color = pct > 0.5 ? '#00cc44' : pct > 0.25 ? '#ccaa00' : '#ff3322'
  ctx.fillStyle = color
  ctx.fillRect(bx + 1, by + 1, (barW - 2) * pct, barH - 2)
}

import { useRef, useEffect, useState, useCallback } from 'react'

const W = 400
const H = 700
const SHIP_W = 24
const SHIP_H = 18
const FUEL_MAX = 100
// 2/s gives ~50s on a full tank. At the old 4/s every run that missed the
// green cells ended at ~24s with an unexplained GAME OVER.
const FUEL_DRAIN = 2        // per second
const FUEL_REFILL = 25
const FUEL_SCORE = 50
const SHIELD_DURATION = 3   // seconds
const SHIP_SPEED = 240      // keyboard speed, pixels per second
// Touch: the ship eases toward its target this fast (1/s) up to a top speed,
// so a tap anywhere gets it there in a fraction of a second.
const TOUCH_EASE = 12
const TOUCH_MAX_SPEED = 900
// A touch this close to the ship grabs it and drags it relative to the
// finger, so the finger never hides the ship.
const GRAB_RADIUS = 90
// Hit radius is 25% smaller than the drawn sprite, so near misses count.
const HIT_SCALE = 0.75
const PICKUP_RADIUS = 28
// First fuel cell arrives early so the player learns green = fuel.
const FIRST_PICKUP_AT = 1.5
const EASY_START = 10       // seconds before difficulty starts ramping
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
  const [deathReason, setDeathReason] = useState(null) // 'crash' | 'fuel'
  const [retryReady, setRetryReady] = useState(true)
  const phaseRef = useRef('idle')
  phaseRef.current = phase
  const isTouch = useRef(
    typeof window !== 'undefined' &&
    (('ontouchstart' in window) || window.matchMedia?.('(pointer: coarse)').matches)
  ).current
  const [highScore, setHighScore] = useState(() => {
    const s = localStorage.getItem(LS_KEY)
    return s ? parseInt(s, 10) : 0
  })

  const game = useRef({
    ship: { x: 60, y: H / 2 },
    asteroids: [],
    collectibles: [],
    pops: [],
    stars: [],
    fuel: FUEL_MAX,
    shield: 0,
    score: 0,
    elapsed: 0,
    spawnTimer: 0,
    collectibleTimer: 0,
    pickupsSpawned: 0,
    keys: {},
    reason: null,
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
    const difficulty = difficultyAt(g.elapsed)
    // Bias toward larger asteroids at higher difficulty
    const sizeIdx = Math.random() < 0.3 + difficulty * 0.2
      ? randInt(1, 2)
      : 0
    const tier = SIZES[sizeIdx]
    const speedMult = 0.8 + difficulty * 1.0
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
    // The first pickup is always fuel, flying straight at the ship; after that
    // fuel gets likelier the emptier the tank is.
    const first = g.pickupsSpawned === 0
    const fuelChance = g.fuel < FUEL_MAX * 0.5 ? 0.85 : 0.7
    const type = first || Math.random() < fuelChance ? 'fuel' : 'shield'
    g.pickupsSpawned++
    g.collectibles.push({
      x: W + 16,
      y: first ? g.ship.y : rand(30, H - 30),
      type,
      speed: rand(60, 100),
      pulse: 0,
    })
  }, [])

  const startGame = useCallback(() => {
    // the arcade score card from the last game shouldn't sit over the new one
    window.Arcade?.dismiss?.()
    const g = game.current
    g.ship = { x: 60, y: H / 2 }
    g.asteroids = []
    g.collectibles = []
    g.pops = []
    g.fuel = FUEL_MAX
    g.shield = 0
    g.score = 0
    g.elapsed = 0
    g.spawnTimer = 0
    g.collectibleTimer = 0
    g.pickupsSpawned = 0
    g.keys = {}
    g.touch = null
    g.reason = null
    initStars()
    setScore(0)
    setFuel(FUEL_MAX)
    setDeathReason(null)
    setPhase('playing')
  }, [initStars])

  const endGame = useCallback((reason) => {
    const g = game.current
    const finalScore = Math.floor(g.score)
    g.reason = reason
    g.touch = null
    setScore(finalScore)
    setDeathReason(reason)
    // A finger still held down from steering shouldn't restart straight away.
    setRetryReady(false)
    setTimeout(() => setRetryReady(true), 700)
    setPhase('gameover')
    setHighScore(prev => {
      const best = Math.max(prev, finalScore)
      localStorage.setItem(LS_KEY, best)
      return best
    })
    window.Arcade?.submit({ game: 'asteroid-dodger', value: finalScore })
  }, [])

  // Read-only state for play-testing tools.
  useEffect(() => {
    const g = game.current
    window.__game = Object.freeze({
      get phase() { return phaseRef.current },
      get alive() { return phaseRef.current === 'playing' },
      get score() { return Math.floor(g.score) },
      get fuel() { return Math.round(g.fuel) },
      get shield() { return Math.max(0, g.shield) },
      get elapsed() { return g.elapsed },
      get reason() { return g.reason },
      get ship() { return { x: g.ship.x, y: g.ship.y } },
      get asteroids() { return g.asteroids.map(a => ({ x: a.x, y: a.y, r: a.r })) },
      get pickups() { return g.collectibles.map(c => ({ x: c.x, y: c.y, type: c.type })) },
    })
    return () => { delete window.__game }
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
    // Touch near the ship grabs it: the ship follows the finger's movement,
    // keeping its offset, so the finger never covers it. Touch anywhere else
    // and the ship flies there; dragging from there steers it the same way.
    const onStart = (e) => {
      e.preventDefault()
      const p = getPos(e)
      const near = Math.hypot(p.x - g.ship.x, p.y - g.ship.y) < GRAB_RADIUS
      g.touch = {
        finger: p,
        start: p,
        anchor: near ? { x: g.ship.x, y: g.ship.y } : { x: p.x, y: p.y },
        target: near ? { x: g.ship.x, y: g.ship.y } : { x: p.x, y: p.y },
        age: 0,
      }
    }
    const onMove = (e) => {
      e.preventDefault()
      const t = g.touch
      if (!t) return
      const p = getPos(e)
      t.finger = p
      t.target = { x: t.anchor.x + (p.x - t.start.x), y: t.anchor.y + (p.y - t.start.y) }
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

      // Normalize diagonal
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0) {
        dx /= len
        dy /= len
      }

      if (g.touch) {
        // Touch: ease toward the target, fast when far, gentle when close.
        const t = g.touch
        t.age += dt
        const tx = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, t.target.x))
        const ty = Math.max(SHIP_H / 2, Math.min(H - SHIP_H / 2, t.target.y))
        let vx = (tx - g.ship.x) * TOUCH_EASE
        let vy = (ty - g.ship.y) * TOUCH_EASE
        const v = Math.hypot(vx, vy)
        if (v > TOUCH_MAX_SPEED) { vx *= TOUCH_MAX_SPEED / v; vy *= TOUCH_MAX_SPEED / v }
        g.ship.x += vx * dt
        g.ship.y += vy * dt
      } else {
        g.ship.x += dx * SHIP_SPEED * dt
        g.ship.y += dy * SHIP_SPEED * dt
      }
      // Clamp to bounds
      g.ship.x = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, g.ship.x))
      g.ship.y = Math.max(SHIP_H / 2, Math.min(H - SHIP_H / 2, g.ship.y))

      // Fuel drain
      g.fuel -= FUEL_DRAIN * dt
      if (g.fuel <= 0) {
        g.fuel = 0
        setFuel(0)
        endGame('fuel')
        return
      }

      // Shield countdown
      if (g.shield > 0) g.shield -= dt

      // Spawn asteroids
      const difficulty = difficultyAt(g.elapsed)
      const spawnInterval = Math.max(0.3, 1.5 - difficulty * 1.0)
      g.spawnTimer += dt
      if (g.spawnTimer >= spawnInterval) {
        g.spawnTimer -= spawnInterval
        spawnAsteroid()
      }

      // Spawn collectibles
      g.collectibleTimer += dt
      const collectibleInterval = Math.max(2, 4 - difficulty * 1.5)
      if (g.pickupsSpawned === 0) {
        if (g.elapsed >= FIRST_PICKUP_AT) { g.collectibleTimer = 0; spawnCollectible() }
      } else if (g.collectibleTimer >= collectibleInterval) {
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
        if (dist < (a.r + SHIP_H / 2 - 2) * HIT_SCALE) {
          if (g.shield > 0) {
            // Destroy asteroid on shield hit
            g.asteroids.splice(i, 1)
          } else {
            endGame('crash')
            return
          }
        }
      }

      // Update collectibles
      for (let i = g.collectibles.length - 1; i >= 0; i--) {
        const c = g.collectibles[i]
        c.x -= c.speed * dt
        c.pulse += dt * 4
        if (c.x < -30) {
          g.collectibles.splice(i, 1)
          continue
        }
        // Collision with ship
        const cdx = c.x - g.ship.x
        const cdy = c.y - g.ship.y
        const dist = Math.sqrt(cdx * cdx + cdy * cdy)
        if (dist < PICKUP_RADIUS) {
          if (c.type === 'fuel') {
            g.fuel = Math.min(FUEL_MAX, g.fuel + FUEL_REFILL)
            g.score += FUEL_SCORE
          } else {
            g.shield = SHIELD_DURATION
          }
          g.pops.push({ x: c.x, y: c.y, type: c.type, t: 0 })
          g.collectibles.splice(i, 1)
        }
      }

      // Pickup pop effects
      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].t += dt
        if (g.pops[i].t > 0.6) g.pops.splice(i, 1)
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

      // Pickup pops: an expanding ring and "+" so every catch is visible
      for (const p of g.pops) {
        const k = p.t / 0.6
        const col = p.type === 'fuel' ? '0,255,120' : '68,204,255'
        ctx.strokeStyle = `rgba(${col},${1 - k})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(p.x, p.y, 10 + k * 30, 0, Math.PI * 2)
        ctx.stroke()
        if (p.type === 'fuel') {
          ctx.fillStyle = `rgba(170,255,170,${1 - k})`
          ctx.font = 'bold 20px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`+${FUEL_SCORE}`, p.x, p.y - 18 - k * 24)
        }
      }

      // Low fuel: a green arrow by the ship points at the nearest fuel cell
      const low = g.fuel < FUEL_MAX * 0.3
      if (low) {
        let best = null, bd = Infinity
        for (const c of g.collectibles) {
          if (c.type !== 'fuel' || c.x < g.ship.x - 20) continue
          const d = Math.hypot(c.x - g.ship.x, c.y - g.ship.y)
          if (d < bd) { bd = d; best = c }
        }
        if (best) drawPointer(ctx, g.ship.x, g.ship.y, best.x, best.y, g.elapsed)
      }

      // Touch feedback: a soft ring where the finger is
      if (g.touch) {
        const f = g.touch.finger
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(f.x, f.y, 22, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Ship
      drawShip(ctx, g.ship.x, g.ship.y, g.shield > 0, g.elapsed, g.shield)

      // Fuel bar (on canvas)
      drawFuelBar(ctx, g.fuel, g.elapsed)

      // Score on canvas
      ctx.fillStyle = '#aaffaa'
      ctx.font = 'bold 22px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${Math.floor(g.score)}`, W - 12, 34)

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
          <div className="legend">
            <div className="legend-card">
              <ShipIcon />
              <span className="legend-word">{isTouch ? 'DRAG' : 'ARROWS'}</span>
            </div>
            <div className="legend-card good">
              <FuelIcon />
              <span className="legend-word">FUEL</span>
            </div>
            <div className="legend-card good">
              <ShieldIcon />
              <span className="legend-word">SHIELD</span>
            </div>
            <div className="legend-card bad">
              <RockIcon />
              <span className="legend-word">DODGE</span>
            </div>
          </div>
          {highScore > 0 && <div className="high-score">BEST: {highScore}</div>}
          <button className="start-btn" onClick={startGame}>
            <PlayIcon /> START
          </button>
        </div>
      )}

      {phase === 'gameover' && (
        <div className="overlay">
          <div className="title gameover-title">GAME OVER</div>
          <div className={`reason ${deathReason === 'fuel' ? 'reason-fuel' : 'reason-crash'}`}>
            {deathReason === 'fuel' ? <EmptyFuelIcon /> : <RockIcon big />}
            <span>{deathReason === 'fuel' ? 'OUT OF FUEL' : 'CRASH!'}</span>
          </div>
          {deathReason === 'fuel' && (
            <div className="reason-tip"><FuelIcon small /> = more fuel</div>
          )}
          <div className="final-score">SCORE: {score}</div>
          {score >= highScore && score > 0 && (
            <div className="new-best">NEW BEST!</div>
          )}
          <div className="high-score">BEST: {highScore}</div>
          <button
            className="start-btn"
            onClick={startGame}
            disabled={!retryReady}
          >
            <RetryIcon /> RETRY
          </button>
        </div>
      )}
    </div>
  )
}

// --- Overlay icons (pixel style, matching the canvas sprites) ---

function ShipIcon() {
  return (
    <svg className="icon" viewBox="-16 -10 32 20" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="-14" y="-2" width="5" height="4" fill="#ff6622" />
      <rect x="-12" y="-1" width="3" height="2" fill="#ffcc00" />
      <rect x="-8" y="-6" width="16" height="12" fill="#ccccdd" />
      <rect x="8" y="-3" width="4" height="6" fill="#eeeeff" />
      <rect x="12" y="-1" width="2" height="2" fill="#eeeeff" />
      <rect x="4" y="-2" width="4" height="4" fill="#44ccff" />
      <rect x="-4" y="-9" width="10" height="3" fill="#8888aa" />
      <rect x="-4" y="6" width="10" height="3" fill="#8888aa" />
      <rect x="-4" y="-9" width="2" height="2" fill="#ff4444" />
      <rect x="-4" y="7" width="2" height="2" fill="#ff4444" />
    </svg>
  )
}

function FuelIcon({ small }) {
  return (
    <svg className={small ? 'icon icon-small' : 'icon'} viewBox="-12 -12 24 24" shapeRendering="crispEdges" aria-hidden="true">
      <circle r="12" fill="rgba(0,255,100,0.18)" />
      <rect x="-8" y="-8" width="16" height="16" fill="#00e050" />
      <rect x="-2" y="-6" width="4" height="12" fill="#aaffaa" />
      <rect x="-6" y="-2" width="12" height="4" fill="#aaffaa" />
    </svg>
  )
}

function EmptyFuelIcon() {
  return (
    <svg className="icon icon-big" viewBox="-14 -14 28 28" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="-10" y="-10" width="20" height="20" fill="#1a1a2a" stroke="#ff4433" strokeWidth="2" />
      <rect x="-7" y="5" width="3" height="3" fill="#ff4433" />
      <line x1="-12" y1="12" x2="12" y2="-12" stroke="#ff4433" strokeWidth="3" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="icon" viewBox="-12 -12 24 24" shapeRendering="crispEdges" aria-hidden="true">
      <circle r="12" fill="rgba(68,204,255,0.18)" />
      <rect x="-2" y="-10" width="4" height="4" fill="#44ddff" />
      <rect x="-5" y="-7" width="10" height="4" fill="#44ddff" />
      <rect x="-9" y="-3" width="18" height="6" fill="#44ddff" />
      <rect x="-5" y="3" width="10" height="4" fill="#44ddff" />
      <rect x="-2" y="6" width="4" height="4" fill="#44ddff" />
      <rect x="-2" y="-3" width="4" height="4" fill="#aaeeff" />
    </svg>
  )
}

function RockIcon({ big }) {
  return (
    <svg className={big ? 'icon icon-big' : 'icon'} viewBox="-13 -13 26 26" aria-hidden="true">
      <polygon points="-10,-4 -4,-11 6,-9 11,-1 8,9 -2,11 -10,6" fill="#6e6358" stroke="#9e9585" strokeWidth="1.2" />
      <rect x="-3" y="-2" width="4" height="3" fill="rgba(0,0,0,0.3)" />
      <rect x="4" y="3" width="3" height="3" fill="rgba(0,0,0,0.3)" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg className="btn-icon" viewBox="0 0 10 10" aria-hidden="true">
      <polygon points="1,0 10,5 1,10" fill="currentColor" />
    </svg>
  )
}

function RetryIcon() {
  return (
    <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4a8 8 0 1 0 8 8" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <polygon points="12,0 18,4 12,8" fill="currentColor" />
    </svg>
  )
}

// 0 for the first EASY_START seconds, then ramps to 1 over the next 60s.
function difficultyAt(elapsed) {
  return Math.max(0, Math.min((elapsed - EASY_START) / 60, 1))
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

function drawShip(ctx, x, y, shielded, elapsed, shieldLeft = 0) {
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
    // Time left, as a ring that shrinks: readable without numbers
    ctx.strokeStyle = 'rgba(68,204,255,0.9)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(sx, sy, 23, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (shieldLeft / SHIELD_DURATION))
    ctx.stroke()
  }
}

// Pickups are drawn at 2x the old pixel size so kids can spot them.
function drawFuelCell(ctx, x, y, glow) {
  const fx = Math.floor(x)
  const fy = Math.floor(y)
  // Glow
  ctx.fillStyle = `rgba(0,255,100,${glow * 0.18})`
  ctx.beginPath()
  ctx.arc(fx, fy, 20 + glow * 4, 0, Math.PI * 2)
  ctx.fill()
  // Body
  ctx.fillStyle = `rgb(0,${Math.floor(180 + 75 * glow)},60)`
  ctx.fillRect(fx - 10, fy - 10, 20, 20)
  // Inner
  ctx.fillStyle = '#aaffaa'
  ctx.fillRect(fx - 3, fy - 8, 6, 16)
  ctx.fillRect(fx - 8, fy - 3, 16, 6)
}

function drawShieldPickup(ctx, x, y, glow) {
  const fx = Math.floor(x)
  const fy = Math.floor(y)
  // Glow
  ctx.fillStyle = `rgba(68,204,255,${glow * 0.18})`
  ctx.beginPath()
  ctx.arc(fx, fy, 20 + glow * 4, 0, Math.PI * 2)
  ctx.fill()
  // Diamond shape using rects (pixel style)
  const c = `rgb(${Math.floor(40 + 28 * glow)},${Math.floor(180 + 75 * glow)},255)`
  ctx.fillStyle = c
  ctx.fillRect(fx - 2, fy - 12, 4, 4)
  ctx.fillRect(fx - 6, fy - 8, 12, 4)
  ctx.fillRect(fx - 10, fy - 4, 20, 8)
  ctx.fillRect(fx - 6, fy + 4, 12, 4)
  ctx.fillRect(fx - 2, fy + 8, 4, 4)
  // Highlight
  ctx.fillStyle = '#aaeeff'
  ctx.fillRect(fx - 2, fy - 4, 4, 4)
}

// Pulsing green chevron next to the ship, pointing at a fuel cell.
function drawPointer(ctx, sx, sy, tx, ty, elapsed) {
  const ang = Math.atan2(ty - sy, tx - sx)
  const d = 30 + 4 * Math.sin(elapsed * 10)
  ctx.save()
  ctx.translate(sx + Math.cos(ang) * d, sy + Math.sin(ang) * d)
  ctx.rotate(ang)
  ctx.fillStyle = `rgba(80,255,140,${0.6 + 0.4 * Math.sin(elapsed * 10)})`
  ctx.beginPath()
  ctx.moveTo(10, 0)
  ctx.lineTo(-6, -9)
  ctx.lineTo(-6, 9)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Fuel gauge: a fuel-cell icon and a fat bar. Below 25% the bar and its
// frame flash red, so running low is obvious without reading.
function drawFuelBar(ctx, fuel, elapsed) {
  const bx = 40
  const by = 16
  const barW = 170
  const barH = 20
  const pct = fuel / FUEL_MAX
  const low = pct <= 0.25
  const flashOn = low && Math.floor(elapsed * 4) % 2 === 0
  drawFuelCell(ctx, 20, by + barH / 2, 0.6)
  // Background
  ctx.fillStyle = flashOn ? '#4a0a0a' : '#1a1a2a'
  ctx.fillRect(bx, by, barW, barH)
  ctx.strokeStyle = low ? (flashOn ? '#ff5544' : '#882222') : '#445'
  ctx.lineWidth = 2
  ctx.strokeRect(bx, by, barW, barH)
  // Fill
  const color = pct > 0.5 ? '#00cc44' : pct > 0.25 ? '#ccaa00' : (flashOn ? '#ff6644' : '#cc2211')
  ctx.fillStyle = color
  ctx.fillRect(bx + 2, by + 2, (barW - 4) * pct, barH - 4)
}

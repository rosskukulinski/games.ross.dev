import { useEffect, useRef, useState, useCallback } from 'react'
import { getLevelTree, getLevelForkCount, LEVELS } from './levels'

const W = 400, H = 700
const TOTAL_LEVELS = LEVELS.length
const STORAGE_KEY = 'egg-water-stars'

// ── helpers ──
function loadProgress() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (Array.isArray(d) && d.length === TOTAL_LEVELS) return d
  } catch {}
  return Array(TOTAL_LEVELS).fill(0)
}
function saveProgress(stars) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stars))
}

// Layout a binary tree into positioned nodes for the canvas.
// Returns flat array of { type, x, y, left, right, label, emoji, depth }
function layoutTree(root) {
  const nodes = []
  const topY = 80
  const bottomY = H - 100
  // count depth
  function maxDepth(n) {
    if (!n || n.type !== 'fork') return 0
    return 1 + Math.max(maxDepth(n.left), maxDepth(n.right))
  }
  const depth = maxDepth(root)
  const rowH = depth > 0 ? (bottomY - topY) / depth : 200

  function walk(node, cx, d, spread) {
    if (!node) return null
    const y = topY + d * rowH
    const idx = nodes.length
    const n = { ...node, x: cx, y, idx, depth: d }
    nodes.push(n)
    if (node.type === 'fork') {
      const childSpread = spread * 0.52
      n.leftIdx = walk(node.left, cx - spread, d + 1, childSpread)
      n.rightIdx = walk(node.right, cx + spread, d + 1, childSpread)
    }
    return idx
  }
  walk(root, W / 2, 0, W * 0.22)
  return nodes
}

// ── drawing functions ──
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawBackground(ctx, t) {
  // sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#87CEEB')
  grad.addColorStop(0.6, '#B0E0E6')
  grad.addColorStop(1, '#90EE90')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // clouds
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  for (let i = 0; i < 3; i++) {
    const cx = ((t * 0.01 + i * 150) % (W + 80)) - 40
    const cy = 30 + i * 25
    ctx.beginPath()
    ctx.ellipse(cx, cy, 30, 14, 0, 0, Math.PI * 2)
    ctx.ellipse(cx + 20, cy - 4, 22, 12, 0, 0, Math.PI * 2)
    ctx.ellipse(cx - 18, cy + 2, 20, 10, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawRamp(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = '#8B6914'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  // gentle curve
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 + 10
  ctx.quadraticCurveTo(mx, my, x2, y2)
  ctx.stroke()

  // wood grain lines
  ctx.strokeStyle = 'rgba(139,105,20,0.3)'
  ctx.lineWidth = 2
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath()
    const off = i * 2 - 3
    ctx.moveTo(x1 + off, y1 + off)
    ctx.quadraticCurveTo(mx + off, my + off, x2 + off, y2 + off)
    ctx.stroke()
  }
}

function drawEgg(ctx, x, y, rotation, expression) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  // egg body
  ctx.fillStyle = '#FFF8DC'
  ctx.beginPath()
  ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#DEB887'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // blush
  ctx.fillStyle = 'rgba(255,182,193,0.4)'
  ctx.beginPath()
  ctx.ellipse(-8, 4, 4, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(8, 4, 4, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()

  // eyes
  ctx.fillStyle = '#333'
  if (expression === 'happy' || expression === 'excited') {
    // happy eyes (arcs)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#333'
    ctx.beginPath()
    ctx.arc(-5, -3, 3, Math.PI, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(5, -3, 3, Math.PI, 0)
    ctx.stroke()
  } else if (expression === 'scared') {
    // wide eyes
    ctx.beginPath()
    ctx.ellipse(-5, -3, 3.5, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(-4, -4, 1.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.ellipse(5, -3, 3.5, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(6, -4, 1.2, 0, Math.PI * 2)
    ctx.fill()
  } else if (expression === 'confused') {
    ctx.beginPath()
    ctx.arc(-5, -3, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(5, -2, 3, 0, Math.PI * 2)
    ctx.fill()
    // raised brow
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(3, -8)
    ctx.lineTo(8, -9)
    ctx.stroke()
  } else {
    // neutral
    ctx.beginPath()
    ctx.arc(-5, -3, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(5, -3, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  // mouth
  if (expression === 'excited') {
    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.ellipse(0, 5, 4, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FF6B6B'
    ctx.beginPath()
    ctx.ellipse(0, 5, 3, 2, 0, 0, Math.PI)
    ctx.fill()
  } else if (expression === 'scared') {
    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.ellipse(0, 6, 3, 4, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (expression === 'happy') {
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, 3, 4, 0.1, Math.PI - 0.1)
    ctx.stroke()
  } else {
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-3, 5)
    ctx.lineTo(3, 5)
    ctx.stroke()
  }

  ctx.restore()
}

function drawHome(ctx, x, y, t) {
  // warm glow
  const glow = ctx.createRadialGradient(x, y, 5, x, y, 50)
  glow.addColorStop(0, 'rgba(255,220,100,0.4)')
  glow.addColorStop(1, 'rgba(255,220,100,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, 50, 0, Math.PI * 2)
  ctx.fill()

  // house body
  ctx.fillStyle = '#FFE4B5'
  drawRoundRect(ctx, x - 25, y - 15, 50, 35, 4)
  ctx.fill()
  ctx.strokeStyle = '#CD853F'
  ctx.lineWidth = 2
  ctx.stroke()

  // roof
  ctx.fillStyle = '#CD5C5C'
  ctx.beginPath()
  ctx.moveTo(x - 30, y - 15)
  ctx.lineTo(x, y - 38)
  ctx.lineTo(x + 30, y - 15)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#8B3A3A'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // door
  ctx.fillStyle = '#8B4513'
  drawRoundRect(ctx, x - 7, y + 2, 14, 18, 2)
  ctx.fill()

  // window
  ctx.fillStyle = '#FFFACD'
  ctx.fillRect(x + 10, y - 8, 10, 10)
  ctx.strokeStyle = '#8B6914'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 10, y - 8, 10, 10)
  ctx.beginPath()
  ctx.moveTo(x + 15, y - 8)
  ctx.lineTo(x + 15, y + 2)
  ctx.stroke()

  // mom & dad eggs peeking
  const bob = Math.sin(t * 0.003) * 2
  drawEgg(ctx, x - 14, y - 18 + bob, -0.15, 'happy')
  drawEgg(ctx, x + 14, y - 18 - bob, 0.15, 'happy')

  // "HOME" label
  ctx.fillStyle = '#8B4513'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('HOME', x, y + 32)
}

function drawDeadEnd(ctx, x, y, emoji, label) {
  // background circle
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.arc(x, y, 24, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // emoji
  ctx.font = '24px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, x, y)

  // label
  ctx.fillStyle = '#555'
  ctx.font = '9px sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(label, x, y + 28)
}

function drawArrows(ctx, x, y, highlightDir, pulse) {
  const arrowW = 50, arrowH = 40
  const gap = 20
  const s = 1 + Math.sin(pulse * 0.005) * 0.05

  for (const dir of ['left', 'right']) {
    const ax = dir === 'left' ? x - gap - arrowW / 2 : x + gap + arrowW / 2
    const ay = y
    const highlighted = highlightDir === dir

    ctx.save()
    ctx.translate(ax, ay)
    if (highlighted) ctx.scale(s, s)

    // arrow bg
    ctx.fillStyle = highlighted ? '#FFD700' : 'rgba(255,255,255,0.8)'
    ctx.strokeStyle = highlighted ? '#DAA520' : '#999'
    ctx.lineWidth = 2
    drawRoundRect(ctx, -arrowW / 2, -arrowH / 2, arrowW, arrowH, 8)
    ctx.fill()
    ctx.stroke()

    // arrow icon
    ctx.fillStyle = highlighted ? '#8B6914' : '#666'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(dir === 'left' ? '\u25C0' : '\u25B6', 0, 0)

    ctx.restore()
  }
}

function drawConfetti(ctx, particles) {
  for (const p of particles) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color
    ctx.fillRect(-3, -6, 6, 12)
    ctx.restore()
  }
}

function drawStars(ctx, x, y, count, size) {
  for (let i = 0; i < 3; i++) {
    const sx = x + i * (size + 6)
    drawStar(ctx, sx, y, size / 2, i < count)
  }
}

function drawStar(ctx, cx, cy, r, filled) {
  ctx.fillStyle = filled ? '#FFD700' : 'rgba(255,215,0,0.2)'
  ctx.strokeStyle = '#DAA520'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const ang = (i * 72 - 90) * Math.PI / 180
    const ang2 = ((i * 72) + 36 - 90) * Math.PI / 180
    const method = i === 0 ? 'moveTo' : 'lineTo'
    ctx[method](cx + Math.cos(ang) * r, cy + Math.sin(ang) * r)
    ctx.lineTo(cx + Math.cos(ang2) * r * 0.45, cy + Math.sin(ang2) * r * 0.45)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

// ── main component ──
export default function App() {
  const canvasRef = useRef(null)
  const gs = useRef(null)
  const [phase, setPhase] = useState('title') // title | levelSelect | playing | win | lose
  const [stars, setStars] = useState(loadProgress)
  const [winStars, setWinStars] = useState(0)
  const [loseLabel, setLoseLabel] = useState('')
  const [loseEmoji, setLoseEmoji] = useState('')
  const [currentLevel, setCurrentLevel] = useState(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const startLevel = useCallback((idx) => {
    const tree = getLevelTree(idx)
    const nodes = layoutTree(tree)
    setCurrentLevel(idx)

    gs.current = {
      nodes,
      eggNodeIdx: 0,
      eggX: nodes[0].x,
      eggY: nodes[0].y,
      eggRot: 0,
      eggTarget: null, // { x, y, nodeIdx }
      eggSpeed: 0,
      expression: 'happy',
      waitingForChoice: true,
      rolling: false,
      wrongTurns: 0,
      startTime: performance.now(),
      elapsed: 0,
      confetti: [],
      t: 0,
      arrowHighlight: null,
      forkCount: getLevelForkCount(idx),
      forksCompleted: 0,
    }
    setPhase('playing')
  }, [])

  const makeChoice = useCallback((dir) => {
    const g = gs.current
    if (!g || !g.waitingForChoice || g.rolling) return

    const node = g.nodes[g.eggNodeIdx]
    if (node.type !== 'fork') return

    const targetIdx = dir === 'left' ? node.leftIdx : node.rightIdx
    if (targetIdx == null) return

    const target = g.nodes[targetIdx]
    g.eggTarget = { x: target.x, y: target.y, nodeIdx: targetIdx }
    g.rolling = true
    g.waitingForChoice = false
    g.eggSpeed = 0
    g.expression = 'scared'
    g.arrowHighlight = dir
  }, [])

  // input handlers
  useEffect(() => {
    function onKey(e) {
      if (phaseRef.current !== 'playing') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); makeChoice('left') }
      if (e.key === 'ArrowRight') { e.preventDefault(); makeChoice('right') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [makeChoice])

  // game loop
  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    function tick(now) {
      raf = requestAnimationFrame(tick)
      const g = gs.current
      if (!g) return

      const dt = Math.min(now - (g.lastFrame || now), 50)
      g.lastFrame = now
      g.t = now
      g.elapsed = now - g.startTime

      // update egg rolling
      if (g.rolling && g.eggTarget) {
        g.eggSpeed = Math.min(g.eggSpeed + dt * 0.008, 4)
        const dx = g.eggTarget.x - g.eggX
        const dy = g.eggTarget.y - g.eggY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < g.eggSpeed * dt * 0.1 + 2) {
          // arrived
          g.eggX = g.eggTarget.x
          g.eggY = g.eggTarget.y
          g.eggNodeIdx = g.eggTarget.nodeIdx
          g.rolling = false
          g.eggTarget = null
          g.eggSpeed = 0
          g.arrowHighlight = null

          const arrivedNode = g.nodes[g.eggNodeIdx]
          if (arrivedNode.type === 'home') {
            g.expression = 'excited'
            // calculate stars
            const timeS = g.elapsed / 1000
            const forkCount = g.forkCount
            let s = 1
            if (g.wrongTurns === 0) s = 2
            if (g.wrongTurns === 0 && timeS < forkCount * 4 + 3) s = 3
            // spawn confetti
            g.confetti = []
            for (let i = 0; i < 60; i++) {
              g.confetti.push({
                x: g.eggX + (Math.random() - 0.5) * 100,
                y: g.eggY - 20 - Math.random() * 40,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 5 - 2,
                rot: Math.random() * Math.PI * 2,
                rotV: (Math.random() - 0.5) * 0.2,
                color: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF78C4'][Math.floor(Math.random() * 5)]
              })
            }
            setWinStars(s)
            setStars(prev => {
              const next = [...prev]
              next[currentLevel] = Math.max(next[currentLevel], s)
              saveProgress(next)
              return next
            })
            setTimeout(() => setPhase('win'), 1200)
          } else if (arrivedNode.type === 'dead') {
            g.expression = 'confused'
            g.wrongTurns++
            setLoseLabel(arrivedNode.label)
            setLoseEmoji(arrivedNode.emoji)
            setTimeout(() => setPhase('lose'), 800)
          } else if (arrivedNode.type === 'fork') {
            g.expression = 'happy'
            g.waitingForChoice = true
            g.forksCompleted++
          }
        } else {
          const step = g.eggSpeed * dt * 0.1
          g.eggX += (dx / dist) * step
          g.eggY += (dy / dist) * step
          g.eggRot += dt * 0.005 * (dx > 0 ? 1 : -1)
        }
      }

      // update confetti
      for (const p of g.confetti) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.12
        p.rot += p.rotV
      }

      // ── draw ──
      ctx.clearRect(0, 0, W, H)
      drawBackground(ctx, g.t)

      // draw ramps
      for (const node of g.nodes) {
        if (node.type === 'fork') {
          if (node.leftIdx != null) {
            drawRamp(ctx, node.x, node.y, g.nodes[node.leftIdx].x, g.nodes[node.leftIdx].y)
          }
          if (node.rightIdx != null) {
            drawRamp(ctx, node.x, node.y, g.nodes[node.rightIdx].x, g.nodes[node.rightIdx].y)
          }
        }
      }

      // draw endpoints
      for (const node of g.nodes) {
        if (node.type === 'home') {
          drawHome(ctx, node.x, node.y, g.t)
        } else if (node.type === 'dead') {
          drawDeadEnd(ctx, node.x, node.y, node.emoji, node.label)
        } else if (node.type === 'fork') {
          // small circle at fork point
          ctx.fillStyle = 'rgba(139,105,20,0.5)'
          ctx.beginPath()
          ctx.arc(node.x, node.y, 6, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // draw arrows if waiting
      if (g.waitingForChoice && !g.rolling) {
        drawArrows(ctx, g.eggX, g.eggY - 45, null, g.t)
      }

      // draw egg
      drawEgg(ctx, g.eggX, g.eggY, g.eggRot, g.expression)

      // draw confetti
      if (g.confetti.length) drawConfetti(ctx, g.confetti)

      // HUD: level indicator
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      drawRoundRect(ctx, 8, 8, 90, 26, 6)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`Level ${currentLevel + 1}/${TOTAL_LEVELS}`, 16, 21)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, currentLevel])

  // touch handlers for canvas
  const handleCanvasTouch = useCallback((e) => {
    if (phaseRef.current !== 'playing') return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = W / rect.width
    const touch = e.changedTouches[0]
    const tx = (touch.clientX - rect.left) * scaleX
    if (tx < W / 2) makeChoice('left')
    else makeChoice('right')
  }, [makeChoice])

  const handleCanvasClick = useCallback((e) => {
    if (phaseRef.current !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = W / rect.width
    const cx = (e.clientX - rect.left) * scaleX
    if (cx < W / 2) makeChoice('left')
    else makeChoice('right')
  }, [makeChoice])

  // ── render ──
  return (
    <div className="game-wrapper">
      {phase === 'title' && (
        <div className="overlay title-screen">
          <div className="title-egg">🥚</div>
          <h1>Get the Egg<br/>Home!</h1>
          <p className="subtitle">Help the little egg roll down the right ramps to get home for dinner!</p>
          <button className="btn-primary" onClick={() => setPhase('levelSelect')}>
            Play
          </button>
        </div>
      )}

      {phase === 'levelSelect' && (
        <div className="overlay level-select">
          <h2>Choose a Level</h2>
          <div className="level-grid">
            {LEVELS.map((_, i) => {
              const unlocked = i === 0 || stars[i - 1] > 0
              return (
                <button
                  key={i}
                  className={`level-btn ${unlocked ? '' : 'locked'}`}
                  disabled={!unlocked}
                  onClick={() => startLevel(i)}
                >
                  <span className="level-num">{i + 1}</span>
                  {unlocked && stars[i] > 0 && (
                    <span className="level-stars">
                      {'★'.repeat(stars[i])}{'☆'.repeat(3 - stars[i])}
                    </span>
                  )}
                  {!unlocked && <span className="lock-icon">🔒</span>}
                </button>
              )
            })}
          </div>
          <button className="btn-secondary" onClick={() => setPhase('title')}>Back</button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onTouchStart={handleCanvasTouch}
            onClick={handleCanvasClick}
          />
          <div className="play-hint">Tap left/right or use arrow keys</div>
        </div>
      )}

      {phase === 'win' && (
        <div className="overlay win-screen">
          <div className="win-emoji">🎉</div>
          <h2>Home Sweet Home!</h2>
          <p>The egg made it home for dinner!</p>
          <div className="result-stars">
            {'★'.repeat(winStars)}{'☆'.repeat(3 - winStars)}
          </div>
          <p className="star-hint">
            {winStars === 3 ? 'Perfect!' : winStars === 2 ? 'No wrong turns! Try faster for 3 stars.' : 'Try again with no wrong turns!'}
          </p>
          <div className="btn-row">
            <button className="btn-secondary" onClick={() => startLevel(currentLevel)}>
              Retry
            </button>
            {currentLevel < TOTAL_LEVELS - 1 && stars[currentLevel] > 0 && (
              <button className="btn-primary" onClick={() => startLevel(currentLevel + 1)}>
                Next Level
              </button>
            )}
            <button className="btn-secondary" onClick={() => setPhase('levelSelect')}>
              Levels
            </button>
          </div>
        </div>
      )}

      {phase === 'lose' && (
        <div className="overlay lose-screen">
          <div className="lose-emoji">{loseEmoji}</div>
          <h2>Oops!</h2>
          <p>The egg ended up in<br/><strong>{loseLabel}</strong>!</p>
          <p className="lose-hint">That's not home! Try again!</p>
          <div className="btn-row">
            <button className="btn-primary" onClick={() => startLevel(currentLevel)}>
              Try Again
            </button>
            <button className="btn-secondary" onClick={() => setPhase('levelSelect')}>
              Levels
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Kingdom Bloom — canvas game engine: world, movement, coins, build pads, helpers.

import { WORLD, ZONES, PADS, CHARACTERS, PROLOGUE, FINALE, TOTAL_BUILDS } from './data.js';

const SAVE_KEY = 'kingdom-bloom-v2';
const PIP_SPEED = 185;
const HELPER_SPEED = 120;
const PICKUP_RADIUS = 38;
const PAD_RADIUS = 44;
const COIN_CAP_PER_PRODUCER = 6;
const OFFLINE_CAP_S = 3600;

const padById = Object.fromEntries(PADS.map((p) => [p.id, p]));

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 2 && Array.isArray(s.built)) return s;
    }
  } catch { /* corrupted save — start fresh */ }
  return null;
}

// Deterministic pseudo-random for stable decoration placement.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui; // { dialogue(lines), toast(text), hud({money, built, total}), finale() }
    this.paused = false;
    this.destroyed = false;

    const save = loadSave();
    this.money = save ? save.money : 20;
    this.built = new Set(save ? save.built : PADS.filter((p) => p.prebuilt).map((p) => p.id));
    this.finaleDone = this.built.has('sunstone');

    this.pip = { x: 160, y: 430, dir: 1, walk: 0 };
    this.coins = [];
    this.floats = [];
    this.helpers = [];
    this.payProgress = {};
    this.producerNext = {};
    this.time = 0;
    this.lastHud = 0;
    this.lastSave = 0;
    this.justBuilt = {}; // padId -> time, for pop animation

    for (const pad of PADS) {
      if (pad.type === 'helper' && this.built.has(pad.id)) this.spawnHelper(pad);
    }

    // Decorations: stable positions per zone (trees, tufts, flowers).
    const rand = lcg(42);
    this.decor = [];
    for (const [zi, zone] of ZONES.entries()) {
      for (let i = 0; i < 26; i++) {
        const x = zone.x0 + 30 + rand() * (zone.x1 - zone.x0 - 60);
        const y = 100 + rand() * (WORLD.h - 170);
        const nearPad = PADS.some((p) => Math.hypot(p.x - x, p.y - y) < 110);
        if (nearPad) continue;
        const kind = rand() < 0.22 ? 'tree' : rand() < 0.55 ? 'tuft' : 'flower';
        this.decor.push({ x, y, zi, kind, v: rand() });
      }
    }

    // Offline earnings from helpers.
    if (save && save.ts) {
      const elapsed = Math.min(OFFLINE_CAP_S, (Date.now() - save.ts) / 1000);
      const rate = this.idleRate();
      const earned = Math.floor(elapsed * rate * 0.6);
      if (earned > 5) {
        this.money += earned;
        setTimeout(() => this.ui.toast(`While you were away, your helpers gathered ${earned} 🪙!`), 600);
      }
    }

    if (!save) {
      this.ui.dialogue([...PROLOGUE]);
    }

    this.input = { keys: new Set(), joy: null };
    this.bindInput();

    this.raf = 0;
    this.lastT = performance.now();
    const loop = (t) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      if (!this.paused) this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);

    this.onVis = () => this.save();
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('beforeunload', this.onVis);
    this.pushHud();
    window.__kb = this; // debug/testing handle
  }

  // --- Save ---

  save() {
    if (this.disableSaving) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        version: 2,
        money: Math.floor(this.money),
        built: [...this.built],
        ts: Date.now(),
      }));
    } catch { /* storage blocked */ }
  }

  // --- Derived state ---

  unlockedZoneCount() {
    let count = 1;
    if (this.built.has('gate1')) count = 2;
    if (this.built.has('gate2')) count = 3;
    return count;
  }

  zoneMult(zi) {
    let mult = 1;
    for (const pad of PADS) {
      if (pad.type === 'booster' && pad.zone === zi && this.built.has(pad.id)) mult *= pad.mult;
    }
    return mult;
  }

  helperZones() {
    return new Set(this.helpers.map((h) => h.zone));
  }

  idleRate() {
    const zonesWithHelp = this.helperZones();
    let rate = 0;
    for (const pad of PADS) {
      if (pad.type === 'producer' && this.built.has(pad.id) && zonesWithHelp.has(pad.zone)) {
        rate += (pad.value * this.zoneMult(pad.zone)) / (pad.period / 1000);
      }
    }
    return rate;
  }

  builtCount() {
    return [...this.built].filter((id) => !padById[id]?.prebuilt).length;
  }

  pushHud() {
    this.ui.hud({ money: Math.floor(this.money), built: this.builtCount(), total: TOTAL_BUILDS });
  }

  spawnHelper(pad) {
    const zone = ZONES[pad.zone];
    this.helpers.push({
      who: pad.who, zone: pad.zone,
      x: pad.x, y: pad.y + 40, tx: pad.x, ty: pad.y + 40,
      dir: 1, walk: 0, idle: 0,
    });
  }

  // --- Input ---

  bindInput() {
    this.onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.input.keys.add(e.key.toLowerCase());
    };
    this.onKeyUp = (e) => this.input.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.onPointerDown = (e) => {
      this.canvas.setPointerCapture?.(e.pointerId);
      const r = this.canvas.getBoundingClientRect();
      this.input.joy = { ox: e.clientX - r.left, oy: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top };
    };
    this.onPointerMove = (e) => {
      if (!this.input.joy) return;
      const r = this.canvas.getBoundingClientRect();
      this.input.joy.x = e.clientX - r.left;
      this.input.joy.y = e.clientY - r.top;
    };
    this.onPointerUp = () => { this.input.joy = null; };
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  moveVector() {
    let dx = 0; let dy = 0;
    const k = this.input.keys;
    if (k.has('arrowleft') || k.has('a')) dx -= 1;
    if (k.has('arrowright') || k.has('d')) dx += 1;
    if (k.has('arrowup') || k.has('w')) dy -= 1;
    if (k.has('arrowdown') || k.has('s')) dy += 1;
    if (dx || dy) {
      const m = Math.hypot(dx, dy);
      return { x: dx / m, y: dy / m, f: 1 };
    }
    const joy = this.input.joy;
    if (joy) {
      const jx = joy.x - joy.ox;
      const jy = joy.y - joy.oy;
      const mag = Math.hypot(jx, jy);
      if (mag > 8) {
        return { x: jx / mag, y: jy / mag, f: Math.min(1, mag / 50) };
      }
    }
    return null;
  }

  // --- Update ---

  update(dt) {
    this.time += dt;

    // Pip movement
    const mv = this.moveVector();
    if (mv) {
      this.pip.x += mv.x * PIP_SPEED * mv.f * dt;
      this.pip.y += mv.y * PIP_SPEED * mv.f * dt;
      if (Math.abs(mv.x) > 0.15) this.pip.dir = mv.x > 0 ? 1 : -1;
      this.pip.walk += dt * 9;
    }
    const maxX = ZONES[this.unlockedZoneCount() - 1].x1 - 34;
    this.pip.x = Math.max(34, Math.min(maxX, this.pip.x));
    this.pip.y = Math.max(100, Math.min(WORLD.h - 40, this.pip.y));

    // Producers spawn coins
    for (const pad of PADS) {
      if (pad.type !== 'producer' || !this.built.has(pad.id)) continue;
      const next = this.producerNext[pad.id] ?? this.time + Math.random() * (pad.period / 1000);
      if (this.time >= next) {
        this.producerNext[pad.id] = this.time + pad.period / 1000;
        const count = this.coins.filter((c) => c.producer === pad.id).length;
        if (count < COIN_CAP_PER_PRODUCER) {
          const ang = Math.random() * Math.PI * 2;
          const r = 55 + Math.random() * 45;
          this.coins.push({
            x: Math.max(ZONES[pad.zone].x0 + 24, Math.min(ZONES[pad.zone].x1 - 24, pad.x + Math.cos(ang) * r)),
            y: Math.max(110, Math.min(WORLD.h - 40, pad.y + Math.sin(ang) * r * 0.7 + 20)),
            value: Math.round(pad.value * this.zoneMult(pad.zone)),
            producer: pad.id,
            zone: pad.zone,
            born: this.time,
          });
        }
      } else {
        this.producerNext[pad.id] = next;
      }
    }

    // Pip picks up coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (Math.hypot(c.x - this.pip.x, c.y - this.pip.y) < PICKUP_RADIUS) {
        this.money += c.value;
        this.addFloat(c.x, c.y, `+${c.value}`);
        this.coins.splice(i, 1);
      }
    }

    // Helpers collect coins
    for (const h of this.helpers) {
      let target = null;
      let bestD = Infinity;
      for (const c of this.coins) {
        if (c.zone !== h.zone) continue;
        const d = Math.hypot(c.x - h.x, c.y - h.y);
        if (d < bestD) { bestD = d; target = c; }
      }
      if (target) {
        const d = Math.max(0.001, bestD);
        h.x += ((target.x - h.x) / d) * HELPER_SPEED * dt;
        h.y += ((target.y - h.y) / d) * HELPER_SPEED * dt;
        h.dir = target.x > h.x ? 1 : -1;
        h.walk += dt * 8;
        if (d < 26) {
          this.money += target.value;
          this.addFloat(target.x, target.y, `+${target.value}`);
          this.coins.splice(this.coins.indexOf(target), 1);
        }
      } else {
        h.idle += dt;
        h.walk = 0;
      }
    }

    // Paying on pads
    const unlocked = this.unlockedZoneCount();
    for (const pad of PADS) {
      if (this.built.has(pad.id) || pad.zone >= unlocked) continue;
      const d = Math.hypot(pad.x - this.pip.x, pad.y - this.pip.y);
      if (d < PAD_RADIUS && this.money > 0) {
        const paid = this.payProgress[pad.id] || 0;
        const remaining = pad.cost - paid;
        const rate = Math.max(30, pad.cost / 2.2);
        const pay = Math.min(this.money, remaining, rate * dt);
        if (pay > 0) {
          this.money -= pay;
          this.payProgress[pad.id] = paid + pay;
          if (this.payProgress[pad.id] >= pad.cost - 0.001) this.build(pad);
        }
      }
    }

    // Floats
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.age += dt;
      f.y -= 34 * dt;
      if (f.age > 1) this.floats.splice(i, 1);
    }

    // HUD + autosave
    if (this.time - this.lastHud > 0.15) { this.lastHud = this.time; this.pushHud(); }
    if (this.time - this.lastSave > 3) { this.lastSave = this.time; this.save(); }
  }

  build(pad) {
    this.built.add(pad.id);
    delete this.payProgress[pad.id];
    this.justBuilt[pad.id] = this.time;
    this.addFloat(pad.x, pad.y - 40, '✨');

    const lines = [];
    if (pad.line) lines.push(pad.line);
    if (pad.type === 'gate') lines.push(...ZONES[pad.opens].intro);
    if (pad.type === 'helper') this.spawnHelper(pad);
    if (pad.type === 'finale') {
      lines.push(...FINALE);
      this.finaleDone = true;
      this.ui.finale();
    }
    if (lines.length) this.ui.dialogue(lines);
    this.save();
    this.pushHud();
  }

  addFloat(x, y, text) {
    this.floats.push({ x, y, text, age: 0 });
  }

  // --- Render ---

  render() {
    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = Math.max(0.55, Math.min(1, ch / 780));
    const viewW = cw / scale;
    const viewH = ch / scale;
    const camX = Math.max(0, Math.min(WORLD.w - viewW, this.pip.x - viewW / 2));
    const camY = Math.max(0, Math.min(WORLD.h - viewH, this.pip.y - viewH / 2));

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    // Ground per zone
    for (const zone of ZONES) {
      ctx.fillStyle = zone.grass;
      ctx.fillRect(zone.x0, 0, zone.x1 - zone.x0, WORLD.h);
      ctx.fillStyle = zone.grassDark;
      ctx.fillRect(zone.x0, 0, zone.x1 - zone.x0, 90);
    }
    // Path
    ctx.fillStyle = '#e8d9b5';
    ctx.fillRect(0, 400, WORLD.w, 60);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let x = 40; x < WORLD.w; x += 130) ctx.beginPath(), ctx.ellipse(x, 432, 16, 6, 0, 0, 7), ctx.fill();

    // Decorations
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const d of this.decor) {
      if (d.x < camX - 60 || d.x > camX + viewW + 60) continue;
      if (d.kind === 'tree') {
        ctx.font = '34px serif';
        ctx.fillText('🌳', d.x, d.y);
      } else if (d.kind === 'flower') {
        ctx.font = '14px serif';
        ctx.fillText(['🌼', '🌷', '🍄'][Math.floor(d.v * 3)], d.x, d.y);
      } else {
        ctx.strokeStyle = 'rgba(46,110,44,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(d.x - 4, d.y + 4); ctx.lineTo(d.x - 2, d.y - 4);
        ctx.moveTo(d.x + 1, d.y + 4); ctx.lineTo(d.x + 2, d.y - 5);
        ctx.moveTo(d.x + 5, d.y + 4); ctx.lineTo(d.x + 6, d.y - 3);
        ctx.stroke();
      }
    }

    const unlocked = this.unlockedZoneCount();

    // Zone fences at locked boundaries
    for (let zi = unlocked; zi < ZONES.length; zi++) {
      const bx = ZONES[zi].x0;
      ctx.fillStyle = '#9c7b4f';
      for (let y = 100; y < WORLD.h - 20; y += 46) {
        ctx.fillRect(bx - 5, y, 10, 34);
      }
      ctx.fillRect(bx - 3, 110, 6, WORLD.h - 140);
    }

    // Pads + buildings
    for (const pad of PADS) {
      if (pad.zone >= unlocked && !this.built.has(pad.id)) continue;
      if (this.built.has(pad.id)) this.drawBuilding(ctx, pad);
      else this.drawPad(ctx, pad);
    }

    // Coins
    for (const c of this.coins) {
      const bob = Math.sin(this.time * 3 + c.x) * 3;
      const size = 15 + Math.min(9, Math.log2(c.value + 1) * 2.4);
      ctx.font = `${size}px serif`;
      const pop = Math.min(1, (this.time - c.born) * 4);
      ctx.save();
      ctx.translate(c.x, c.y + bob - (1 - pop) * 18);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#2b5e28';
      ctx.beginPath(); ctx.ellipse(0, size * 0.55, size * 0.42, size * 0.16, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillText('🪙', 0, 0);
      ctx.restore();
    }

    // Helpers
    for (const h of this.helpers) this.drawActor(ctx, h.x, h.y, CHARACTERS[h.who].emoji, h.dir, h.walk, 30);

    // Pip (+ crown)
    this.drawActor(ctx, this.pip.x, this.pip.y, '🧒', this.pip.dir, this.pip.walk, 36);
    ctx.font = '15px serif';
    ctx.fillText('👑', this.pip.x, this.pip.y - 30 + Math.sin(this.pip.walk) * 1.5);

    // Floats
    for (const f of this.floats) {
      ctx.globalAlpha = 1 - f.age;
      ctx.font = 'bold 17px Fredoka, sans-serif';
      ctx.fillStyle = '#7a5a00';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    // Guide arrow toward the cheapest remaining build
    let target = null;
    for (const pad of PADS) {
      if (this.built.has(pad.id) || pad.zone >= unlocked) continue;
      if (!target || pad.cost < target.cost) target = pad;
    }
    if (target) {
      const dx = target.x - this.pip.x;
      const dy = target.y - this.pip.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 170) {
        const ang = Math.atan2(dy, dx);
        const bounce = Math.sin(this.time * 5) * 5;
        const ax = this.pip.x + Math.cos(ang) * (78 + bounce);
        const ay = this.pip.y + Math.sin(ang) * (78 + bounce) - 20;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = '#f6c453';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }

    // Locked zone shading + hint
    for (let zi = unlocked; zi < ZONES.length; zi++) {
      const zone = ZONES[zi];
      ctx.fillStyle = 'rgba(40,34,66,0.42)';
      ctx.fillRect(zone.x0, 0, zone.x1 - zone.x0, WORLD.h);
      if (zi === unlocked) {
        ctx.font = '44px serif';
        ctx.fillText('🔒', zone.x0 + 120, 360);
        ctx.font = 'bold 19px Fredoka, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(zone.name, zone.x0 + 120, 404);
      }
    }

    // Golden glow after finale
    if (this.finaleDone) {
      const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
      g.addColorStop(0, 'rgba(255,214,102,0.22)');
      g.addColorStop(1, 'rgba(255,214,102,0)');
      ctx.fillStyle = g;
      ctx.fillRect(camX, 0, viewW, WORLD.h);
    }

    ctx.restore();

    // Joystick overlay (screen space)
    const joy = this.input.joy;
    if (joy) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 34, 0, 7); ctx.fill();
      const jx = joy.x - joy.ox; const jy = joy.y - joy.oy;
      const m = Math.hypot(jx, jy) || 1;
      const cl = Math.min(30, m);
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(joy.ox + (jx / m) * cl, joy.oy + (jy / m) * cl, 16, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawActor(ctx, x, y, emoji, dir, walk, size) {
    const hop = Math.abs(Math.sin(walk)) * 4;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#20481e';
    ctx.beginPath(); ctx.ellipse(x, y + size * 0.42, size * 0.4, size * 0.14, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(x, y - hop);
    ctx.scale(dir, 1);
    ctx.font = `${size}px serif`;
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }

  drawPad(ctx, pad) {
    const affordable = this.money >= 1;
    const paid = this.payProgress[pad.id] || 0;
    const frac = paid / pad.cost;
    const pulse = affordable ? 1 + Math.sin(this.time * 4) * 0.04 : 1;

    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill();
    ctx.strokeStyle = this.money >= pad.cost - paid ? '#f6c453' : '#c9c2dd';
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.stroke();
    ctx.setLineDash([]);

    if (frac > 0) {
      ctx.strokeStyle = '#58b368';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    }

    ctx.font = '24px serif';
    ctx.fillText(pad.emoji, 0, -8);
    ctx.font = 'bold 13px Fredoka, sans-serif';
    ctx.fillStyle = '#7a5a00';
    ctx.fillText(`${Math.ceil(pad.cost - paid)} 🪙`, 0, 16);
    ctx.restore();

    ctx.font = 'bold 13px Fredoka, sans-serif';
    ctx.fillStyle = '#3d3554';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(pad.name, pad.x, pad.y + 58);
    ctx.fillText(pad.name, pad.x, pad.y + 58);
  }

  drawBuilding(ctx, pad) {
    if (pad.type === 'helper') return; // the helper NPC is the "building"
    const age = this.time - (this.justBuilt[pad.id] ?? -10);
    const pop = age < 0.5 ? 0.6 + 0.4 * Math.min(1, age * 3) * (1 + Math.sin(Math.min(1, age * 3) * Math.PI) * 0.18) : 1;

    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.scale(pop, pop);

    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#20481e';
    ctx.beginPath(); ctx.ellipse(0, 40, 52, 14, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;

    if (pad.type === 'gate') {
      // An opened gate: two posts + arch
      ctx.fillStyle = '#9c7b4f';
      ctx.fillRect(-44, -46, 14, 86);
      ctx.fillRect(30, -46, 14, 86);
      ctx.strokeStyle = '#f6c453';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, -42, 40, Math.PI, 0); ctx.stroke();
      ctx.font = '20px serif';
      ctx.fillText('🎏', 0, -60);
    } else if (pad.type === 'finale') {
      const glow = 0.5 + Math.sin(this.time * 2.4) * 0.25;
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#ffde7a';
      ctx.beginPath(); ctx.arc(0, -14, 58, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e2d9f2';
      ctx.fillRect(-30, -10, 60, 50);
      ctx.font = '46px serif';
      ctx.fillText('🌟', 0, -22);
    } else {
      const base = pad.type === 'booster' ? '#fff2cf' : '#fff8ea';
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.roundRect(-40, -18, 80, 58, 10); ctx.fill();
      ctx.strokeStyle = '#e3cf9e';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-40, -18, 80, 58, 10); ctx.stroke();
      ctx.fillStyle = ['#e2574c', '#6c5ce7', '#4ecdc4'][pad.zone];
      ctx.beginPath();
      ctx.moveTo(-48, -16); ctx.lineTo(48, -16); ctx.lineTo(0, -52);
      ctx.closePath(); ctx.fill();
      ctx.font = '30px serif';
      ctx.fillText(pad.emoji, 0, 12);
    }
    ctx.restore();

    ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.fillStyle = '#3d3554';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(pad.name, pad.x, pad.y + 62);
    ctx.fillText(pad.name, pad.x, pad.y + 62);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.save();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('beforeunload', this.onVis);
  }
}

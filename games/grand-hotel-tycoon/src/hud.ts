/**
 * The DOM HUD.
 *
 * Everything chrome-shaped lives in HTML/CSS rather than in the 3D scene:
 * frosted panels, crisp tabular numerals and `clamp()` sizing are free here
 * and painful in a canvas. This is a thin typed wrapper that caches element
 * refs and dirty-checks before touching the DOM, so nothing writes per-frame
 * unless it actually changed.
 */
import { PALETTE as P } from "./config";

/** Most notifications that can be on screen at once. */
const MAX_TOASTS = 3;

const STAR_PATH =
  "M12 2.2l2.95 6.2 6.55.92-4.75 4.7 1.14 6.78L12 17.6l-5.89 3.2 1.14-6.78L2.5 9.32l6.55-.92z";

export type RoomChipState = "free" | "reserved" | "busy" | "dirty";

export class Hud {
  private hud = document.getElementById("hud")!;
  private bankEl = document.getElementById("bank")!;
  private starsEl = document.getElementById("stars")!;
  private guestLine = document.getElementById("guest-line")!;
  private roomsPanel = document.getElementById("rooms-panel")!;
  private hintEl = document.getElementById("hint")!;
  private hintText = document.getElementById("hint-text")!;
  private toastsEl = document.getElementById("toasts")!;
  private muteBtn = document.getElementById("mute") as HTMLButtonElement;
  private pauseBtn = document.getElementById("pause-btn") as HTMLButtonElement;
  private startScreen = document.getElementById("start-screen")!;
  private pauseScreen = document.getElementById("pause-screen")!;
  private minimap = document.getElementById("minimap") as HTMLCanvasElement;
  private mmCtx: CanvasRenderingContext2D;

  private starEls: SVGSVGElement[] = [];
  private chipEls: HTMLElement[] = [];

  /** Animated counter, so the bank total rolls up instead of snapping. */
  private shownBank = 0;
  private targetBank = 0;
  private lastBankText = "";
  private lastStars = -1;
  private lastGuestLine = "";
  private lastHint = "";
  private lastChips = "";

  constructor() {
    this.mmCtx = this.minimap.getContext("2d")!;
    for (let i = 0; i < 5; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.classList.add("star");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", STAR_PATH);
      svg.appendChild(path);
      this.starsEl.appendChild(svg);
      this.starEls.push(svg);
    }
    this.drawMuteIcon(false);
  }

  /* ------------------------------------------------------------- wiring */

  onMute(fn: () => void): void {
    this.muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fn();
    });
    this.muteBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  onPause(fn: () => void): void {
    this.pauseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fn();
    });
    this.pauseBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  onButton(id: string, fn: () => void): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      fn();
    });
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  drawMuteIcon(muted: boolean): void {
    this.muteBtn.innerHTML = muted
      ? `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`
      : `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.2 8.4a5 5 0 010 7.2M18.8 5.8a8.6 8.6 0 010 12.4" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
  }

  /* ------------------------------------------------------------ screens */

  showGame(): void {
    this.hud.classList.remove("hidden");
    this.muteBtn.classList.remove("hidden");
    this.pauseBtn.classList.remove("hidden");
    this.startScreen.classList.add("hidden");
    this.pauseScreen.classList.add("hidden");
  }

  showStart(resume: { bank: number; rooms: number; served: number } | null): void {
    this.startScreen.classList.remove("hidden");
    this.hud.classList.add("hidden");
    this.muteBtn.classList.add("hidden");
    this.pauseBtn.classList.add("hidden");

    const stats = document.getElementById("resume-stats")!;
    const resetBtn = document.getElementById("reset-btn")!;
    const startBtn = document.getElementById("start-btn")!;
    if (resume) {
      stats.classList.remove("hidden");
      resetBtn.classList.remove("hidden");
      document.getElementById("rs-money")!.textContent = fmt(resume.bank);
      document.getElementById("rs-rooms")!.textContent = String(resume.rooms);
      document.getElementById("rs-served")!.textContent = String(resume.served);
      startBtn.textContent = "Back to my hotel";
    } else {
      stats.classList.add("hidden");
      resetBtn.classList.add("hidden");
      startBtn.textContent = "Open the hotel";
    }
  }

  showPause(): void {
    this.pauseScreen.classList.remove("hidden");
  }

  hidePause(): void {
    this.pauseScreen.classList.add("hidden");
  }

  /* --------------------------------------------------------------- data */

  setBank(n: number, instant = false): void {
    this.targetBank = n;
    if (!instant) return;
    // Paint immediately. `update()` only writes the DOM while the counter is
    // rolling, so setting shown === target without painting left a restored
    // save showing 0 until the balance next changed.
    this.shownBank = n;
    this.lastBankText = fmt(Math.floor(n));
    this.bankEl.textContent = this.lastBankText;
  }

  setStars(stars: number): void {
    const q = Math.round(stars * 2) / 2;
    if (q === this.lastStars) return;
    const wasLower = q > this.lastStars && this.lastStars >= 0;
    this.lastStars = q;
    this.starEls.forEach((el, i) => {
      const full = q >= i + 1;
      const half = !full && q >= i + 0.5;
      el.classList.toggle("on", full);
      el.classList.toggle("half", half);
      if (wasLower && (full || half)) {
        el.style.transform = "scale(1.5)";
        setTimeout(() => (el.style.transform = ""), 260);
      }
    });
  }

  setGuests(inHotel: number, served: number): void {
    const text = `${inHotel} guest${inHotel === 1 ? "" : "s"} · ${served} served`;
    if (text === this.lastGuestLine) return;
    this.lastGuestLine = text;
    this.guestLine.textContent = text;
  }

  setRooms(states: RoomChipState[]): void {
    const key = states.join(",");
    if (key === this.lastChips) return;
    const grew = states.length !== this.chipEls.length;
    this.lastChips = key;

    while (this.chipEls.length < states.length) {
      const el = document.createElement("div");
      el.className = "chip";
      this.roomsPanel.appendChild(el);
      this.chipEls.push(el);
    }
    states.forEach((s, i) => {
      const el = this.chipEls[i];
      el.className = `chip ${s}`;
      el.textContent =
        s === "free" ? "🛏" : s === "reserved" ? "🚶" : s === "busy" ? "💤" : "🧹";
    });
    if (grew) {
      const last = this.chipEls[states.length - 1];
      last.classList.add("pop");
      setTimeout(() => last.classList.remove("pop"), 320);
    }
  }

  setHint(emoji: string, text: string): void {
    const key = emoji + text;
    if (key === this.lastHint) return;
    this.lastHint = key;
    this.hintEl.querySelector(".emoji")!.textContent = emoji;
    this.hintText.textContent = text;
    // small pop so a changed instruction is noticed
    this.hintEl.style.transform = "translateX(-50%) scale(1.08)";
    setTimeout(() => (this.hintEl.style.transform = "translateX(-50%) scale(1)"), 200);
  }

  toast(emoji: string, text: string, ms = 3200): void {
    const el = document.createElement("div");
    el.className = "toast panel";
    el.innerHTML = `<span class="emoji"></span><span></span>`;
    el.children[0].textContent = emoji;
    el.children[1].textContent = text;
    this.toastsEl.appendChild(el);

    // Hard cap the stack. A run of quick purchases could otherwise paper over
    // the whole screen with notifications.
    while (this.toastsEl.children.length > MAX_TOASTS) {
      this.toastsEl.firstElementChild?.remove();
    }

    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 400);
    }, ms);
  }

  /** Floating "+14" that rises from a projected world position. */
  popup(screenX: number, screenY: number, text: string, color: string = P.coin): void {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = `position:absolute;left:${screenX}px;top:${screenY}px;z-index:4;
      transform:translate(-50%,-50%);pointer-events:none;font-weight:900;font-size:26px;
      color:${color};text-shadow:0 2px 0 rgba(23,56,74,.45), 0 0 12px rgba(255,255,255,.5);
      font-variant-numeric:tabular-nums;transition:transform .85s cubic-bezier(.2,.7,.3,1),opacity .85s ease;`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = "translate(-50%,-50%) translateY(-62px) scale(1.25)";
      el.style.opacity = "0";
    });
    setTimeout(() => el.remove(), 900);
  }

  /** Advance the rolling bank counter. */
  update(dt: number): void {
    if (this.shownBank !== this.targetBank) {
      const diff = this.targetBank - this.shownBank;
      const step = Math.max(1, Math.abs(diff) * Math.min(1, dt * 9));
      this.shownBank += Math.sign(diff) * Math.min(step, Math.abs(diff));
      if (Math.abs(this.targetBank - this.shownBank) < 0.6) this.shownBank = this.targetBank;
      const text = fmt(Math.floor(this.shownBank));
      if (text !== this.lastBankText) {
        this.lastBankText = text;
        this.bankEl.textContent = text;
        this.bankEl.style.transform = "scale(1.09)";
      }
    } else if (this.bankEl.style.transform) {
      this.bankEl.style.transform = "";
    }
  }

  /* ------------------------------------------------------------ minimap */

  /**
   * Top-down sketch of the resort. This is the anti-lost device: the player's
   * dot, every job that needs doing, and every pad they could afford.
   */
  drawMinimap(
    bounds: { west: number; east: number; half: number },
    player: { x: number; z: number },
    marks: { x: number; z: number; kind: "job" | "pad" | "guest" }[],
  ): void {
    const c = this.mmCtx;
    const W = this.minimap.width;
    const H = this.minimap.height;
    c.clearRect(0, 0, W, H);

    const pad = 8;
    const spanX = bounds.east - bounds.west;
    const spanZ = bounds.half * 2;
    const sx = (W - pad * 2) / spanX;
    const sz = (H - pad * 2) / spanZ;
    const s = Math.min(sx, sz);
    const ox = pad + ((W - pad * 2) - spanX * s) / 2;
    const oz = pad + ((H - pad * 2) - spanZ * s) / 2;
    const px = (x: number) => ox + (x - bounds.west) * s;
    const pz = (z: number) => oz + (z + bounds.half) * s;

    // island
    c.fillStyle = "rgba(111,191,95,0.55)";
    c.beginPath();
    c.roundRect(ox, oz, spanX * s, spanZ * s, 10);
    c.fill();

    // promenade
    c.fillStyle = "rgba(240,223,184,0.9)";
    c.fillRect(ox, pz(-3), spanX * s, 6 * s);

    for (const m of marks) {
      const x = px(m.x);
      const y = pz(m.z);
      if (m.kind === "guest") {
        c.fillStyle = "rgba(23,56,74,0.45)";
        c.beginPath();
        c.arc(x, y, 2.2, 0, Math.PI * 2);
        c.fill();
      } else if (m.kind === "pad") {
        c.fillStyle = P.padGlow;
        c.beginPath();
        c.arc(x, y, 4, 0, Math.PI * 2);
        c.fill();
      } else {
        c.fillStyle = P.roof;
        c.beginPath();
        c.arc(x, y, 4.5, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#fff";
        c.lineWidth = 1.6;
        c.stroke();
      }
    }

    // the player, always on top and always the biggest thing on the map
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(px(player.x), pz(player.z), 6.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = P.roof;
    c.beginPath();
    c.arc(px(player.x), pz(player.z), 4.2, 0, Math.PI * 2);
    c.fill();
  }
}

function fmt(n: number): string {
  return n >= 10000 ? `${Math.floor(n / 1000)}k` : String(Math.floor(n));
}

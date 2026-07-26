import { BALLS_PER_GAME, scoreColor } from "./config";

const $ = (id: string) => document.getElementById(id)!;

export interface Grade {
  letter: string;
  color: string;
  label: string;
}

/** Grade curve carried over from v1 (average points per ball). */
export function getGrade(avg: number): Grade {
  if (avg >= 80) return { letter: "S", color: "#FFD700", label: "Perfect!" };
  if (avg >= 60) return { letter: "A", color: "#44DD66", label: "Excellent!" };
  if (avg >= 40) return { letter: "B", color: "#3399FF", label: "Great!" };
  if (avg >= 20) return { letter: "C", color: "#FF9900", label: "Good" };
  return { letter: "D", color: "#FF6666", label: "Keep practicing!" };
}

export class Hud {
  private scoreEl = $("score");
  private bestEl = $("best");
  private pipsEl = $("pips");
  private streakEl = $("streak");
  private hintEl = $("hint");
  private powerWrap = $("power-wrap");
  private powerFill = $("power-fill");
  private startOv = $("start");
  private overOv = $("over");
  private muteBtn = $("mute") as HTMLButtonElement;

  private shown = 0;
  private target = 0;
  private pips: HTMLElement[] = [];

  constructor(opts: { onPlay: () => void; onMute: () => void }) {
    $("play-btn").addEventListener("click", opts.onPlay);
    $("again-btn").addEventListener("click", opts.onPlay);
    this.muteBtn.addEventListener("click", opts.onMute);

    for (let i = 0; i < BALLS_PER_GAME; i++) {
      const p = document.createElement("div");
      p.className = "pip";
      this.pipsEl.appendChild(p);
      this.pips.push(p);
    }
  }

  setMuted(m: boolean): void {
    this.muteBtn.innerHTML = m ? "&#128263;" : "&#128266;";
  }

  setScore(v: number, immediate = false): void {
    this.target = v;
    if (immediate) {
      this.shown = v;
      this.scoreEl.textContent = String(v);
    }
  }

  /** Tween the visible counter toward the real score. */
  tick(dt: number): void {
    if (this.shown === this.target) return;
    const diff = this.target - this.shown;
    const step = Math.max(1, Math.ceil(Math.abs(diff) * dt * 7));
    this.shown += Math.sign(diff) * Math.min(step, Math.abs(diff));
    this.scoreEl.textContent = String(this.shown);
  }

  setBest(v: number): void {
    this.bestEl.textContent = `BEST ${v}`;
  }

  setBallsUsed(used: number): void {
    this.pips.forEach((p, i) => p.classList.toggle("spent", i < used));
  }

  setStreak(n: number): void {
    if (n >= 2) {
      this.streakEl.textContent = `${n}× STREAK`;
      this.streakEl.classList.add("on");
    } else {
      this.streakEl.classList.remove("on");
    }
  }

  setHint(text: string): void {
    this.hintEl.textContent = text;
    this.hintEl.style.opacity = text ? "1" : "0";
  }

  setPower(p: number | null): void {
    if (p === null) {
      this.powerWrap.classList.remove("on");
      return;
    }
    this.powerWrap.classList.add("on");
    this.powerFill.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
  }

  showStart(): void {
    this.startOv.classList.remove("hidden");
    this.overOv.classList.add("hidden");
  }

  hideOverlays(): void {
    this.startOv.classList.add("hidden");
    this.overOv.classList.add("hidden");
  }

  showGameOver(score: number, best: number, newBest: boolean, shots: number[]): void {
    $("final-score").textContent = String(score);
    const avg = shots.length ? score / shots.length : 0;
    const g = getGrade(avg);
    const gradeEl = $("grade");
    gradeEl.textContent = `${g.letter} — ${g.label}`;
    gradeEl.style.color = g.color;
    $("newbest").style.display = newBest ? "block" : "none";
    $("over-best").textContent = `Best ${best}`;
    const shotsEl = $("shots");
    shotsEl.innerHTML = "";
    for (const pts of shots) {
      const d = document.createElement("div");
      d.className = "shot";
      d.style.background = pts > 0 ? scoreColor(pts) : "#3a3358";
      d.style.color = pts > 0 ? "#0e0a1c" : "#8f88b5";
      d.textContent = pts > 0 ? String(pts) : "–";
      shotsEl.appendChild(d);
    }
    this.overOv.classList.remove("hidden");
  }
}

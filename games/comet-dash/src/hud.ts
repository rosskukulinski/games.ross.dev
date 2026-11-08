/** Thin wrapper around the HTML/CSS HUD overlay. */
export class Hud {
  private scoreEl = document.getElementById("score")!;
  private bestEl = document.getElementById("best")!;
  private speedBar = document.getElementById("speed-bar")!;
  private speedLabel = document.getElementById("speed-label")!;
  private hudEl = document.getElementById("hud")!;
  private startEl = document.getElementById("start-screen")!;
  private overEl = document.getElementById("gameover-screen")!;
  private goScoreEl = document.getElementById("go-score")!;
  private goBestEl = document.getElementById("go-best")!;
  private goNewBestEl = document.getElementById("go-newbest")!;
  private pausedEl = document.getElementById("paused-banner")!;
  private muteBtn = document.getElementById("mute")! as HTMLButtonElement;
  private restartBtn = document.getElementById("restart")! as HTMLButtonElement;
  private zonesEl = document.getElementById("zones")!;
  private zoneLeft = document.getElementById("zone-left")!;
  private zoneRight = document.getElementById("zone-right")!;
  private zoneJump = document.getElementById("zone-jump")!;
  private lastScore = -1;

  onMuteToggle: (() => void) | null = null;
  onRestart: (() => void) | null = null;

  constructor() {
    this.muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onMuteToggle?.();
    });
    // don't let the mute button start the game via the global pointer handler
    this.muteBtn.addEventListener("pointerdown", (e) => e.stopPropagation());

    // the restart button is the deliberate way back in; it too must not leak
    // its tap into the global handler (which would count it as a jump)
    this.restartBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.restartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRestart?.();
    });
  }

  /** The restart button greys out right after a crash, then pops in. */
  setRestartReady(ready: boolean): void {
    this.restartBtn.classList.toggle("ready", ready);
    this.restartBtn.disabled = !ready;
  }

  /** Light up the tap zone that was hit, plus a ripple where the finger landed. */
  tapFeedback(zone: "left" | "right" | "jump", x: number, y: number): void {
    const el = zone === "left" ? this.zoneLeft : zone === "right" ? this.zoneRight : this.zoneJump;
    el.classList.remove("hit");
    void el.offsetWidth; // restart the CSS animation
    el.classList.add("hit");

    const ripple = document.createElement("div");
    ripple.className = `ripple ripple-${zone}`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.addEventListener("animationend", () => ripple.remove());
    document.body.appendChild(ripple);
  }

  setScore(score: number): void {
    const s = Math.floor(score);
    if (s !== this.lastScore) {
      this.lastScore = s;
      this.scoreEl.textContent = String(s);
    }
  }

  setBest(best: number): void {
    this.bestEl.textContent = `BEST ${Math.floor(best)}`;
  }

  setSpeed(mult: number, frac: number): void {
    this.speedBar.style.width = `${Math.round(8 + frac * 92)}%`;
    this.speedLabel.innerHTML = `&times;${mult.toFixed(1)}`;
  }

  setMuted(muted: boolean): void {
    this.muteBtn.innerHTML = muted ? "&#128263;" : "&#128266;";
  }

  showStart(): void {
    this.zonesEl.classList.add("hidden");
    this.startEl.classList.remove("hidden");
    this.overEl.classList.add("hidden");
    this.hudEl.classList.add("hidden");
  }

  showPlaying(): void {
    this.zonesEl.classList.remove("hidden");
    this.startEl.classList.add("hidden");
    this.overEl.classList.add("hidden");
    this.hudEl.classList.remove("hidden");
  }

  showGameOver(score: number, best: number, isNewBest: boolean): void {
    this.goScoreEl.textContent = String(Math.floor(score));
    this.goBestEl.textContent = `BEST ${Math.floor(best)}`;
    this.goNewBestEl.classList.toggle("hidden", !isNewBest);
    this.overEl.classList.remove("hidden");
    this.hudEl.classList.add("hidden");
    this.zonesEl.classList.add("hidden");
  }

  setPaused(paused: boolean): void {
    this.pausedEl.classList.toggle("hidden", !paused);
  }
}

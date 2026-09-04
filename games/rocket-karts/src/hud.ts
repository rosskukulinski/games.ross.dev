/** In-race DOM overlay: position, laps, item slot, countdown, minimap, name tags. */
import type { TrackGeom } from './shared/track.ts';
import { ITEMS, type ItemId } from './shared/items.ts';
import type { Theme } from './shared/tracks.ts';

const ITEM_ICONS: Record<ItemId, string> = {
  turbo: '🍄',
  rocket: '🚀',
  bubble: '🫧',
  star: '⭐',
  zap: '⚡',
};

const SUFFIX = ['st', 'nd', 'rd', 'th'];

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

export interface TagInfo {
  name: string;
  color: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface MapKart {
  x: number;
  z: number;
  color: string;
  me: boolean;
  visible: boolean;
}

export class Hud {
  private lastPlace = 0;
  private lastCountdown = '';
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private tagNodes: HTMLDivElement[] = [];
  private map: { pts: { x: number; y: number }[]; startX: number; startY: number; toMap: (x: number, z: number) => [number, number] } | null = null;
  private theme: Theme | null = null;
  private seenHints = new Set<ItemId>();
  private readonly mapCanvas = el<HTMLCanvasElement>('minimap');
  private flashLevel = 0;

  show(v: boolean): void {
    el('hud').classList.toggle('hidden', !v);
  }

  showTouch(v: boolean): void {
    el('touch').classList.toggle('hidden', !v);
  }

  setPlace(place: number): void {
    if (place === this.lastPlace) return;
    this.lastPlace = place;
    const node = el('place');
    el('place-num').textContent = String(place);
    el('place-suffix').textContent = SUFFIX[Math.min(3, place - 1)] ?? 'th';
    node.className = `p${Math.min(4, place)}`;
    node.classList.add('bump');
    setTimeout(() => node.classList.remove('bump'), 260);
  }

  setLap(lap: number, total: number): void {
    const key = `${lap}/${total}`;
    if (key === this.lastLap) return;
    this.lastLap = key;
    el('lap-num').textContent = String(Math.max(1, Math.min(total, lap)));
    el('lap-total').textContent = `/${total}`;
  }

  private lastItem: ItemId | null | undefined;
  private lastLap = '';

  setItem(item: ItemId | null): void {
    if (item === this.lastItem) return;
    this.lastItem = item;
    const slot = el('item-slot');
    slot.classList.toggle('has', !!item);
    slot.classList.toggle('empty', !item);
    el('item-icon').textContent = item ? ITEM_ICONS[item] : '';
    el('item-name').textContent = item ? ITEMS[item].name : 'No item';
    const hint = el('item-hint');
    if (item && !this.seenHints.has(item)) {
      this.seenHints.add(item);
      hint.textContent = `${ITEMS[item].hint}. Press Enter or tap the box to use it.`;
      hint.classList.remove('hidden');
      setTimeout(() => hint.classList.add('hidden'), 4500);
    } else if (!item) {
      hint.classList.add('hidden');
    }
  }

  countdown(text: string | null, go = false): void {
    const node = el('countdown');
    if (text === null) {
      node.classList.add('hidden');
      this.lastCountdown = '';
      return;
    }
    if (text === this.lastCountdown) return;
    this.lastCountdown = text;
    node.textContent = text;
    node.classList.toggle('go', go);
    node.classList.remove('hidden');
    // restart the pop animation
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = '';
    if (go) setTimeout(() => this.countdown(null), 900);
  }

  banner(text: string, ms = 1600): void {
    const node = el('banner');
    node.textContent = text;
    node.classList.remove('hidden');
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = '';
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => node.classList.add('hidden'), ms);
  }

  wrongWay(v: boolean): void {
    el('wrongway').classList.toggle('hidden', !v);
  }

  speedlines(v: boolean): void {
    el('speedlines').style.opacity = v ? '1' : '0';
  }

  flash(level: number): void {
    this.flashLevel = Math.max(this.flashLevel, level);
  }

  setConnection(text: string): void {
    el('conn').textContent = text;
  }

  tick(dt: number): void {
    if (this.flashLevel > 0) {
      this.flashLevel = Math.max(0, this.flashLevel - dt * 2.5);
      el('flash').style.opacity = String(this.flashLevel);
    }
  }

  updateTags(tags: TagInfo[]): void {
    const host = el('tags');
    while (this.tagNodes.length < tags.length) {
      const d = document.createElement('div');
      d.className = 'tag';
      host.appendChild(d);
      this.tagNodes.push(d);
    }
    this.tagNodes.forEach((node, i) => {
      const t = tags[i];
      if (!t || !t.visible) {
        node.style.display = 'none';
        return;
      }
      node.style.display = '';
      node.textContent = t.name;
      node.style.setProperty('--c', t.color);
      node.style.transform = `translate(${t.x.toFixed(0)}px, ${t.y.toFixed(0)}px) translate(-50%, -100%)`;
    });
  }

  setTrack(geom: TrackGeom, theme: Theme): void {
    this.theme = theme;
    const size = this.mapCanvas.width;
    const xs = geom.samples.map((s) => s.x);
    const zs = geom.samples.map((s) => s.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const pad = 18;
    const scale = Math.min((size - pad * 2) / (maxX - minX), (size - pad * 2) / (maxZ - minZ));
    const offX = (size - (maxX - minX) * scale) / 2;
    const offY = (size - (maxZ - minZ) * scale) / 2;
    const toMap = (x: number, z: number): [number, number] => [offX + (x - minX) * scale, size - (offY + (z - minZ) * scale)];
    const pts = geom.samples.map((s) => {
      const [x, y] = toMap(s.x, s.z);
      return { x, y };
    });
    const [sx, sy] = toMap(geom.samples[0].x, geom.samples[0].z);
    this.map = { pts, startX: sx, startY: sy, toMap };
  }

  drawMap(karts: MapKart[]): void {
    const map = this.map;
    const ctx = this.mapCanvas.getContext('2d');
    if (!map || !ctx || !this.theme) return;
    const size = this.mapCanvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = (): void => {
      ctx.beginPath();
      map.pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
    };
    path();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 15;
    ctx.stroke();
    path();
    ctx.strokeStyle = this.theme.night ? '#3b3f6b' : '#e9e6f4';
    ctx.lineWidth = 10;
    ctx.stroke();
    // start line
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(map.startX, map.startY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(map.startX, map.startY, 2, 0, Math.PI * 2);
    ctx.fill();
    // karts, own one last so it sits on top
    const sorted = [...karts].sort((a, b) => Number(a.me) - Number(b.me));
    for (const k of sorted) {
      if (!k.visible) continue;
      const [x, y] = map.toMap(k.x, k.z);
      ctx.beginPath();
      ctx.arc(x, y, k.me ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = k.color;
      ctx.fill();
      ctx.lineWidth = k.me ? 3 : 1.5;
      ctx.strokeStyle = k.me ? '#fff' : 'rgba(0,0,0,0.5)';
      ctx.stroke();
    }
  }

  reset(): void {
    this.lastPlace = 0;
    this.lastItem = undefined;
    this.lastLap = '';
    this.setPlace(1);
    this.setItem(null);
    this.countdown(null);
    this.wrongWay(false);
    this.speedlines(false);
    el('banner').classList.add('hidden');
    this.updateTags([]);
  }
}

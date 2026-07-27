import { CHARACTERS } from '../game/data.js';

export default function Dialogue({ line, onNext }) {
  const who = CHARACTERS[line.who];
  return (
    <div className="dialogue-overlay" onClick={onNext}>
      <div className="dialogue-card">
        <div className="dialogue-portrait" style={{ background: who.color }}>
          <span>{who.emoji}</span>
        </div>
        <div className="dialogue-body">
          <div className="dialogue-name">
            {who.name} <span className="dialogue-role">{who.role}</span>
          </div>
          <p>{line.text}</p>
          <div className="dialogue-hint">Tap to continue ➜</div>
        </div>
      </div>
    </div>
  );
}

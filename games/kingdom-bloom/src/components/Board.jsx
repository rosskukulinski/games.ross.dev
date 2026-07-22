import { useEffect, useRef, useState } from 'react';
import { COLS, ROWS, CHAINS, GENERATORS } from '../game/data.js';

function TierPips({ tier }) {
  return (
    <span className="pips">
      {Array.from({ length: tier }, (_, i) => <i key={i} />)}
    </span>
  );
}

export default function Board({ board, selected, fx, dispatch }) {
  const gridRef = useRef(null);
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null); // { from, x, y, moved }

  const startDrag = (e, idx) => {
    if (e.button !== undefined && e.button !== 0) return;
    const cell = board[idx];
    if (!cell) {
      dispatch({ type: 'SELECT', idx: null });
      return;
    }
    e.preventDefault();
    const d = { from: idx, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
    dragRef.current = d;
    setDrag(d);
  };

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const moved = d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 8;
      const next = { ...d, x: e.clientX, y: e.clientY, moved };
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = (e) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setDrag(null);
      if (!d.moved) {
        const cell = board[d.from];
        if (cell?.kind === 'gen') dispatch({ type: 'TAP_GEN', idx: d.from });
        else if (cell) dispatch({ type: 'SELECT', idx: d.from });
        return;
      }
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const col = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
      const row = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        dispatch({ type: 'MOVE', from: d.from, to: row * COLS + col });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [board, dispatch]);

  const dragging = drag?.moved ? drag : null;
  const dragCell = dragging ? board[dragging.from] : null;

  return (
    <div className="board-wrap">
      <div className="board" ref={gridRef} style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
        {board.map((cell, idx) => {
          const isSelected = selected === idx;
          const isDragSource = dragging?.from === idx;
          const showFx = fx && fx.idx === idx && Date.now() - fx.ts < 1500;
          return (
            <div
              key={idx}
              className={`cell${isSelected ? ' selected' : ''}`}
              onPointerDown={(e) => startDrag(e, idx)}
            >
              {cell?.kind === 'gen' && (
                <div className={`piece gen${isDragSource ? ' dim' : ''}`} title={GENERATORS[cell.gen].name}>
                  <span className="emoji">{GENERATORS[cell.gen].emoji}</span>
                  <span className="gen-tag">TAP</span>
                </div>
              )}
              {cell?.kind === 'item' && (
                <div className={`piece item${isDragSource ? ' dim' : ''}`}>
                  <span className="emoji">{CHAINS[cell.chain].tiers[cell.tier - 1].e}</span>
                  <TierPips tier={cell.tier} />
                </div>
              )}
              {showFx && <span key={fx.ts} className={`fx fx-${fx.type}`}>✨</span>}
            </div>
          );
        })}
      </div>
      {dragging && dragCell && (
        <div className="drag-ghost" style={{ left: dragging.x, top: dragging.y }}>
          {dragCell.kind === 'gen'
            ? GENERATORS[dragCell.gen].emoji
            : CHAINS[dragCell.chain].tiers[dragCell.tier - 1].e}
        </div>
      )}
    </div>
  );
}

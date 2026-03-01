import { PHASES } from '../game/phases';
import './PhaseDisplay.css';

export default function PhaseDisplay({ currentPhase, completedPhases = [] }) {
  return (
    <div className="phase-display">
      <h3>Phases</h3>
      <div className="phase-list">
        {PHASES.map((phase) => {
          const isCompleted = completedPhases.includes(phase.number);
          const isCurrent = phase.number === currentPhase;

          return (
            <div
              key={phase.number}
              className={`phase-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <span className="phase-number">{phase.number}</span>
              <span className="phase-description">{phase.description}</span>
              {isCompleted && <span className="phase-check">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

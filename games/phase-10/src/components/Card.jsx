import './Card.css';

export default function Card({ card, faceDown = false, selected = false, onClick, small = false }) {
  if (faceDown) {
    return (
      <div className={`card card-back ${small ? 'card-small' : ''}`}>
        <div className="card-back-pattern">
          <span>P</span>
          <span>10</span>
        </div>
      </div>
    );
  }

  const getCardContent = () => {
    if (card.type === 'wild') {
      return { display: 'W', className: 'card-wild' };
    }
    if (card.type === 'skip') {
      return { display: 'S', className: 'card-skip' };
    }
    return { display: card.value, className: `card-${card.color}` };
  };

  const { display, className } = getCardContent();

  return (
    <div
      className={`card ${className} ${selected ? 'card-selected' : ''} ${small ? 'card-small' : ''} ${onClick ? 'card-clickable' : ''}`}
      onClick={onClick}
    >
      <div className="card-corner card-corner-top">{display}</div>
      <div className="card-center">{display}</div>
      <div className="card-corner card-corner-bottom">{display}</div>
    </div>
  );
}

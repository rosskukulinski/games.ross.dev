import Card from './Card';
import PhaseDisplay from './PhaseDisplay';
import { canHitOnGroup, getGroupType } from '../game/phases';
import './GameBoard.css';

export default function GameBoard({
  gameState,
  selectedCards,
  onCardSelect,
  onDrawDeck,
  onDrawDiscard,
  onLayDown,
  onDiscard,
  onHit,
}) {
  const { players, deck, discardPile, currentPlayer, turnPhase, message } = gameState;
  const humanPlayer = players[0];
  const bots = players.slice(1);
  const isHumanTurn = currentPlayer === 0;
  const discardTop = discardPile[discardPile.length - 1];

  const canDrawDeck = isHumanTurn && turnPhase === 'draw';
  const canDrawDiscard = isHumanTurn && turnPhase === 'draw' && discardTop && discardTop.type !== 'skip';
  const canLayDown = isHumanTurn && turnPhase === 'play' && !humanPlayer.hasLaidPhase && selectedCards.length > 0;
  const canDiscard = isHumanTurn && turnPhase === 'play' && selectedCards.length === 1;
  const canHit = isHumanTurn && turnPhase === 'play' && humanPlayer.hasLaidPhase && selectedCards.length === 1;

  // Check if a card can hit on a specific group
  const canHitGroup = (card, playerIndex, groupIndex) => {
    const player = players[playerIndex];
    if (!player.laidPhase) return false;
    const group = player.laidPhase[groupIndex];
    const groupType = getGroupType(player.currentPhase, groupIndex);
    return canHitOnGroup(card, group, groupType);
  };

  // Calculate completed phases (all phases before current one)
  const completedPhases = [];
  for (let i = 1; i < humanPlayer.currentPhase; i++) {
    completedPhases.push(i);
  }

  return (
    <div className="game-board">
      {/* Left sidebar - Phase display */}
      <div className="sidebar-left">
        <PhaseDisplay
          currentPhase={humanPlayer.currentPhase}
          completedPhases={completedPhases}
        />
      </div>

      {/* Main game area */}
      <div className="main-area">
        {/* Message area */}
        <div className="message-area">
          {message && <div className="game-message">{message}</div>}
          <div className="turn-indicator">
            {isHumanTurn ? "Your turn" : `${players[currentPlayer].name}'s turn`}
            {isHumanTurn && turnPhase === 'draw' && " - Draw a card"}
            {isHumanTurn && turnPhase === 'play' && " - Play or discard"}
          </div>
        </div>

        {/* Bot areas */}
        <div className="bots-area">
          {bots.map((bot, index) => (
            <div key={index} className={`bot-area ${currentPlayer === index + 1 ? 'active' : ''}`}>
              <div className="bot-name">{bot.name}</div>
              <div className="bot-info">
                Phase {bot.currentPhase} | {bot.hand.length} cards
              </div>
              <div className="bot-cards">
                {bot.hand.slice(0, 5).map((_, i) => (
                  <Card key={i} faceDown small />
                ))}
                {bot.hand.length > 5 && (
                  <span className="more-cards">+{bot.hand.length - 5}</span>
                )}
              </div>
              {bot.laidPhase && (
                <div className="laid-phase">
                  {bot.laidPhase.map((group, gi) => {
                    const isHittable = canHit && selectedCards.length === 1 && canHitGroup(selectedCards[0], index + 1, gi);
                    return (
                      <div
                        key={gi}
                        className={`laid-group ${isHittable ? 'hittable' : ''}`}
                        onClick={isHittable ? () => onHit(selectedCards[0], index + 1, gi) : undefined}
                      >
                        {group.map((card) => (
                          <Card key={card.id} card={card} small />
                        ))}
                        {isHittable && <div className="hit-indicator">+ Hit</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Center - Deck and Discard */}
        <div className="center-area">
          <div
            className={`deck-pile ${canDrawDeck ? 'clickable' : ''}`}
            onClick={canDrawDeck ? onDrawDeck : undefined}
          >
            <Card faceDown />
            <div className="pile-label">Deck ({deck.length})</div>
          </div>

          <div
            className={`discard-pile ${canDrawDiscard ? 'clickable' : ''}`}
            onClick={canDrawDiscard ? onDrawDiscard : undefined}
          >
            {discardTop ? (
              <Card card={discardTop} />
            ) : (
              <div className="empty-pile">Empty</div>
            )}
            <div className="pile-label">Discard</div>
          </div>
        </div>

        {/* Player's laid phase */}
        {humanPlayer.laidPhase && (
          <div className="player-laid-phase">
            <div className="laid-phase-label">Your Phase {humanPlayer.currentPhase}</div>
            <div className="laid-groups">
              {humanPlayer.laidPhase.map((group, gi) => {
                const isHittable = canHit && selectedCards.length === 1 && canHitGroup(selectedCards[0], 0, gi);
                return (
                  <div
                    key={gi}
                    className={`laid-group ${isHittable ? 'hittable' : ''}`}
                    onClick={isHittable ? () => onHit(selectedCards[0], 0, gi) : undefined}
                  >
                    {group.map((card) => (
                      <Card key={card.id} card={card} small />
                    ))}
                    {isHittable && <div className="hit-indicator">+ Hit</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Player's hand */}
        <div className="player-area">
          <div className="player-hand">
            {humanPlayer.hand.map((card) => (
              <Card
                key={card.id}
                card={card}
                selected={selectedCards.some(c => c.id === card.id)}
                onClick={isHumanTurn && turnPhase === 'play' ? () => onCardSelect(card) : undefined}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="action-buttons">
            {canLayDown && (
              <button className="action-btn lay-btn" onClick={onLayDown}>
                Lay Down Phase
              </button>
            )}
            {canDiscard && (
              <button className="action-btn discard-btn" onClick={onDiscard}>
                Discard Selected
              </button>
            )}
            {isHumanTurn && turnPhase === 'play' && selectedCards.length > 1 && !humanPlayer.hasLaidPhase && (
              <div className="selection-hint">
                Select cards for your phase, or select 1 card to discard
              </div>
            )}
            {canHit && (
              <div className="selection-hint">
                Click a laid group to hit, or discard the selected card
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

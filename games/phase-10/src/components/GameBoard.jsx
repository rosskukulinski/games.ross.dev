import Card from './Card';
import PhaseDisplay from './PhaseDisplay';
import GoalStrip from './GoalStrip';
import { canHitOnGroup, getGroupType, findPhaseCards } from '../game/phases';
import { sortHand, helpfulCardIds } from '../game/helper';
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
  onHelp,
  onEarlyCardTap,
  onClearSelection,
  nudge = 0,
}) {
  const { players, deck, discardPile, currentPlayer, turnPhase, message, easy, celebrate } = gameState;
  const humanPlayer = players[0];
  const bots = players.slice(1);
  const isHumanTurn = currentPlayer === 0;
  const discardTop = discardPile[discardPile.length - 1];

  const canDrawDeck = isHumanTurn && turnPhase === 'draw';
  const canDrawDiscard = isHumanTurn && turnPhase === 'draw' && discardTop && discardTop.type !== 'skip';
  const inPlay = isHumanTurn && turnPhase === 'play';
  // Whole hand can make the phase right now / the selection already does.
  const handCanLay = inPlay && !humanPlayer.hasLaidPhase && !!findPhaseCards(humanPlayer.hand, humanPlayer.currentPhase);
  const selectionLays = inPlay && !humanPlayer.hasLaidPhase && selectedCards.length > 0 &&
    !!findPhaseCards(selectedCards, humanPlayer.currentPhase);
  // Easy: the button only appears when it will work. Classic: any selection.
  const canLayDown = inPlay && !humanPlayer.hasLaidPhase && (easy ? handCanLay : selectedCards.length > 0);
  const layReady = easy ? handCanLay : selectionLays;
  const helpful = easy && !humanPlayer.hasLaidPhase ? helpfulCardIds(humanPlayer.hand, humanPlayer.currentPhase) : new Set();
  const hand = sortHand(humanPlayer.hand);
  const nudging = Date.now() - nudge < 1200;
  const showCelebrate = celebrate && Date.now() - celebrate.id < 2500;
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
      {showCelebrate && (
        <div key={celebrate.id} className="celebrate" aria-live="polite">
          <div className="celebrate-stars">⭐⭐⭐</div>
          <div className="celebrate-text">{celebrate.text}</div>
        </div>
      )}
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
            key={`deck-${nudge}`}
            className={`deck-pile ${canDrawDeck ? 'clickable draw-cue' : ''} ${canDrawDeck && nudging ? 'nudge' : ''}`}
            onClick={canDrawDeck ? onDrawDeck : undefined}
          >
            {canDrawDeck && <div className="draw-arrow" aria-hidden="true">👇</div>}
            <Card faceDown />
            <div className="pile-label">Deck ({deck.length})</div>
          </div>

          <div
            key={`disc-${nudge}`}
            className={`discard-pile ${canDrawDiscard ? 'clickable' : ''} ${canDrawDiscard && nudging ? 'nudge' : ''}`}
            onClick={canDrawDiscard ? onDrawDiscard : undefined}
          >
            {discardTop ? (
              <Card card={discardTop} />
            ) : (
              <div className="empty-pile">Empty</div>
            )}
            <div className="pile-label">Discard</div>
          </div>

          {/* Player's laid phase */}
          {humanPlayer.laidPhase && (
            <div className="player-laid-phase">
              <div className="laid-phase-label">⭐ Phase {humanPlayer.currentPhase} done! Throw away the rest.</div>
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
          {!humanPlayer.laidPhase && (
            <GoalStrip
              hand={humanPlayer.hand}
              phase={humanPlayer.currentPhase}
              easy={easy}
              laid={humanPlayer.hasLaidPhase}
            />
          )}
        </div>

        {/* Player's hand */}
        <div className="player-area">
          <div className="player-hand">
            {hand.map((card) => (
              <Card
                key={card.id}
                card={card}
                helpful={helpful.has(card.id)}
                selected={selectedCards.some(c => c.id === card.id)}
                onClick={
                  inPlay ? () => onCardSelect(card)
                    : canDrawDeck ? onEarlyCardTap
                    : undefined
                }
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="action-buttons">
            {easy && isHumanTurn && (
              <button className="action-btn help-btn" onClick={onHelp}>
                💡 Help me
              </button>
            )}
            {canLayDown && (
              <button className={`action-btn lay-btn ${layReady ? 'lay-ready' : ''}`} onClick={() => onLayDown()}>
                {layReady ? '⭐ Lay down!' : 'Lay Down Phase'}
              </button>
            )}
            {canDiscard && (
              <button className="action-btn discard-btn" onClick={() => onDiscard()}>
                👋 Discard
              </button>
            )}
            {inPlay && selectedCards.length > 1 && (
              <button className="action-btn clear-btn" onClick={onClearSelection}>
                ✕ Clear
              </button>
            )}
            {inPlay && selectedCards.length === 0 && (
              <div className="selection-hint">
                {easy && helpful.size > 0 ? 'Keep the ⭐ cards. Tap one card to throw away.' : 'Tap 1 card to throw away'}
              </div>
            )}
            {inPlay && selectedCards.length > 1 && !humanPlayer.hasLaidPhase && !layReady && (
              <div className="selection-hint">Pick 1 card to throw away</div>
            )}
            {canHit && (
              <div className="selection-hint">
                Tap a glowing group to add your card, or discard it
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

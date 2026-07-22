import { CHAINS, CHARACTERS } from '../game/data.js';
import { orderProgress } from '../game/state.js';

function OrderCard({ order, board, dispatch }) {
  const who = CHARACTERS[order.who];
  const progress = orderProgress(board, order.items);
  const ready = progress.every(Boolean);
  return (
    <div className={`order${ready ? ' ready' : ''}`}>
      <div className="order-who" style={{ background: who.color }}>
        <span>{who.emoji}</span>
      </div>
      <div className="order-items">
        {order.items.map((req, i) => (
          <div key={i} className={`order-item${progress[i] ? ' have' : ''}`}>
            <span className="emoji">{CHAINS[req.chain].tiers[req.tier - 1].e}</span>
            <span className="order-check">{progress[i] ? '✓' : ''}</span>
          </div>
        ))}
      </div>
      <div className="order-reward">
        <span>+{order.coins} 🪙</span>
        <span>+{order.stars} ⭐</span>
      </div>
      <button
        className="btn deliver"
        disabled={!ready}
        onClick={() => dispatch({ type: 'DELIVER', orderId: order.id })}
      >
        {ready ? 'Deliver!' : 'Merging...'}
      </button>
    </div>
  );
}

export default function Orders({ orders, board, dispatch }) {
  return (
    <div className="orders">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} board={board} dispatch={dispatch} />
      ))}
    </div>
  );
}

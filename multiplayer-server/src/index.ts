/**
 * Multiplayer server for the arcade.
 *
 * One Cloudflare Worker that upgrades WebSocket connections and hands them to
 * a Durable Object, one per room code, one class per game:
 *
 *   /room/<CODE>               Air Hockey (legacy path, kept for old clients)
 *   /air-hockey/room/<CODE>    Air Hockey
 *   /rocket-karts/room/<CODE>  Rocket Karts
 *
 * Each game's simulation lives in its own game directory and is imported here
 * verbatim, so the server and the client can never disagree about the rules.
 */
import type { Env } from './env';
import { isValidCode as isValidHockeyCode } from '../../games/air-hockey/src/shared/rules';
import { isValidCode as isValidKartCode } from '../../games/rocket-karts/src/shared/codes.ts';

export { AirHockeyRoom } from './airHockeyRoom';
export { KartRoom } from './kartRoom';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Tolerate being mounted under a path prefix (e.g. a games.ross.dev/mp/*
    // Worker route) as well as at the root of a workers.dev subdomain.
    const path = url.pathname.replace(/^\/mp(?=\/|$)/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (path === '/' || path === '/health') {
      return Response.json({ ok: true, service: 'arcade', games: ['air-hockey', 'rocket-karts'] }, { headers: CORS });
    }

    const roomMatch = path.match(/^\/(?:(air-hockey|rocket-karts)\/)?room\/([A-Za-z0-9]+)$/);
    if (roomMatch) {
      const game = roomMatch[1] ?? 'air-hockey';
      const code = roomMatch[2].toUpperCase();
      const valid = game === 'rocket-karts' ? isValidKartCode(code) : isValidHockeyCode(code);
      if (!valid) {
        return new Response('Bad room code', { status: 400, headers: CORS });
      }
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426, headers: CORS });
      }
      const ns = game === 'rocket-karts' ? env.KART_ROOMS : env.ROOMS;
      const id = ns.idFromName(code);
      return ns.get(id).fetch(request);
    }

    return new Response('Not found', { status: 404, headers: CORS });
  },
};

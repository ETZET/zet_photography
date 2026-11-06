// Tiny path router: /, /about, /login, /manage, /game, /game/<id>, /game/<id>/<ROOM>.
// Old links (?game=<id>&room=CODE) are rewritten to the path form on load.
// Only `local=1` (dev multi-tab mode) survives in the query string.
import { useEffect, useState } from 'react';

const PAGES = ['about', 'login', 'manage', 'game'];
const EVT = 'zet:route';

export function parseRoute(loc = window.location) {
  const q = new URLSearchParams(loc.search);
  const parts = loc.pathname.split('/').filter(Boolean);
  if (q.get('game')) return { page: 'game', game: q.get('game'), room: q.get('room')?.toUpperCase() || null };
  const page = PAGES.includes(parts[0]) ? parts[0] : 'work';
  if (page !== 'game') return { page, game: null, room: null };
  return { page, game: parts[1] || null, room: parts[2]?.toUpperCase() || null };
}

function keptQuery() {
  const q = new URLSearchParams(window.location.search);
  return q.get('local') === '1' ? '?local=1' : '';
}

export function pathOf({ page, game, room }) {
  if (page === 'work' || !page) return '/';
  if (page !== 'game') return `/${page}`;
  return ['/game', game, game && room].filter(Boolean).join('/');
}

/** Full shareable URL for a room. */
export const roomLink = (game, room) => `${window.location.origin}${pathOf({ page: 'game', game, room })}${keptQuery()}`;

export function navigate(route, { replace = false } = {}) {
  const url = pathOf(route) + keptQuery();
  if (url === window.location.pathname + window.location.search) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
  window.dispatchEvent(new Event(EVT));
}

export function useRoute() {
  const [route, setRoute] = useState(() => {
    const r = parseRoute();
    // normalise legacy query links / odd casing to the canonical path
    const canon = pathOf(r) + keptQuery();
    if (canon !== window.location.pathname + window.location.search) window.history.replaceState(null, '', canon);
    return r;
  });
  useEffect(() => {
    const sync = () => setRoute(parseRoute());
    window.addEventListener('popstate', sync);
    window.addEventListener(EVT, sync);
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener(EVT, sync); };
  }, []);
  return route;
}

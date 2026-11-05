// Room transport. Same async interface (get / create / update / subscribe)
// for two backends:
//
//  - remote (default): Amplify Data / AppSync. Guests (Cognito identity pool,
//    no login) read & write one `AvalonRoom` row per room; realtime updates
//    arrive over GraphQL subscriptions. Writes are optimistic-concurrency
//    checked on `version`, and retried on conflict.
//  - local (`?local=1`): localStorage + `storage` events, so several tabs on
//    one machine can play offline.

import { generateClient } from 'aws-amplify/data';

// Rooms expire 3 days after their last write; DynamoDB TTL then deletes the row.
const ROOM_TTL_S = 3 * 24 * 60 * 60;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I / O

function randomCode() {
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  return Array.from(buf, n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}

export const IS_LOCAL = (() => {
  try { return new URLSearchParams(window.location.search).get('local') === '1'; } catch { return false; }
})();

// ---------------------------------------------------------------- local ---

const PREFIX = 'avalon:room:';
const LOCAL_EVENT = 'avalon-room-change';
const lkey = code => PREFIX + code.toUpperCase();

function lread(code) {
  try {
    const raw = localStorage.getItem(lkey(code));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lwrite(room) {
  room.updatedAt = Date.now();
  localStorage.setItem(lkey(room.code), JSON.stringify(room));
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: room.code }));
}

const localStore = {
  async get(code) { return lread(code); },
  async create(room) {
    let code;
    do { code = randomCode(); } while (lread(code));
    const full = { ...room, code, createdAt: Date.now() };
    lwrite(full);
    return full;
  },
  async update(code, mutator) {
    const current = lread(code);
    if (!current) throw new Error('房间不存在');
    const next = mutator(structuredClone(current));
    if (next === null) {
      localStorage.removeItem(lkey(code));
      window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: code }));
      return null;
    }
    lwrite(next);
    return next;
  },
  subscribe(code, onChange) {
    const k = lkey(code);
    const onStorage = e => { if (e.key === k) onChange(lread(code)); };
    const onLocal = e => { if (e.detail === code.toUpperCase()) onChange(lread(code)); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(LOCAL_EVENT, onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LOCAL_EVENT, onLocal);
    };
  },
};

// --------------------------------------------------------------- remote ---

const FIELDS = 'code state version ttl';
const Q_GET = `query G($code: ID!) { getAvalonRoom(code: $code) { ${FIELDS} } }`;
// create already fails with ConditionalCheckFailed if the code is taken.
const M_CREATE = `mutation C($input: CreateAvalonRoomInput!) { createAvalonRoom(input: $input) { ${FIELDS} } }`;
const M_UPDATE = `mutation U($input: UpdateAvalonRoomInput!, $condition: ModelAvalonRoomConditionInput) {
  updateAvalonRoom(input: $input, condition: $condition) { ${FIELDS} } }`;
const M_DELETE = `mutation D($input: DeleteAvalonRoomInput!) { deleteAvalonRoom(input: $input) { ${FIELDS} } }`;
const S_UPDATE = `subscription SU($filter: ModelSubscriptionAvalonRoomFilterInput) {
  onUpdateAvalonRoom(filter: $filter) { ${FIELDS} } }`;
const S_DELETE = `subscription SD($filter: ModelSubscriptionAvalonRoomFilterInput) {
  onDeleteAvalonRoom(filter: $filter) { ${FIELDS} } }`;

let client;
const gql = () => (client ??= generateClient({ authMode: 'identityPool' }));

async function call(query, variables) {
  try {
    return (await gql().graphql({ query, variables })).data;
  } catch (e) {
    const msg = e?.errors?.[0]?.errorType || e?.errors?.[0]?.message || e?.message || String(e);
    const err = new Error(msg);
    err.conflict = /ConditionalCheckFailed/i.test(msg);
    throw err;
  }
}

// DynamoDB TTL deletes lazily (can lag up to ~48h), so treat expired rows as gone.
const expired = row => typeof row.ttl === 'number' && row.ttl * 1000 < Date.now();

const parse = row => {
  if (!row || expired(row)) return null;
  const state = typeof row.state === 'string' ? JSON.parse(row.state) : row.state;
  return { ...state, code: row.code, version: row.version };
};

const ttl = () => Math.floor(Date.now() / 1000) + ROOM_TTL_S;
const serialize = room => {
  const state = { ...room, updatedAt: Date.now() };
  delete state.version;
  return JSON.stringify(state);
};

// Newest copy of each room this tab has seen (mutation responses and
// subscription events). Subscription events can arrive out of order, and
// AppSync `get` is an eventually-consistent read, so never go backwards.
const latest = new Map();
const fresher = room => {
  if (!room) return true;
  const cur = latest.get(room.code);
  if (cur && room.version < cur.version) return false;
  latest.set(room.code, room);
  return true;
};
// Same-tab listeners, so our own writes show up instantly instead of
// waiting for the subscription round-trip.
const listeners = new Map();
const emit = (code, room) => listeners.get(code)?.forEach(fn => fn(room));

const newest = (a, b) => (!a ? b : !b ? a : a.version >= b.version ? a : b);

const remoteStore = {
  async get(code) {
    const d = await call(Q_GET, { code: code.toUpperCase() });
    const room = parse(d.getAvalonRoom);
    if (!room) { latest.delete(code.toUpperCase()); return null; }
    fresher(room);
    return newest(room, latest.get(room.code));
  },

  async create(room) {
    for (let i = 0; i < 8; i++) {
      const code = randomCode();
      const full = { ...room, code, createdAt: Date.now() };
      try {
        const d = await call(M_CREATE, {
          input: { code, state: serialize(full), version: 1, ttl: ttl() },
        });
        const out = parse(d.createAvalonRoom);
        fresher(out);
        return out;
      } catch (e) {
        if (!e.conflict) throw e; // code collision → try another
      }
    }
    throw new Error('创建房间失败，请重试');
  },

  /** Read-modify-write with optimistic concurrency; retries on conflict. */
  async update(code, mutator) {
    code = code.toUpperCase();
    for (let i = 0; i < 12; i++) {
      // first try uses our cached copy (fast path); after a conflict, refetch
      const fetched = i === 0 && latest.get(code) ? null : await this.get(code);
      const current = newest(fetched, latest.get(code));
      if (!current) throw new Error('房间不存在');
      const next = mutator(structuredClone(current));
      try {
        if (next === null) {
          await call(M_DELETE, { input: { code } });
          latest.delete(code);
          emit(code, null);
          return null;
        }
        const d = await call(M_UPDATE, {
          input: { code, state: serialize(next), version: current.version + 1, ttl: ttl() },
          condition: { version: { eq: current.version } },
        });
        const out = parse(d.updateAvalonRoom);
        if (fresher(out)) emit(code, out);
        return out;
      } catch (e) {
        if (!e.conflict) throw e;
        await new Promise(r => setTimeout(r, Math.min(1000, 60 * 2 ** i) * (0.5 + Math.random())));
      }
    }
    throw new Error('同时操作的人太多了，请再试一次');
  },

  subscribe(code, onChange) {
    code = code.toUpperCase();
    const filter = { code: { eq: code } };
    if (!listeners.has(code)) listeners.set(code, new Set());
    listeners.get(code).add(onChange);
    const subs = [
      gql().graphql({ query: S_UPDATE, variables: { filter } }).subscribe({
        next: ({ data }) => {
          const room = parse(data.onUpdateAvalonRoom);
          if (room?.code === code && fresher(room)) onChange(room);
        },
        error: e => console.warn('[avalon] update subscription', e),
      }),
      gql().graphql({ query: S_DELETE, variables: { filter } }).subscribe({
        next: ({ data }) => { if (data.onDeleteAvalonRoom?.code === code) { latest.delete(code); onChange(null); } },
        error: e => console.warn('[avalon] delete subscription', e),
      }),
    ];
    // Safety net: resync on tab focus / reconnect (phones sleep a lot).
    const resync = () => { if (document.visibilityState === 'visible') this.get(code).then(onChange).catch(() => {}); };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    const poll = setInterval(resync, 15000);
    return () => {
      listeners.get(code)?.delete(onChange);
      subs.forEach(s => s.unsubscribe());
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
      clearInterval(poll);
    };
  },
};

export const roomStore = IS_LOCAL ? localStore : remoteStore;

/**
 * Player identity. Remote: localStorage, so closing and reopening the link on
 * a phone keeps your seat. Local demo: sessionStorage, so each tab is a new
 * player. A sessionStorage id always wins (lets tests mirror a player).
 */
let fallbackId = null;
export function getPlayerId() {
  try {
    let id = sessionStorage.getItem('avalon:pid');
    if (id) return id;
    if (!IS_LOCAL) {
      id = localStorage.getItem('avalon:pid');
      if (!id) { id = crypto.randomUUID(); localStorage.setItem('avalon:pid', id); }
      return id;
    }
    id = crypto.randomUUID();
    sessionStorage.setItem('avalon:pid', id);
    return id;
  } catch {
    fallbackId ??= crypto.randomUUID();
    return fallbackId;
  }
}

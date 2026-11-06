// Every game folder registers itself with a meta.js:
//   export default { id, title, en, desc, art, order, Game }
// so adding a game never touches shared files.
const mods = import.meta.glob('./*/meta.js', { eager: true });

export const GAMES = Object.values(mods).map(m => m.default).sort((a, b) => a.order - b.order);
export const GAME_BY_ID = Object.fromEntries(GAMES.map(g => [g.id, g]));
export const GAME_TITLES = Object.fromEntries(GAMES.map(g => [g.id, g.title]));

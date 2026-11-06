// 32x32 original character portraits drawn with the pixel painter.
// Each has a distinct silhouette + colour key so roles read at a glance:
//   Merlin   – tall starry hat, white beard, staff with glowing orb (blue/white)
//   Percival – great helm with plume, gold cross tabard, holds the Grail (silver/gold)
//   Servant  – young squire, round shield, spear (blue/brown)
//   Assassin – deep hood, red scarf mask, glowing eyes, dagger (black/red)
//   Morgana  – long violet hair, circlet, high collar, magic orb (violet)
//   Mordred  – horned black helm, crown, red visor glow, crimson cape (black/crimson)
//   Oberon   – fairy king: antlers, pointed ears, sly grin, fireflies (green)
//   Minion   – tusked grunt in kettle helm with an axe (iron/crimson)
import { paint } from './paint';
import { WOLF_PORTRAITS } from './wolfPortraits';

const K = '#170f22';
const S = 32;

const merlin = paint(S, S, p => {
  // staff (behind)
  p.line(5, 9, 5, 31, 'wood', 2);
  // robe
  p.poly([[3, 31], [6, 22], [11, 19], [21, 19], [26, 22], [29, 31]], 'blue');
  p.rect(13, 19, 19, 31, 'navy');
  p.rect(4, 29, 9, 30, 'gold');
  p.rect(23, 29, 28, 30, 'gold');
  // face
  p.ellipse(16, 15, 5, 4, 'skin');
  // beard + moustache
  p.poly([[10, 16], [22, 16], [21, 23], [18, 29], [16, 31], [14, 29], [11, 23]], 'white');
  p.rect(12, 17, 20, 18, 'white');
  p.dots([[15, 18], [16, 18], [17, 18]], '#c97f5f');
  // hat (tip curls right)
  p.poly([[20, 1], [23, 2], [21, 4], [10, 12], [23, 12]], 'blue');
  p.rect(7, 12, 25, 13, 'navy');
  // stars on hat
  p.dots([[16, 6], [15, 7], [16, 7], [17, 7], [16, 8]], '#ffe88a');
  p.dots([[19, 9], [13, 10]], '#ffe88a');
  // brows + eyes
  p.dots([[12, 14], [13, 14], [14, 14], [18, 14], [19, 14], [20, 14]], '#ffffff');
  p.dots([[14, 15], [18, 15]], K);
  // orb + hand
  p.ellipse(5.5, 6, 3, 3, 'glow');
  p.dots([[4, 5], [5, 4]], '#ffffff');
  p.ellipse(6, 23, 2, 2, 'skin');
  p.dots([[1, 3], [9, 2], [2, 10]], '#bff4ff');
});

const percival = paint(S, S, p => {
  // plume
  p.ellipse(22, 3, 6, 2, 'sky');
  p.ellipse(26, 6, 3, 2, 'sky');
  // body
  p.ellipse(8, 22, 5, 3, 'metal');
  p.ellipse(24, 22, 5, 3, 'metal');
  p.poly([[7, 31], [9, 21], [23, 21], [25, 31]], 'navy');
  p.rect(14, 22, 16, 31, 'gold');
  p.rect(10, 25, 20, 26, 'gold');
  // helm
  p.ellipse(16, 9, 7, 6, 'metal');
  p.rect(9, 9, 23, 18, 'metal');
  p.rect(11, 18, 21, 20, 'iron');
  p.line(16, 2, 16, 9, 'gold');
  p.rect(10, 11, 22, 12, 'black');
  p.rect(15, 12, 17, 16, 'black');
  p.dots([[11, 15], [12, 16], [20, 15], [21, 16]], '#353a48');
  // grail
  p.poly([[21, 25], [28, 25], [27, 28], [22, 28]], 'gold');
  p.rect(24, 29, 25, 29, 'gold');
  p.rect(22, 30, 27, 30, 'gold');
  p.dots([[22, 26], [23, 26]], '#ffffff');
  p.ellipse(25, 31, 2, 0, 'metal');
  p.dots([[24, 22], [21, 23], [28, 23], [26, 21]], '#fff3a8');
});

const servant = paint(S, S, p => {
  // spear
  p.line(27, 5, 27, 31, 'wood');
  p.poly([[27, 0], [25, 5], [29, 5]], 'metal');
  // body
  p.poly([[5, 31], [8, 22], [12, 20], [20, 20], [24, 22], [27, 31]], 'blue');
  p.rect(13, 20, 19, 21, 'white');
  p.rect(8, 28, 25, 28, 'brown');
  // head
  p.ellipse(16, 11, 7, 6, 'brown');
  p.ellipse(16, 14, 5, 5, 'skin');
  p.poly([[10, 8], [22, 8], [22, 11], [19, 10], [16, 11], [13, 10], [10, 12]], 'brown');
  p.dots([[14, 14], [18, 14]], K);
  p.dots([[15, 17], [16, 17], [17, 17]], '#a8584a');
  p.dots([[12, 16], [20, 16]], '#f59a8a');
  // round shield
  p.ellipse(9, 25, 6, 6, 'metal');
  p.ellipse(9, 25, 5, 5, 'blue');
  p.rect(8, 20, 10, 30, 'gold');
  p.rect(4, 24, 14, 26, 'gold');
  p.ellipse(9, 25, 1, 1, 'metal');
});

const assassin = paint(S, S, p => {
  // cloak
  p.poly([[2, 31], [6, 20], [26, 20], [30, 31]], 'black');
  // hood
  p.ellipse(16, 11, 10, 10, 'black');
  p.poly([[16, 0], [8, 6], [24, 6]], 'black');
  // face hole
  p.ellipse(16, 13, 5, 5, '#0b0812');
  // glowing eyes
  p.dots([[13, 12], [14, 13], [19, 12], [18, 13]], '#ffd23f');
  // scarf mask + tail
  p.rect(10, 16, 22, 19, 'red');
  p.poly([[20, 19], [28, 23], [25, 25], [19, 21]], 'red');
  // dagger raised
  p.rect(25, 6, 26, 16, 'metal');
  p.dots([[25, 5]], '#f2f6fa');
  p.rect(23, 17, 28, 17, 'gold');
  p.rect(25, 18, 26, 21, 'brown');
  p.ellipse(25.5, 21, 2, 2, 'black');
  p.dots([[25, 8], [25, 9]], '#ffffff');
});

const morgana = paint(S, S, p => {
  // hair (back)
  p.ellipse(16, 10, 9, 8, 'plum');
  p.poly([[7, 10], [25, 10], [27, 30], [5, 30]], 'plum');
  // dress + high collar
  p.poly([[7, 31], [10, 20], [22, 20], [25, 31]], 'violet');
  p.poly([[6, 17], [12, 21], [8, 23]], 'plum');
  p.poly([[26, 17], [20, 21], [24, 23]], 'plum');
  p.poly([[14, 20], [18, 20], [16, 24]], 'pale');
  // face
  p.ellipse(16, 13, 5, 6, 'pale');
  // fringe
  p.poly([[10, 5], [22, 5], [23, 10], [19, 8], [16, 10], [13, 8], [9, 10]], 'plum');
  // circlet + gem
  p.line(10, 7, 22, 7, 'gold');
  p.dots([[16, 6], [16, 7]], '#5fffa0');
  // eyes, lashes, lips
  p.dots([[14, 13], [18, 13]], '#7a2fc2');
  p.dots([[13, 12], [19, 12]], K);
  p.dots([[15, 16], [16, 16], [17, 16]], '#a8203a');
  // orb + hands
  p.ellipse(16, 26, 3, 3, 'magic');
  p.dots([[15, 25]], '#ffffff');
  p.ellipse(12, 28, 2, 1, 'pale');
  p.ellipse(20, 28, 2, 1, 'pale');
  p.dots([[11, 23], [22, 24], [16, 21]], '#ffd6ff');
});

const mordred = paint(S, S, p => {
  // cape
  p.poly([[2, 31], [6, 19], [26, 19], [30, 31]], 'crimson');
  // horns
  p.poly([[4, 1], [6, 2], [11, 9], [9, 11], [5, 6]], 'bone');
  p.poly([[28, 1], [26, 2], [21, 9], [23, 11], [27, 6]], 'bone');
  // armour
  p.ellipse(7, 21, 4, 3, 'iron');
  p.ellipse(25, 21, 4, 3, 'iron');
  p.poly([[9, 21], [23, 21], [22, 31], [10, 31]], 'black');
  p.poly([[16, 23], [19, 26], [16, 29], [13, 26]], 'crimson');
  // helm
  p.ellipse(16, 11, 7, 7, 'iron');
  p.rect(9, 11, 23, 18, 'iron');
  p.rect(11, 18, 21, 20, 'black');
  // crown
  p.rect(10, 4, 22, 5, 'gold');
  p.dots([[10, 3], [13, 2], [16, 1], [19, 2], [22, 3], [16, 2], [13, 3], [19, 3]], '#f0b432');
  p.dots([[16, 4]], '#ff3b3b');
  // visor glow
  p.rect(11, 11, 21, 12, '#ff4a3a');
  p.dots([[13, 11], [19, 11]], '#ffd0b0');
  p.rect(16, 13, 16, 16, '#1d1a28');
  p.dots([[5, 19], [27, 19], [4, 20], [28, 20]], '#8d95a6');
});

const oberon = paint(S, S, p => {
  // antlers
  p.line(10, 9, 7, 1, 'bone', 2);
  p.line(8, 4, 3, 2, 'bone', 2);
  p.line(9, 6, 3, 7, 'bone', 2);
  p.line(21, 9, 24, 1, 'bone', 2);
  p.line(23, 4, 28, 2, 'bone', 2);
  p.line(22, 6, 28, 7, 'bone', 2);
  // long silver hair behind
  p.poly([[9, 10], [23, 10], [25, 24], [7, 24]], 'white');
  // cloak
  p.poly([[4, 31], [8, 21], [24, 21], [28, 31]], 'leaf');
  p.dots([[7, 24], [10, 27], [22, 25], [25, 28], [15, 29]], '#a6e872');
  p.poly([[11, 21], [21, 21], [16, 26]], 'gold');
  p.dots([[16, 22]], '#5fffa0');
  // ears
  p.poly([[11, 12], [4, 9], [11, 16]], 'fae');
  p.poly([[21, 12], [28, 9], [21, 16]], 'fae');
  // face
  p.ellipse(16, 14, 5, 6, 'fae');
  // leaf crown
  p.rect(10, 8, 22, 9, 'green');
  p.dots([[10, 7], [13, 6], [16, 6], [19, 6], [22, 7]], '#56b04c');
  p.dots([[16, 7]], '#ffe88a');
  // eyes + grin
  p.dots([[14, 13], [18, 13]], '#f0b432');
  p.dots([[13, 12], [19, 12]], K);
  p.dots([[13, 16], [14, 17], [15, 17], [16, 17], [17, 17], [18, 17], [19, 16]], '#2c4a2a');
  // fireflies
  p.dots([[2, 15], [29, 13], [27, 25], [3, 26], [26, 18]], '#ffef7a');
});

const minion = paint(S, S, p => {
  // axe
  p.line(27, 4, 27, 31, 'wood');
  p.poly([[28, 4], [31, 2], [31, 12], [28, 10]], 'iron');
  // body
  p.poly([[4, 31], [7, 20], [25, 20], [28, 31]], 'crimson');
  p.rect(8, 23, 24, 24, 'brown');
  p.line(9, 20, 21, 31, 'brown', 2);
  // face
  p.ellipse(16, 14, 7, 6, 'orc');
  p.dots([[12, 12], [13, 13], [20, 12], [19, 13]], K);
  p.dots([[13, 14], [19, 14]], '#ff3b3b');
  p.dots([[13, 18], [13, 17], [19, 18], [19, 17]], '#fff6dc');
  p.dots([[14, 18], [15, 18], [16, 18], [17, 18], [18, 18]], '#3a2a2a');
  p.dots([[21, 15], [22, 16]], '#636c4f');
  // kettle helm
  p.ellipse(16, 7, 6, 4, 'iron');
  p.rect(6, 9, 26, 10, 'iron');
});

// Card back / logo emblem: a sword in the stone.
const emblem = paint(S, S, p => {
  p.ellipse(16, 26, 12, 5, 'stone');
  p.ellipse(16, 23, 8, 3, 'stone');
  p.rect(15, 11, 17, 23, 'metal');
  p.rect(10, 9, 22, 10, 'gold');
  p.rect(15, 4, 17, 8, 'brown');
  p.ellipse(16, 2.5, 1.5, 1.5, 'gold');
  p.dots([[16, 12], [16, 14], [16, 16]], '#ffffff');
  p.dots([[16, 9]], '#ff4a3a');
  p.dots([[6, 6], [26, 4], [24, 12], [8, 14]], '#fff3a8');
});

// Lady of the Lake: rises from the water, holding Excalibur aloft.
const lady = paint(S, S, p => {
  // long pale-blue hair
  p.ellipse(16, 11, 8, 7, 'sky');
  p.poly([[8, 11], [24, 11], [25, 25], [7, 25]], 'sky');
  // white-blue gown rising out of the water
  p.poly([[9, 26], [11, 19], [21, 19], [23, 26]], 'white');
  p.poly([[14, 19], [18, 19], [16, 23]], 'sky');
  // face
  p.ellipse(16, 13, 4.5, 5.5, 'pale');
  p.poly([[10, 7], [22, 7], [22, 10], [18, 8], [16, 10], [14, 8], [10, 10]], 'sky');
  // pearl circlet
  p.dots([[11, 8], [13, 7], [16, 6], [19, 7], [21, 8]], '#ffffff');
  // eyes + lips
  p.dots([[14, 13], [18, 13]], '#2bb3b1');
  p.dots([[13, 12], [19, 12]], K);
  p.dots([[16, 16]], '#d4607a');
  // raised arm with Excalibur (blade up, right side)
  p.line(22, 20, 25, 13, 'pale', 2);
  p.rect(25, 1, 26, 10, 'metal');
  p.rect(23, 11, 28, 11, 'gold');
  p.rect(25, 12, 26, 13, 'brown');
  p.dots([[25, 2], [25, 4], [25, 6]], '#ffffff');
  // lake + ripples
  p.rect(0, 26, 31, 31, 'sky');
  p.line(3, 28, 9, 28, 'white');
  p.line(20, 29, 28, 29, 'white');
  p.line(11, 30, 16, 30, 'white');
  p.dots([[4, 3], [28, 18], [6, 16], [29, 6]], '#c8fff8');
});

export const PORTRAITS = { merlin, percival, servant, assassin, morgana, mordred, oberon, minion, emblem, lady, ...WOLF_PORTRAITS };

// 16x16 player tokens: seat-coloured hood/hair + tunic, 3 hair styles.
const SEAT_COLORS = [
  ['#7fb0ff', '#3c66d8', '#24398f'],
  ['#ff7a68', '#d63c34', '#8c1d26'],
  ['#a6e872', '#56b04c', '#2c6d36'],
  ['#ffe88a', '#f0b432', '#a8701a'],
  ['#c595ff', '#8b52d6', '#55298f'],
  ['#ffb36b', '#f07a2a', '#9c4a16'],
  ['#8ff0e8', '#2bb3b1', '#18706f'],
  ['#ffa3d6', '#e05fa6', '#8f2f68'],
  ['#e8e8e8', '#9aa3b2', '#5b6273'],
  ['#d39a5e', '#9a6233', '#5f3a1f'],
];
export const seatColor = i => SEAT_COLORS[((i % 10) + 10) % 10][1];
export const seatColorHi = i => SEAT_COLORS[((i % 10) + 10) % 10][0];

const tokenCache = new Map();
export function seatToken(i) {
  const key = ((i % 10) + 10) % 10;
  if (tokenCache.has(key)) return tokenCache.get(key);
  const c = SEAT_COLORS[key];
  const style = key % 3;
  const px = paint(16, 16, p => {
    p.poly([[2, 15], [4, 11], [12, 11], [14, 15]], c);
    p.ellipse(8, 7, 4, 4, 'skin');
    if (style === 0) { p.ellipse(8, 4, 5, 3, c); p.rect(3, 4, 4, 8, c); p.rect(12, 4, 13, 8, c); }
    if (style === 1) { p.ellipse(8, 4, 4.5, 2.5, 'brown'); p.dots([[5, 6], [11, 6]], '#74482a'); p.rect(3, 2, 13, 3, c); p.dots([[8, 1]], c[0]); }
    if (style === 2) { p.ellipse(8, 3, 4, 2, 'iron'); p.rect(4, 3, 12, 4, 'iron'); p.dots([[8, 0], [8, 1]], c[1]); }
    p.dots([[6, 7], [10, 7]], K);
    p.dots([[7, 9], [8, 9], [9, 9]], '#c97f5f');
    p.rect(7, 11, 9, 11, 'gold');
  });
  tokenCache.set(key, px);
  return px;
}

// The round table, seen at a slight angle.
export const TABLE = paint(72, 44, p => {
  p.ellipse(36, 26, 33, 15, 'brown');          // side/thickness
  p.ellipse(36, 22, 33, 15, 'wood');           // rim
  p.ellipse(36, 22, 28, 12, ['#b07a45', '#9a6233', '#7c4c27']); // top
  p.ellipse(36, 22, 20, 8, ['#a86f3c', '#93602f', '#7c4c27']);
  // planks
  for (const x of [14, 22, 50, 58]) p.line(x, 14, x, 31, '#87532c');
}, { shade: true });

// Night castle skyline for the page footer (flat silhouette + lit windows).
export const SKYLINE = paint(160, 36, p => {
  const C = '#1b1532';
  p.rect(0, 30, 159, 35, C);
  const towers = [[6, 18, 10], [22, 22, 8], [40, 10, 12], [60, 20, 9], [78, 4, 14], [100, 16, 10], [118, 24, 8], [134, 12, 11], [152, 22, 8]];
  for (const [x, top, w] of towers) {
    p.rect(x, top, x + w, 35, C);
    for (let i = x; i <= x + w; i += 2) p.px(i, top - 1, C);
    p.poly([[x - 1, top - 1], [x + w / 2, top - 7], [x + w + 1, top - 1]], C);
  }
  p.rect(10, 26, 150, 35, C);
  for (let i = 10; i <= 150; i += 3) p.px(i, 25, C);
  const lit = [[44, 16], [47, 16], [83, 10], [86, 10], [83, 16], [104, 22], [138, 18], [26, 27], [64, 25], [122, 28], [90, 28]];
  for (const [x, y] of lit) { p.dot(x, y, '#f5c542'); p.dot(x, y + 1, '#c98a2a'); }
}, { outline: null, shade: false });

/** Games add their own portraits from their folder (call at module load). */
export function registerPortraits(more) { Object.assign(PORTRAITS, more); }

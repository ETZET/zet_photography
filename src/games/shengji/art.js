// Pixel art for 升级: a fan of three playing cards (大王, ♠K, ♥A) on a 32×32 grid,
// and a phone for the "turn your phone sideways" prompt.
import { registerPortraits } from '../pixel/portraits';

const O = '#170f22';
const FACE = '#fbf6ea';
const EDGE = '#d9cdb0';
const RED = '#d63c34';
const BLK = '#241c30';
const GOLD = '#f0b432';

function grid(w, h) { return Array.from({ length: h }, () => Array(w).fill(null)); }
function card(g, x0, y0, w, h, fill = FACE) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
    g[y][x] = edge ? O : (x === x0 + w - 2 || y === y0 + h - 2 ? EDGE : fill);
  }
}
function stamp(g, x0, y0, rows, color) {
  rows.forEach((r, y) => Array.from(r).forEach((c, x) => { if (c === '#') g[y0 + y][x0 + x] = color; }));
}

const fan = (() => {
  const g = grid(32, 32);
  card(g, 1, 7, 13, 19, '#fff0bf');
  stamp(g, 3, 9, ['#.#', '.#.', '#.#'], RED); // joker mark
  stamp(g, 3, 13, ['###', '.#.', '###', '.#.', '###'], RED); // 王
  card(g, 9, 3, 13, 19);
  stamp(g, 11, 5, ['#..#', '#.#.', '##..', '#.#.', '#..#'], BLK); // K
  stamp(g, 11, 11, ['..#..', '.###.', '#####', '..#..', '.###.'], BLK); // ♠
  card(g, 17, 9, 13, 19);
  stamp(g, 19, 11, ['.#.', '#.#', '###', '#.#'], RED); // A
  stamp(g, 20, 17, ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], RED); // ♥
  stamp(g, 27, 25, ['#'], GOLD);
  return g;
})();

/** Portrait phone (18×30) with a little card table on the screen. */
export const PHONE = (() => {
  const g = grid(18, 30);
  for (let y = 0; y < 30; y++) for (let x = 0; x < 18; x++) {
    const edge = x === 0 || y === 0 || x === 17 || y === 29;
    g[y][x] = edge ? O : '#5a52a0';
  }
  for (let y = 3; y < 26; y++) for (let x = 2; x < 16; x++) g[y][x] = '#2c5a3a';
  [[4, 9], [7, 9], [10, 9]].forEach(([x, y]) => { for (let j = 0; j < 6; j++) for (let i = 0; i < 3; i++) g[y + j][x + i] = FACE; });
  [[4, 18], [10, 18]].forEach(([x, y]) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) g[y + j][x + i] = j === 0 ? RED : FACE; });
  g[27][8] = GOLD; g[27][9] = GOLD; g[1][7] = '#2b2150'; g[1][8] = '#2b2150'; g[1][9] = '#2b2150'; g[1][10] = '#2b2150';
  return g;
})();

registerPortraits({ shengji: fan });

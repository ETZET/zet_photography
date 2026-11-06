// 48x48 portraits for 一夜狼's own roles, same painter + palette as the
// 双身份狼人 set (狼人 / 预言家 / 村民 / 猎人 are reused from there).
//   爪牙   – red-hooded acolyte, glowing red eyes, wolf-tooth pendant, dagger
//   双子   – two matching kids in blue caps, holding hands, one star each
//   夜贼   – black bandit mask, teal bandana, a stolen card held up
//   搅局者 – grinning green-capped prankster juggling two cards with swap arrows
//   醉汉   – red nose, stubble, crooked hat, a foaming wooden mug
//   夜猫子 – a big round owl with huge eyes perched on a branch under the moon
//   厌世者 – grey, slumped, rain cloud overhead, hands in pockets
//   emblem – three face-down cards under a crescent moon
import { paint } from '../pixel/paint';
import { registerPortraits } from '../pixel/portraits';

const K = '#170f22';
const S = 48;

/** A tiny playing card with a pixel back pattern. */
function card(p, x, y, w = 8, h = 11, back = 'violet') {
  p.rect(x, y, x + w, y + h, back);
  p.rect(x + 1, y + 1, x + w - 1, y + h - 1, 'plum');
  for (let yy = y + 2; yy < y + h - 1; yy += 2) for (let xx = x + 2 + (((yy - y) / 2) % 2);xx < x + w - 1; xx += 2) p.dot(xx, yy, '#c595ff');
}

const minion = paint(S, S, p => {
  // robe + hood
  p.poly([[4, 47], [9, 32], [17, 28], [31, 28], [39, 32], [44, 47]], 'crimson');
  p.poly([[11, 30], [12, 12], [18, 5], [24, 3], [30, 5], [36, 12], [37, 30]], 'crimson');
  p.poly([[16, 28], [16, 15], [20, 10], [24, 9], [28, 10], [32, 15], [32, 28]], 'black');
  // face in shadow
  p.ellipse(24, 21, 6, 7, 'orc');
  p.rect(17, 14, 31, 15, 'black');
  p.dots([[20, 19], [21, 19], [22, 19], [26, 19], [27, 19], [28, 19]], '#ff3b3b');
  p.dots([[21, 20], [27, 20]], '#ffb0a0');
  p.dots([[22, 24], [23, 25], [24, 25], [25, 25], [26, 24]], '#3a2a1a');
  p.dots([[23, 26], [25, 26]], '#ffffff');
  // pendant: wolf tooth on a cord
  p.line(18, 29, 24, 35, 'bone');
  p.line(30, 29, 24, 35, 'bone');
  p.poly([[22, 35], [26, 35], [24, 40]], 'bone');
  // dagger in hand
  p.line(37, 26, 37, 36, 'metal', 2);
  p.rect(34, 37, 41, 38, 'gold');
  p.rect(37, 39, 38, 43, 'brown');
  p.ellipse(37.5, 41, 2.5, 2.5, 'orc');
  // claw rune on robe
  p.dots([[12, 38], [13, 39], [14, 40], [14, 37], [15, 38], [16, 39]], '#ff7a68');
});

const twin = paint(S, S, p => {
  const kid = (cx, cap) => {
    p.poly([[cx - 10, 47], [cx - 8, 34], [cx - 4, 31], [cx + 4, 31], [cx + 8, 34], [cx + 10, 47]], cap);
    p.rect(cx - 3, 31, cx + 3, 47, 'white');
    p.ellipse(cx, 23, 7, 7.5, 'skin');
    p.ellipse(cx, 16, 7.5, 4, cap);
    p.rect(cx - 8, 17, cx + 8, 18, cap);
    p.dots([[cx - 3, 22], [cx + 3, 22], [cx - 3, 23], [cx + 3, 23]], K);
    p.dots([[cx - 3, 22], [cx + 3, 22]], '#ffffff');
    p.dots([[cx - 5, 25], [cx + 5, 25]], '#ff9a8a');
    p.dots([[cx - 2, 27], [cx - 1, 28], [cx, 28], [cx + 1, 28], [cx + 2, 27]], '#9a4a3a');
    p.dots([[cx, 12]], '#ffe88a');
  };
  kid(13, 'blue');
  kid(35, 'sky');
  // joined hands
  p.ellipse(24, 39, 3, 2.5, 'skin');
  // stars above
  p.dots([[13, 4], [12, 5], [13, 5], [14, 5], [13, 6], [35, 4], [34, 5], [35, 5], [36, 5], [35, 6]], '#ffe88a');
  p.dots([[24, 8], [24, 10], [23, 9], [25, 9]], '#fff6dc');
});

const thief = paint(S, S, p => {
  // dark coat with teal scarf
  p.poly([[4, 47], [10, 33], [17, 30], [31, 30], [38, 33], [44, 47]], 'black');
  p.poly([[15, 29], [33, 29], [30, 35], [18, 35]], ['#8ff0e8', '#2bb3b1', '#18706f']);
  p.line(30, 33, 34, 42, ['#8ff0e8', '#2bb3b1', '#18706f'], 2);
  // head + flat cap
  p.ellipse(24, 21, 8, 8.5, 'skin');
  p.ellipse(24, 13, 10, 4, 'iron');
  p.rect(13, 14, 36, 15, 'iron');
  p.rect(30, 15, 38, 16, 'iron');
  // bandit mask with eye holes
  p.rect(14, 18, 34, 22, 'black');
  p.line(14, 19, 10, 17, 'black');
  p.line(14, 21, 10, 23, 'black');
  p.dots([[19, 20], [20, 20], [28, 20], [29, 20]], '#ffffff');
  p.dots([[20, 20], [28, 20]], K);
  // smirk + stubble
  p.dots([[21, 26], [22, 27], [23, 27], [24, 27], [25, 26], [26, 25]], '#9a4a3a');
  p.dots([[19, 28], [22, 29], [26, 29], [29, 28]], '#c97f5f');
  // stolen card held up, with a gold glint
  p.ellipse(10, 36, 2.5, 2.5, 'skin');
  card(p, 5, 22, 9, 12);
  p.dots([[4, 21], [15, 21], [3, 26]], '#ffe88a');
  p.dots([[16, 20]], '#fff6dc');
});

const meddler = paint(S, S, p => {
  // patchwork jacket
  p.poly([[5, 47], [10, 34], [17, 31], [31, 31], [38, 34], [43, 47]], 'green');
  p.rect(18, 31, 24, 47, 'gold');
  p.rect(24, 31, 30, 47, 'red');
  p.dots([[21, 36], [21, 41], [27, 36], [27, 41]], '#2a1a05');
  // head with big grin
  p.ellipse(24, 22, 8, 8, 'skin');
  p.dots([[19, 19], [20, 18], [21, 19], [27, 19], [28, 18], [29, 19]], '#74482a');
  p.dots([[20, 21], [21, 21], [27, 21], [28, 21]], K);
  p.dots([[20, 21], [27, 21]], '#ffffff');
  p.dots([[18, 25], [19, 26], [20, 27], [21, 27], [22, 28], [23, 28], [24, 28], [25, 28], [26, 28], [27, 27], [28, 27], [29, 26], [30, 25]], '#8c1d26');
  p.dots([[21, 26], [22, 26], [23, 26], [24, 26], [25, 26], [26, 26], [27, 26]], '#ffffff');
  // floppy two-tone cap with bells
  p.poly([[15, 16], [8, 6], [18, 9], [24, 3], [30, 9], [40, 6], [33, 16]], 'green');
  p.poly([[24, 3], [30, 9], [40, 6], [33, 16], [24, 16]], 'red');
  p.ellipse(8, 6, 1.5, 1.5, 'gold');
  p.ellipse(40, 6, 1.5, 1.5, 'gold');
  p.rect(15, 14, 33, 16, 'gold');
  // two cards being swapped, with arrows
  card(p, 1, 28, 7, 10);
  card(p, 40, 28, 7, 10, 'blue');
  p.dots([[6, 24], [7, 23], [8, 22], [9, 22], [10, 23], [9, 21], [10, 21]], '#ffe88a');
  p.dots([[42, 42], [41, 43], [40, 44], [39, 44], [38, 43], [39, 45], [38, 45]], '#ffe88a');
  p.ellipse(9, 41, 2.5, 2.5, 'skin');
  p.ellipse(39, 40, 2.5, 2.5, 'skin');
});

const drunk = paint(S, S, p => {
  // shabby coat
  p.poly([[4, 47], [10, 34], [17, 31], [31, 31], [38, 34], [44, 47]], 'brown');
  p.rect(19, 31, 29, 47, 'bone');
  p.dots([[22, 36], [26, 41], [21, 44]], '#a99872');
  // head tilted: crooked hat
  p.ellipse(24, 22, 8, 8.5, 'skin');
  p.poly([[12, 14], [36, 10], [37, 13], [13, 17]], 'iron');
  p.poly([[16, 14], [17, 5], [31, 3], [33, 11]], 'iron');
  p.line(17, 12, 33, 9, 'red', 2);
  // sleepy eyes, rosy cheeks, red nose
  p.dots([[19, 21], [20, 21], [21, 21], [27, 21], [28, 21], [29, 21]], K);
  p.dots([[19, 20], [20, 20], [21, 20], [27, 20], [28, 20], [29, 20]], '#c97f5f');
  p.ellipse(24, 24, 2, 1.5, 'red');
  p.dots([[23, 23]], '#ffd2c8');
  p.dots([[17, 25], [18, 25], [30, 25], [31, 25]], '#ff7a68');
  p.dots([[21, 28], [22, 28], [23, 29], [24, 29], [25, 28]], '#8c1d26');
  p.dots([[18, 29], [20, 30], [24, 31], [28, 30], [30, 29]], '#9a6233');
  // foaming mug
  p.rect(33, 32, 43, 44, 'wood');
  p.line(34, 34, 34, 43, 'brown');
  p.line(38, 34, 38, 43, 'brown');
  p.rect(44, 35, 46, 41, 'wood');
  p.ellipse(38, 31, 6, 2.5, 'white');
  p.dots([[35, 29], [39, 28], [42, 30]], '#ffffff');
  p.ellipse(32, 39, 2.5, 2.5, 'skin');
  // dizzy bubbles
  p.dots([[6, 10], [8, 7], [5, 5], [42, 18], [44, 15]], '#bff4ff');
});

const owl = paint(S, S, p => {
  // moon
  p.ellipse(39, 8, 6, 6, 'bone');
  p.ellipse(42, 6, 5, 5, 'plum');
  // branch
  p.line(0, 42, 47, 40, 'wood', 3);
  p.dots([[6, 39], [7, 38], [40, 37], [41, 36]], '#3f9446');
  // body
  p.ellipse(24, 28, 13, 14, 'brown');
  p.ellipse(24, 32, 8, 9, 'bone');
  p.dots([[21, 29], [24, 31], [27, 29], [22, 34], [26, 34], [24, 37]], '#a99872');
  // ear tufts
  p.poly([[11, 12], [16, 18], [12, 19]], 'brown');
  p.poly([[37, 12], [32, 18], [36, 19]], 'brown');
  // wings
  p.poly([[11, 22], [7, 32], [10, 40], [14, 36]], 'wood');
  p.poly([[37, 22], [41, 32], [38, 40], [34, 36]], 'wood');
  // huge eyes
  p.ellipse(18.5, 21, 5, 5, 'white');
  p.ellipse(29.5, 21, 5, 5, 'white');
  p.ellipse(18.5, 21, 3, 3, 'gold');
  p.ellipse(29.5, 21, 3, 3, 'gold');
  p.dots([[18, 20], [19, 20], [18, 21], [19, 21], [29, 20], [30, 20], [29, 21], [30, 21]], K);
  p.dots([[17, 19], [28, 19]], '#ffffff');
  // beak + talons
  p.poly([[22, 25], [26, 25], [24, 29]], 'gold');
  p.dots([[19, 42], [21, 42], [27, 42], [29, 42]], '#f0b432');
  // stars
  p.dots([[4, 6], [9, 3], [3, 16], [44, 22]], '#fff6dc');
});

const loner = paint(S, S, p => {
  // rain cloud + drops
  p.ellipse(24, 6, 12, 4, 'stone');
  p.ellipse(17, 5, 5, 4, 'stone');
  p.ellipse(31, 5, 5, 4, 'stone');
  p.dots([[14, 12], [20, 13], [27, 12], [33, 13], [17, 16], [30, 16]], '#8cc2f2');
  // slumped grey coat, hands in pockets
  p.poly([[6, 47], [11, 35], [18, 32], [30, 32], [37, 35], [42, 47]], 'iron');
  p.rect(20, 32, 28, 47, 'stone');
  p.rect(12, 41, 17, 44, 'black');
  p.rect(31, 41, 36, 44, 'black');
  // head, droopy
  p.ellipse(24, 25, 7.5, 7.5, 'pale');
  p.poly([[16, 22], [18, 16], [24, 14], [30, 16], [32, 22], [28, 19], [20, 19]], 'black');
  p.dots([[19, 25], [20, 25], [21, 25], [27, 25], [28, 25], [29, 25]], K);
  p.dots([[19, 24], [20, 24], [21, 24], [27, 24], [28, 24], [29, 24]], '#bf9ea6');
  p.dots([[20, 27], [28, 27]], '#8cc2f2');
  p.dots([[21, 30], [22, 29], [23, 29], [24, 29], [25, 29], [26, 29], [27, 30]], '#6f5a6a');
  // scarf
  p.rect(18, 32, 30, 34, 'navy');
  p.line(28, 34, 30, 40, 'navy', 2);
});

/** Title emblem: crescent moon over three face-down cards. */
const emblem = paint(S, S, p => {
  p.ellipse(24, 13, 11, 11, 'bone');
  p.ellipse(29, 10, 9, 9, null);
  p.dots([[18, 9], [17, 14], [20, 19]], '#a99872');
  card(p, 4, 26, 11, 16);
  card(p, 18, 24, 11, 16, 'blue');
  card(p, 32, 26, 11, 16);
  p.dots([[4, 4], [42, 6], [44, 18], [3, 16], [38, 2]], '#fff6dc');
  p.dots([[23, 45], [24, 45], [25, 45]], '#f5c542');
});

export const ONENIGHT_PORTRAITS = {
  on_minion: minion, on_twin: twin, on_thief: thief, on_meddler: meddler, on_drunk: drunk, on_owl: owl, on_loner: loner, on_emblem: emblem,
};
registerPortraits(ONENIGHT_PORTRAITS);

// 48x48 portraits for 双身份狼人 (2.25× the pixels of the 32px Avalon set,
// so faces and props stay readable on phones). Same painter + palette.
//   Wolf     – grey werewolf head, red inner ears, amber slit eyes, fangs, fur ruff
//   Villager – straw hat, rosy cheeks, red neckerchief, green vest, pitchfork, wheat
//   Seer     – violet hood, third-eye sigil, glowing eyes, crystal ball on a stand
//   Witch    – wide buckled hat, red hair, green flask + red potion
//   Hunter   – feathered green cap, beard, leather strap, long rifle
//   Guard    – plumed iron helm with nose guard, spear, shield with crescent moon
//   Cupid    – golden curls, white wings, pink sash, drawn bow with a heart-tipped arrow
import { paint } from './paint';

const K = '#170f22';
const S = 48;

const wolf = paint(S, S, p => {
  // cloak + fur ruff
  p.poly([[2, 47], [8, 37], [17, 33], [31, 33], [40, 37], [46, 47]], 'plum');
  p.poly([[13, 32], [35, 32], [31, 40], [24, 44], [17, 40]], 'stone');
  p.ellipse(24, 42, 1.5, 1.5, 'gold');
  // ears
  p.poly([[9, 1], [20, 12], [10, 20]], 'stone');
  p.poly([[39, 1], [28, 12], [38, 20]], 'stone');
  p.poly([[11, 5], [17, 12], [12, 16]], 'crimson');
  p.poly([[37, 5], [31, 12], [36, 16]], 'crimson');
  // head + cheek fur
  p.ellipse(24, 20, 13, 11, 'stone');
  p.poly([[19, 9], [24, 4], [29, 9]], 'stone');
  p.poly([[12, 18], [5, 26], [12, 25], [8, 32], [17, 28]], 'stone');
  p.poly([[36, 18], [43, 26], [36, 25], [40, 32], [31, 28]], 'stone');
  p.dots([[22, 10], [24, 8], [26, 10], [24, 12]], '#4c475c');
  // muzzle + nose
  p.ellipse(24, 27, 7, 5.5, 'metal');
  p.rect(21, 22, 27, 24, 'black');
  p.dots([[22, 22], [23, 22]], '#8d95a6');
  p.line(24, 25, 24, 28, 'black');
  p.rect(17, 30, 31, 30, 'black');
  p.dots([[16, 29], [32, 29]], K);
  p.dots([[19, 31], [19, 32], [29, 31], [29, 32]], '#ffffff');
  p.dots([[22, 31], [26, 31]], '#e7e3da');
  // slanted brows + amber eyes
  p.line(12, 15, 20, 18, 'black');
  p.line(36, 15, 28, 18, 'black');
  for (const [x0] of [[14], [29]]) {
    p.dots([[x0, 18], [x0 + 1, 18], [x0 + 2, 18], [x0 + 3, 18], [x0 + 4, 18], [x0 + 5, 18]], '#ffd23f');
    p.dots([[x0, 19], [x0 + 1, 19], [x0 + 2, 19], [x0 + 3, 19], [x0 + 4, 19], [x0 + 5, 19]], '#ff9a2a');
    p.dots([[x0 + 1, 20], [x0 + 2, 20], [x0 + 3, 20], [x0 + 4, 20]], '#d9661f');
    p.dots([[x0 + 2, 18], [x0 + 2, 19], [x0 + 2, 20], [x0 + 3, 18], [x0 + 3, 19], [x0 + 3, 20]], K);
    p.dots([[x0, 18]], '#fff6a0');
  }
  // claw marks on the cloak
  p.dots([[7, 40], [8, 41], [9, 42], [10, 43], [9, 39], [10, 40], [11, 41], [12, 42]], '#9b2c4a');
  p.dots([[41, 40], [40, 41], [39, 42], [38, 43], [39, 39], [38, 40], [37, 41], [36, 42]], '#9b2c4a');
});

const villager = paint(S, S, p => {
  // pitchfork
  p.line(41, 9, 41, 47, 'wood', 2);
  p.rect(36, 7, 46, 8, 'iron');
  p.line(36, 0, 36, 7, 'iron');
  p.line(41, 0, 41, 7, 'iron');
  p.line(46, 0, 46, 7, 'iron');
  // body: jacket, shirt, vest, neckerchief
  p.poly([[4, 47], [10, 34], [17, 31], [31, 31], [38, 34], [42, 47]], 'brown');
  p.rect(18, 31, 30, 47, 'bone');
  p.rect(18, 37, 30, 47, 'green');
  p.poly([[18, 31], [30, 31], [24, 36]], 'red');
  p.dots([[24, 40], [24, 44]], '#4a2c1a');
  p.ellipse(41, 34, 2.5, 2.5, 'skin');
  // head
  p.ellipse(24, 22, 8, 8, 'skin');
  p.ellipse(15.5, 23, 1.5, 2, 'skin');
  p.ellipse(32.5, 23, 1.5, 2, 'skin');
  p.rect(16, 15, 32, 16, 'brown');
  p.rect(15, 16, 16, 21, 'brown');
  p.rect(32, 16, 33, 21, 'brown');
  // straw hat
  p.ellipse(24, 14, 18, 2.5, 'gold');
  p.ellipse(24, 8, 9, 5.5, 'gold');
  p.rect(15, 10, 33, 12, 'red');
  p.dots([[9, 15], [13, 16], [35, 16], [39, 15], [19, 6], [27, 5], [23, 4], [30, 8], [17, 8]], '#a8701a');
  // face
  p.dots([[19, 19], [20, 19], [21, 19], [27, 19], [28, 19], [29, 19]], '#74482a');
  p.dots([[20, 21], [21, 21], [20, 22], [21, 22], [27, 21], [28, 21], [27, 22], [28, 22]], K);
  p.dots([[20, 21], [27, 21]], '#ffffff');
  p.dots([[24, 23], [24, 24], [25, 24]], '#c97f5f');
  p.dots([[17, 24], [18, 24], [17, 25], [18, 25], [30, 24], [31, 24], [30, 25], [31, 25]], '#ff9a8a');
  p.dots([[21, 26], [22, 27], [23, 27], [24, 27], [25, 27], [26, 27], [27, 26]], '#9a4a3a');
  // wheat bundle
  p.line(5, 30, 7, 46, 'leaf');
  p.line(8, 31, 8, 46, 'leaf');
  p.dots([[4, 27], [5, 28], [4, 29], [6, 26], [7, 27], [6, 28], [8, 27], [9, 28], [8, 29], [9, 30]], '#f0b432');
});

const seer = paint(S, S, p => {
  // robe + hood
  p.poly([[4, 47], [9, 31], [16, 26], [32, 26], [39, 31], [44, 47]], 'violet');
  p.poly([[11, 28], [12, 10], [18, 4], [24, 2], [30, 4], [36, 10], [37, 28]], 'violet');
  p.poly([[16, 26], [16, 13], [20, 8], [24, 7], [28, 8], [32, 13], [32, 26]], 'plum');
  // face
  p.ellipse(24, 19, 6, 7, 'pale');
  p.rect(17, 12, 31, 13, 'plum');
  p.dots([[19, 17], [20, 17], [21, 17], [22, 17], [26, 17], [27, 17], [28, 17], [29, 17]], K);
  p.dots([[20, 18], [21, 18], [27, 18], [28, 18]], '#5fcff5');
  p.dots([[20, 18], [27, 18]], '#ffffff');
  p.dots([[24, 20], [24, 21], [23, 21]], '#bf9ea6');
  p.dots([[23, 23], [24, 23], [25, 23]], '#a35a7a');
  // third-eye sigil
  p.dots([[24, 8], [23, 9], [25, 9], [24, 10], [22, 9], [26, 9]], '#ffe88a');
  p.dots([[24, 9]], '#5fcff5');
  // gold trim
  p.line(24, 27, 24, 47, 'gold');
  p.line(9, 47, 39, 47, 'gold');
  p.line(16, 26, 11, 28, 'gold');
  p.line(32, 26, 37, 28, 'gold');
  // crystal ball on a stand
  p.rect(19, 42, 29, 44, 'gold');
  p.rect(21, 41, 27, 41, 'gold');
  p.ellipse(24, 36, 6, 5.5, 'glow');
  p.dots([[21, 33], [22, 32], [20, 34], [21, 34]], '#ffffff');
  p.dots([[26, 37], [27, 36], [25, 38], [24, 37]], '#e08cff');
  p.ellipse(16, 39, 2.5, 2.5, 'pale');
  p.ellipse(32, 39, 2.5, 2.5, 'pale');
  // stars
  p.dots([[4, 5], [43, 8], [3, 20], [44, 22], [7, 13], [41, 15]], '#ffe88a');
  p.dots([[4, 4], [3, 5], [5, 5], [4, 6], [43, 7], [42, 8], [44, 8], [43, 9]], '#fff6dc');
});

const witch = paint(S, S, p => {
  // hair behind
  p.poly([[12, 15], [36, 15], [39, 36], [32, 32], [16, 32], [9, 36]], 'red');
  // dress + collar
  p.poly([[5, 47], [11, 34], [18, 30], [30, 30], [37, 34], [43, 47]], 'black');
  p.poly([[18, 30], [30, 30], [24, 38]], 'violet');
  p.ellipse(24, 33, 1, 1, 'green');
  // face
  p.ellipse(24, 22, 7, 8, 'pale');
  p.rect(17, 15, 31, 16, 'red');
  p.dots([[19, 17], [23, 17], [28, 17]], '#d63c34');
  p.dots([[19, 20], [20, 20], [21, 20], [22, 20], [26, 20], [27, 20], [28, 20], [29, 20]], K);
  p.dots([[20, 21], [21, 21], [27, 21], [28, 21]], '#56b04c');
  p.dots([[20, 21], [27, 21]], '#e4fbcf');
  p.dots([[24, 23], [25, 24]], '#bf9ea6');
  p.dots([[22, 26], [23, 26], [24, 26], [25, 26], [26, 26]], '#d63c34');
  p.dots([[23, 27], [24, 27], [25, 27]], '#8c1d26');
  p.dots([[29, 25]], K);
  // hat: wide brim, crooked cone, buckled band
  p.rect(4, 12, 44, 14, 'black');
  p.poly([[13, 12], [17, 4], [24, 0], [32, 1], [30, 4], [35, 12]], 'black');
  p.rect(15, 9, 33, 11, 'violet');
  p.rect(22, 9, 26, 11, 'gold');
  p.dots([[23, 10], [24, 10], [25, 10]], '#55298f');
  // green flask (left)
  p.ellipse(8, 41, 4.5, 4.5, 'green');
  p.rect(7, 34, 9, 36, 'bone');
  p.rect(7, 33, 9, 33, 'wood');
  p.dots([[6, 39], [6, 40], [9, 42], [8, 44]], '#e4fbcf');
  p.ellipse(13, 42, 2, 2, 'pale');
  // red potion (right)
  p.rect(35, 37, 41, 45, 'red');
  p.rect(37, 34, 39, 36, 'bone');
  p.rect(37, 33, 39, 33, 'wood');
  p.dots([[36, 38], [36, 39], [36, 40]], '#ffd2c8');
  p.ellipse(34, 42, 2, 2, 'pale');
  // sparkles
  p.dots([[6, 30], [10, 27], [40, 28], [43, 31], [3, 24]], '#c595ff');
});

const hunter = paint(S, S, p => {
  // rifle across the body
  p.line(4, 45, 37, 16, 'wood', 3);
  p.line(34, 18, 46, 8, 'iron', 2);
  p.dots([[37, 15], [38, 15]], '#f0b432');
  // leather jerkin, shirt, strap
  p.poly([[5, 47], [10, 33], [17, 30], [31, 30], [38, 33], [43, 47]], 'wood');
  p.rect(19, 30, 29, 47, 'leaf');
  p.line(9, 31, 36, 47, 'brown', 3);
  p.rect(21, 38, 24, 41, 'gold');
  p.dots([[22, 39], [23, 40]], '#a8701a');
  // head, beard
  p.ellipse(24, 21, 7.5, 8, 'skin');
  p.poly([[16, 23], [32, 23], [30, 29], [24, 32], [18, 29]], 'brown');
  p.rect(20, 24, 28, 25, 'brown');
  p.dots([[22, 26], [23, 26], [24, 26], [25, 26], [26, 26]], '#c97f5f');
  p.rect(19, 17, 22, 17, 'brown');
  p.rect(26, 17, 29, 17, 'brown');
  p.dots([[20, 19], [21, 19], [20, 20], [21, 20], [27, 19], [28, 19], [27, 20], [28, 20]], K);
  p.dots([[20, 19], [27, 19]], '#ffffff');
  p.dots([[24, 21], [24, 22], [25, 22]], '#c97f5f');
  // feathered cap
  p.poly([[14, 15], [6, 10], [17, 4], [29, 3], [34, 8], [35, 15]], 'leaf');
  p.rect(14, 13, 35, 15, 'green');
  p.line(30, 9, 40, 0, 'red', 2);
  p.dots([[37, 2], [35, 4], [33, 6]], '#ffd2c8');
  // hand + pouch
  p.ellipse(13, 40, 2.5, 2.5, 'skin');
  p.rect(33, 38, 38, 43, 'brown');
  p.rect(33, 38, 38, 39, 'wood');
  p.dots([[35, 40]], '#f0b432');
});

const guard = paint(S, S, p => {
  // spear
  p.line(6, 6, 6, 47, 'wood', 2);
  p.poly([[7, 0], [3, 6], [10, 6]], 'metal');
  p.rect(4, 7, 9, 8, 'red');
  // armour + pauldrons
  p.poly([[7, 47], [12, 33], [18, 30], [30, 30], [36, 33], [41, 47]], 'navy');
  p.ellipse(13, 33, 4, 3, 'iron');
  p.ellipse(35, 33, 4, 3, 'iron');
  // helm with plume, cheek guards, nose guard
  p.poly([[19, 4], [24, 0], [31, 2], [29, 7], [21, 7]], 'red');
  p.ellipse(24, 14, 10, 8, 'iron');
  p.ellipse(24, 22, 7, 6, 'skin');
  p.rect(14, 14, 34, 16, 'metal');
  p.rect(14, 16, 16, 26, 'iron');
  p.rect(32, 16, 34, 26, 'iron');
  p.rect(23, 15, 25, 21, 'iron');
  p.dots([[16, 15], [20, 15], [28, 15], [32, 15]], '#ffffff');
  p.dots([[19, 19], [20, 19], [19, 20], [20, 20], [28, 19], [29, 19], [28, 20], [29, 20]], K);
  p.dots([[19, 19], [28, 19]], '#ffffff');
  p.dots([[21, 24], [22, 25], [23, 25], [24, 25], [25, 25], [26, 25], [27, 24]], '#c97f5f');
  p.ellipse(8, 34, 2.5, 2.5, 'skin');
  // shield with crescent moon
  p.poly([[16, 31], [42, 31], [42, 40], [29, 47], [16, 40]], 'blue');
  p.rect(16, 31, 42, 32, 'gold');
  p.ellipse(29, 38.5, 4.5, 4.5, 'gold');
  p.ellipse(31, 37.5, 3.5, 3.5, 'blue');
  p.dots([[35, 35], [36, 41], [22, 36]], '#ffe88a');
  p.dots([[17, 34], [17, 35], [17, 36]], '#7fb0ff');
});

const cupid = paint(S, S, p => {
  // wings behind
  p.poly([[3, 14], [12, 18], [16, 28], [10, 34], [2, 28], [0, 20]], 'white');
  p.poly([[45, 14], [36, 18], [32, 28], [38, 34], [46, 28], [47, 20]], 'white');
  p.dots([[4, 20], [6, 24], [8, 28], [43, 20], [41, 24], [39, 28]], '#aaa39a');
  // body + pink sash
  p.poly([[10, 47], [14, 35], [19, 31], [29, 31], [34, 35], [38, 47]], 'skin');
  p.line(16, 32, 33, 47, 'pink', 3);
  // head, rosy cheeks, smile
  p.ellipse(24, 21, 8, 8.5, 'skin');
  p.dots([[20, 20], [21, 20], [20, 21], [21, 21], [27, 20], [28, 20], [27, 21], [28, 21]], K);
  p.dots([[20, 20], [27, 20]], '#ffffff');
  p.dots([[18, 24], [19, 24], [29, 24], [30, 24]], '#f27aa8');
  p.dots([[22, 26], [23, 27], [24, 27], [25, 27], [26, 26]], '#b03c6e');
  // golden curls
  p.ellipse(24, 13, 9, 5, 'gold');
  p.ellipse(16, 16, 3, 4, 'gold');
  p.ellipse(32, 16, 3, 4, 'gold');
  p.dots([[19, 11], [23, 10], [28, 11], [16, 15], [32, 15]], '#ffe88a');
  // bow (left) with string, arrow with a heart tip
  p.line(7, 30, 10, 46, 'wood', 2);
  p.line(7, 30, 4, 38, 'wood', 2);
  p.line(4, 38, 10, 46, 'wood', 2);
  p.line(6, 38, 40, 38, 'bone', 1);
  p.poly([[40, 35], [44, 35], [46, 38], [42, 42], [38, 38]], 'pink');
  p.dots([[40, 36], [41, 36]], '#ffd1e6');
  p.dots([[7, 36], [7, 40], [8, 37], [8, 39]], '#ffd1e6');
  // hands on the bow and the arrow
  p.ellipse(9, 38, 2, 2, 'skin');
  p.ellipse(31, 38, 2, 2, 'skin');
  // floating hearts
  p.dots([[38, 4], [40, 4], [37, 5], [38, 5], [39, 5], [40, 5], [41, 5], [38, 6], [39, 6], [40, 6], [39, 7]], '#f27aa8');
  p.dots([[6, 6], [8, 6], [6, 7], [7, 7], [8, 7], [7, 8]], '#f27aa8');
});

/** Title emblem: a wolf on a rock howling at a full moon. */
const wolfmoon = paint(S, S, p => {
  p.ellipse(29, 16, 14, 14, 'bone');
  p.dots([[22, 10], [23, 10], [24, 11], [33, 20], [34, 20], [34, 21], [28, 24], [36, 9], [37, 10], [30, 6]], '#a99872');
  p.poly([[0, 47], [4, 41], [17, 38], [32, 40], [39, 47]], 'stone');
  p.poly([[8, 41], [9, 32], [12, 26], [15, 22], [18, 24], [20, 30], [22, 36], [24, 41]], 'black');
  p.poly([[12, 26], [13, 17], [16, 12], [21, 8], [26, 3], [27, 5], [23, 10], [24, 13], [20, 18], [18, 24]], 'black');
  p.poly([[15, 14], [13, 6], [18, 11]], 'black');
  p.poly([[8, 39], [2, 35], [3, 32], [9, 36]], 'black');
  p.rect(16, 36, 19, 41, 'black');
  p.dots([[18, 13]], '#ffd23f');
  p.dots([[31, 2], [34, 1], [37, 3], [41, 5]], '#ffffff');
  p.dots([[4, 6], [9, 3], [3, 15], [44, 34], [40, 40]], '#fff6dc');
});

export const WOLF_PORTRAITS = { wolf, villager, seer, witch, hunter, guard, cupid, wolfmoon };

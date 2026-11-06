// 32px pixel art for 掼蛋: a fan of three cards (♠ back, ♥ face, 大王) over an egg.
import { paint } from '../pixel/paint';
import { registerPortraits } from '../pixel/portraits';

const RED = '#d63c34';
const INK = '#2f2a3d';

const guandan = paint(32, 32, p => {
  // egg behind the fan (掼"蛋")
  p.ellipse(16, 22, 10, 9, 'bone');
  // left card, tilted
  p.poly([[3, 9], [12, 5], [18, 22], [9, 26]], 'red');
  p.poly([[5, 10], [11, 7], [16, 21], [10, 24]], 'crimson');
  // right card, tilted the other way
  p.poly([[20, 5], [29, 9], [23, 26], [14, 22]], 'white');
  p.dots([[22, 9], [23, 9], [22, 10]], INK);
  p.dots([[24, 12], [23, 13], [24, 13], [25, 13], [24, 14]], '#4e4860');
  // middle card, upright, front
  p.rect(10, 3, 21, 22, 'white');
  p.dots([[11, 4], [12, 4], [11, 5], [11, 6], [12, 6], [12, 7], [11, 8], [12, 8]], RED); // a little "5"
  // heart
  p.dots([[13, 10], [14, 10], [17, 10], [18, 10], [12, 11], [13, 11], [14, 11], [15, 11], [16, 11], [17, 11], [18, 11], [19, 11],
    [12, 12], [13, 12], [14, 12], [15, 12], [16, 12], [17, 12], [18, 12], [19, 12], [13, 13], [14, 13], [15, 13], [16, 13], [17, 13], [18, 13],
    [14, 14], [15, 14], [16, 14], [17, 14], [15, 15], [16, 15]], RED);
  p.dots([[13, 11], [14, 10]], '#ff9a8a');
  // gold "配" corner tab
  p.rect(18, 18, 20, 20, 'gold');
  // egg shine
  p.dots([[9, 27], [10, 28]], '#ffffff');
});

registerPortraits({ guandan });

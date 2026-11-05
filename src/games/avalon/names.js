// Nickname rules. Width units: CJK / full-width / emoji = 2, everything else = 1.
// 10 units ≈ 5 汉字 or 10 Latin letters — fits a seat name tag.
export const NAME_MAX_UNITS = 10;

const isWide = ch => {
  const c = ch.codePointAt(0);
  return c >= 0x1100 && (
    c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3)
    || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60)
    || (c >= 0xffe0 && c <= 0xffe6) || c >= 0x1f300
  );
};

export const nameUnits = s => Array.from(s || '').reduce((n, ch) => n + (isWide(ch) ? 2 : 1), 0);

/** Strip control chars / collapse spaces, then cut to the unit budget. */
export function clampName(raw, max = NAME_MAX_UNITS) {
  // eslint-disable-next-line no-control-regex
  const clean = (raw || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, '').replace(/\s+/g, ' ');
  let out = '';
  let n = 0;
  for (const ch of Array.from(clean)) {
    const w = isWide(ch) ? 2 : 1;
    if (n + w > max) break;
    out += ch;
    n += w;
  }
  return out;
}

/** Make `name` unique among `players`, keeping it within the unit budget. */
export function uniqueName(name, players) {
  const taken = new Set(players.map(p => p.name));
  if (!taken.has(name)) return name;
  for (let i = 2; ; i++) {
    const suffix = String(i);
    const candidate = clampName(name, NAME_MAX_UNITS - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

/* Will's and Millie's colors (Settings › The twins), same choices as the
   App Store edition: six soft colors, maroon, deep green, navy, or a custom
   one from the picker (any hue, pale to deep, never neon).

   settings.twins[i].color = 'sage' | 'maroon' | ... | '#rrggbb'
   (no color saved = Will sage, Millie blush, like always).

   paintTwinColors() sets --k / --k-bg / --k-ink on .will and .millie, which
   the pills, chips, Right Now cards, words page, letters and growth chart use.
   Seals for the six soft colors are painted images; any other color tints the
   original wax (seal-blush.png) on the phone. */

const TWIN_COLORS = [
  ['sage', 'Sage'], ['blush', 'Blush'], ['sky', 'Sky'],
  ['lavender', 'Lavender'], ['butter', 'Butter'], ['clay', 'Clay'],
  ['maroon', 'Maroon'], ['forest', 'Deep green'], ['navy', 'Navy'],
];
const HAND_PICKED = ['sage', 'blush', 'sky', 'lavender', 'butter', 'clay'];
const NAMED_HEX = { maroon: '#7a2f3b', forest: '#3d5e46', navy: '#344a70' };
const DEFAULT_TWIN_COLOR = { will: 'sage', millie: 'blush' };
const isCustomColor = c => /^#[0-9a-f]{6}$/i.test(c || '');
const colorHex = c => (isCustomColor(c) ? c.toLowerCase() : NAMED_HEX[c] || null);
const twinColor = key => {
  const t = (state.settings && state.settings.twins || []).find(x => x.key === key);
  return (t && t.color) || DEFAULT_TWIN_COLOR[key] || 'sage';
};

// PDF ink and tag background for the six soft colors (r, g, b).
const SOFT_INK = {
  sage: [62, 90, 58], blush: [138, 74, 62], sky: [53, 83, 110],
  lavender: [87, 70, 110], butter: [110, 90, 30], clay: [110, 70, 50],
};
const SOFT_BG = {
  sage: [221, 231, 218], blush: [244, 220, 214], sky: [219, 230, 240],
  lavender: [231, 224, 240], butter: [245, 236, 201], clay: [238, 223, 212],
};
// The six soft colors in light and dark (main, tag background, text).
const SOFT_SHADES = {
  sage: [['#a9bfa4', '#dde7da', '#3e5a3a'], ['#8fa88a', '#2f3a2d', '#c5d8c0']],
  blush: [['#e8b4a8', '#f4dcd6', '#8a4a3e'], ['#d39a8d', '#43302b', '#f0c7bd']],
  sky: [['#9fb8cf', '#dbe6f0', '#35536e'], ['#7f9bb5', '#2b3640', '#c3d6e8']],
  lavender: [['#b8a9cc', '#e7e0f0', '#57466e'], ['#9c8db3', '#352f40', '#d8cdea']],
  butter: [['#e3c977', '#f5ecc9', '#6e5a1e'], ['#c9ae5c', '#3b3523', '#ecdca6']],
  clay: [['#c9a088', '#eedfd4', '#6e4632'], ['#b08670', '#3e3029', '#e8cbb9']],
};

// ---------- worked-out shades ----------
function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => Math.round((v + m) * 255));
}
const rgbHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hsl = (h, s, l) => rgbHex(hslToRgb(h, s, l));
// The custom picker: depth 0 = pale (like sage), 1 = deep (like maroon).
const softColor = (hue, depth) => hsl(hue, 0.3 + 0.16 * depth, 0.8 - 0.5 * depth);

function colorShades(c) {
  if (SOFT_SHADES[c]) {
    const [[k, bg, ink], [dk, dbg, dink]] = SOFT_SHADES[c];
    return { light: { k, bg, ink }, dark: { k: dk, bg: dbg, ink: dink } };
  }
  const [h, s, l] = hexToHsl(colorHex(c) || '#a9bfa4');
  return {
    light: { k: hsl(h, s, l), bg: hsl(h, Math.min(s, 0.42), 0.91), ink: hsl(h, Math.min(s, 0.42), Math.min(l, 0.32)) },
    dark: { k: hsl(h, Math.min(s, 0.4), Math.max(l, 0.58)), bg: hsl(h, Math.min(s, 0.22), 0.2), ink: hsl(h, Math.min(s, 0.4), 0.82) },
  };
}
// For the PDF books (always light paper).
const twinInkRgb = key => { const c = twinColor(key); return SOFT_INK[c] || hexRgb(colorShades(c).light.ink); };
const twinBgRgb = key => { const c = twinColor(key); return SOFT_BG[c] || hexRgb(colorShades(c).light.bg); };

// sel: '.will' (a twin's class) or '.cp-<hex>' (a swatch or preview in the picker).
function colorCss(sel, c) {
  const { light: L, dark: D } = colorShades(c);
  const vars = x => `--k:${x.k};--k-bg:${x.bg};--k-ink:${x.ink};`;
  return `${sel}{${vars(L)}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) ${sel}{${vars(D)}}}
:root[data-theme="dark"] ${sel}{${vars(D)}}
.dear-name${sel}[aria-pressed="true"]{background:${L.bg};color:${L.ink}}`;
}
const cp = c => 'cp-' + (isCustomColor(c) ? c.slice(1).toLowerCase() : c);
function paintTwinColors(extra = []) {
  const css = [
    ...['will', 'millie'].map(key => colorCss('.' + key, twinColor(key))),
    ...[...new Set([...TWIN_COLORS.map(([c]) => c), ...extra])].map(c => colorCss('.' + cp(c), c)),
  ].join('\n');
  let el = document.getElementById('twin-colors');
  if (!el) { el = document.createElement('style'); el.id = 'twin-colors'; document.head.appendChild(el); }
  if (el.textContent !== css) el.textContent = css;
}

// ---------- wax seals ----------
const sealCache = {};
function sealSrc(c) {
  if (HAND_PICKED.includes(c) || c === 'gold') return `seal-${c}.png`;
  const hex = colorHex(c);
  if (!hex) return 'seal-sage.png';
  if (sealCache[hex]) return sealCache[hex];
  makeSeal(hex);
  return 'seal-gold.png'; // for the moment it takes to tint
}
async function makeSeal(hex) {
  if (makeSeal.busy && makeSeal.busy[hex]) return;
  (makeSeal.busy = makeSeal.busy || {})[hex] = true;
  const img = new Image();
  img.src = 'seal-blush.png';
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, cv.width, cv.height), px = data.data;
  let sum = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) { sum += px[i] + px[i + 1] + px[i + 2]; n++; }
  const mean = sum / n / 3, wax = hexRgb(hex);
  for (let i = 0; i < px.length; i += 4) {
    const shade = (px[i] + px[i + 1] + px[i + 2]) / 3 / mean;
    for (let j = 0; j < 3; j++) px[i + j] = Math.min(255, wax[j] * shade);
  }
  ctx.putImageData(data, 0, 0);
  sealCache[hex] = cv.toDataURL('image/png');
  document.querySelectorAll(`img[data-seal="${hex}"]`).forEach(el => { el.src = sealCache[hex]; });
}

// ---------- the picker (Settings) ----------
// One row of swatches per twin, plus Custom (hue + pale-to-deep sliders).
// A pick saves right away (like Appearance). The twins can't share a color.
function colorPickerHtml(t, c) {
  return `<div class="field twin-color" data-tc="${t.key}"><span class="field-label">${esc(t.name)}’s color</span>
    <div class="swatches">${TWIN_COLORS.map(([x, label]) => `<button type="button" class="swatch ${cp(x)}" data-color="${x}" aria-label="${label}" aria-pressed="${x === c}"></button>`).join('')}
      <button type="button" class="swatch swatch-custom" data-custom aria-label="Custom color" aria-pressed="${isCustomColor(c)}"${isCustomColor(c) ? ` style="background:${c}"` : ''}></button></div>
    <div class="custom-picker" hidden>
      <span class="field-label">Color</span><input type="range" data-hue min="0" max="359" step="1">
      <span class="field-label">Pale to deep</span><input type="range" data-depth min="0" max="100" step="1">
      <div class="custom-preview"><span class="pill ${t.key}">${esc(t.name)}</span><img class="custom-seal" alt=""></div>
    </div></div>`;
}
function bindColorPicker(root, key, picked = {}) {
  const box = root.querySelector(`[data-tc="${key}"]`);
  const custom = box.querySelector('[data-custom]'), picker = box.querySelector('.custom-picker');
  const hue = box.querySelector('[data-hue]'), depth = box.querySelector('[data-depth]');
  const start = isCustomColor(picked[key]) ? hexToHsl(picked[key]) : [350, 0, 0.55];
  hue.value = Math.round(start[0]);
  depth.value = Math.round(Math.min(1, Math.max(0, (0.8 - start[2]) / 0.5)) * 100);
  let saveTimer;
  const show = c => {
    const other = state.settings.twins.find(t => t.key !== key);
    if (other && twinColor(other.key) === c) { toast(`${other.name} already has that color`, true); return; }
    picked[key] = c;
    box.querySelectorAll('[data-color]').forEach(x => x.setAttribute('aria-pressed', x.dataset.color === c));
    custom.setAttribute('aria-pressed', isCustomColor(c));
    const twinsNow = state.settings.twins.map(t => (t.key === key ? { ...t, color: c } : t));
    state.settings = { ...state.settings, twins: twinsNow };
    paintTwinColors(isCustomColor(c) ? [c] : []);
    // Sliders save once they stop moving.
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => DB.saveSettings({ twins: state.settings.twins }).catch(e => toast(friendlyError(e), true)), 500);
  };
  let timer;
  const drawCustom = () => {
    const h = +hue.value, d = +depth.value / 100, c = softColor(h, d);
    custom.style.background = c;
    hue.style.background = `linear-gradient(to right, ${[0, 40, 80, 120, 160, 200, 240, 280, 320, 359].map(x => softColor(x, d)).join(', ')})`;
    depth.style.background = `linear-gradient(to right, ${softColor(h, 0)}, ${softColor(h, 0.5)}, ${softColor(h, 1)})`;
    clearTimeout(timer);
    timer = setTimeout(() => { const s = box.querySelector('.custom-seal'); s.dataset.seal = c; s.src = sealSrc(c); }, 120);
    show(c);
  };
  box.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { show(b.dataset.color); picker.hidden = true; });
  custom.onclick = () => { picker.hidden = false; drawCustom(); };
  hue.oninput = drawCustom;
  depth.oninput = drawCustom;
}

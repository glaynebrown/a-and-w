/* A&W UI: hash routes, screens and pop-ups. Data goes through DB (store.js,
   or demo.js in sample mode), photo prep through Photos, dates through Dates.
   Other screens: Things to do in todo.js, Right Now in now.js, words in
   words.js, Letters in letters.js, Books/growth/backup in books.js.

   Tabs:    #/timeline   #/now   #/ (home)   #/todo   #/letters
   Routes:  #/add        #/add/growth        #/add-old    #/moment/ID   #/moment/ID/edit
            #/now/KEY/edit   #/letter/new    #/letter/ID  #/letter/ID/edit
            #/words/KEY  #/settings          #/books      #/growth
            #/todo            #/suggest          #/wheel
            #/idea/new        #/idea/ID          #/idea/ID/edit   #/idea/ID/went
            #/login           #/reset                                        */

const view = document.getElementById('view');
const tabsEl = document.getElementById('tabs');
const bannerEl = document.getElementById('banner');
const state = {
  user: null, settings: null, moments: [], ideas: [], loaded: false, unwatch: [],
  filterWho: 'both', filterKind: 'all', todoFilter: 'all', query: '', nowTwin: null, nowView: 'date',
};
let DB = Store.configured ? Store : null;

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const momentById = id => state.moments.find(m => m.id === id);

function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = ''; }, isError ? 6000 : 3000);
}

const ERRORS = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'permission-denied': 'You don’t have permission to do that.',
  'unavailable': 'You’re offline, and this isn’t saved on this phone yet.',
  'storage/retry-limit-exceeded': 'No connection. Check your internet and try again.',
  'storage/unauthorized': 'The server refused this photo. Sign out and back in, then try again.',
};
const friendlyError = e => ERRORS[e && e.code] || (e && e.message) || 'Something went wrong.';

// Disables a button while its action runs and shows any error as a toast.
async function busy(btn, fn, text = 'Saving…') {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = text;
  try { return await fn(); } catch (e) { console.error(e); toast(friendlyError(e), true); } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

function openModal(html, onMount) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(bg);
  if (onMount) onMount(bg, close);
  return close;
}

function confirmBox(title, body, yes, onYes) {
  openModal(`<h2>${esc(title)}</h2><p>${esc(body)}</p>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn danger" id="yes">${esc(yes)}</button></div>`,
  (root, close) => $('#yes', root).onclick = e => busy(e.target, async () => { await onYes(); close(); }, 'Working…'));
}

// ---------- date picker ----------
// iPhone's built-in date picker ignores the app's colors, so every date field
// becomes a button that opens A&W's own sage-and-cream calendar. It happens
// automatically for any <input type="date"> that appears on screen.
const MONTHS_LONG = [...Array(12)].map((_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }));
const CAL_ICON = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`;
const valueProp = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

function enhanceDateInput(input) {
  if (input.dataset.dp) return;
  input.dataset.dp = '1';
  const { min, max } = input;
  input.type = 'hidden';
  // Letters: tapping the written date on the stationery opens the calendar.
  const tapTarget = input.closest('.date-tap');
  let btn = tapTarget, draw = () => {};
  if (!tapTarget) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-field';
    input.after(btn);
    draw = () => {
      const v = valueProp.get.call(input);
      btn.innerHTML = `<span class="${v ? '' : 'placeholder'}">${v ? esc(Dates.pretty(v)) : 'Pick a date'}</span>${CAL_ICON}`;
    };
  }
  // Setting .value from code (like a date read from a photo) redraws the button too.
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: () => valueProp.get.call(input),
    set: v => { valueProp.set.call(input, v); draw(); },
  });
  draw();
  btn.addEventListener('click', e => {
    e.preventDefault();
    openDatePicker(input.value, { min, max }, v => {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function openDatePicker(value, { min, max }, onPick) {
  const t = Dates.today();
  const start = Dates.valid(value) ? value : (max && t > max ? max : t);
  let y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7));
  const firstYear = min ? Number(min.slice(0, 4)) : 2020;
  const lastYear = max ? Number(max.slice(0, 4)) : Number(t.slice(0, 4)) + 5;
  const allowed = d => (!min || d >= min) && (!max || d <= max);
  const pad = n => String(n).padStart(2, '0');

  openModal(`
    <div class="dp-head">
      <button type="button" class="dp-arrow" data-step="-1" aria-label="Previous month">‹</button>
      <div class="dp-title">
        <select class="dp-month" aria-label="Month">${MONTHS_LONG.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('')}</select>
        <select class="dp-year" aria-label="Year">${Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i).map(yr => `<option>${yr}</option>`).join('')}</select>
      </div>
      <button type="button" class="dp-arrow" data-step="1" aria-label="Next month">›</button>
    </div>
    <div class="dp-weekdays" aria-hidden="true"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
    <div class="dp-grid"></div>
    <div class="dp-foot"><button type="button" class="btn small-pill" data-close>Cancel</button>
      <button type="button" class="btn small-pill" data-today${allowed(t) ? '' : ' disabled'}>Today</button></div>`, (root, close) => {
    const modal = $('.modal', root);
    modal.classList.add('dp-modal');
    const monthSel = $('.dp-month', modal), yearSel = $('.dp-year', modal), grid = $('.dp-grid', modal);
    const pick = v => { close(); onPick(v); };
    function drawCal() {
      monthSel.value = String(m);
      yearSel.value = String(y);
      const lead = new Date(y, m - 1, 1).getDay();
      const days = new Date(y, m, 0).getDate();
      let html = '<span></span>'.repeat(lead);
      for (let d = 1; d <= days; d++) {
        const iso = `${y}-${pad(m)}-${pad(d)}`;
        html += `<button type="button" class="dp-day${iso === value ? ' selected' : ''}${iso === t ? ' today' : ''}" data-date="${iso}"${allowed(iso) ? '' : ' disabled'} aria-label="${esc(Dates.pretty(iso))}">${d}</button>`;
      }
      grid.innerHTML = html;
      $$('[data-date]', grid).forEach(b => { b.onclick = () => pick(b.dataset.date); });
      $$('[data-step]', modal).forEach(b => {
        const step = Number(b.dataset.step);
        const ny = m + step < 1 ? y - 1 : m + step > 12 ? y + 1 : y;
        const nm = ((m + step + 11) % 12) + 1;
        const firstOfNext = `${ny}-${pad(nm)}-01`, lastOfNext = `${ny}-${pad(nm)}-31`;
        b.disabled = ny < firstYear || ny > lastYear || (max && firstOfNext > max) || (min && lastOfNext < min);
      });
    }
    $$('[data-step]', modal).forEach(b => b.onclick = () => {
      m += Number(b.dataset.step);
      if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
      drawCal();
    });
    monthSel.onchange = () => { m = Number(monthSel.value); drawCal(); };
    yearSel.onchange = () => { y = Number(yearSel.value); drawCal(); };
    $('[data-today]', modal).onclick = () => pick(t);
    drawCal();
  });
}

new MutationObserver(() => $$('input[type="date"]').forEach(enhanceDateInput))
  .observe(document.body, { childList: true, subtree: true });

// ---------- appearance ----------
function getTheme() {
  try { return localStorage.getItem('aw-theme') || 'system'; } catch { return 'system'; }
}
function setTheme(theme) {
  try { localStorage.setItem('aw-theme', theme); } catch {}
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

// ---------- icons (simple line drawings) ----------
const svg = (d, extra = '') => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
const ICON = {
  camera: svg('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.2"/>'),
  pin: svg('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><path d="M12 7.5v5M9.5 10h5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  home: svg('<path d="M4 11 12 4l8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19.5z"/>'),
  timeline: svg('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M11 6h9M11 18h9M11 12h6"/>'),
  compass: svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  pen: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.4 23.2 8.6 14.4 9.2 14.3C9 9.2 13.4 4.6 21 2.4 19.6 5 18.1 6.8 16.1 8.2L18.2 8.3C16.6 10.1 14.6 11.3 12.4 12L14.3 12.5C12.7 13.8 11.1 14.6 9.7 15L5.2 20.6 4.4 20.9Z" fill="currentColor"/><path d="M9.5 14.7Q12.3 9.6 17.2 5.9" fill="none" style="stroke:var(--surface)" stroke-width=".8" stroke-linecap="round"/></svg>`,
  sparkle: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
  book: svg('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>'),
  back: svg('<path d="m14 6-6 6 6 6"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  photos: svg('<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/><path d="m3 15 4-4 4 4 2-2 4 4"/>'),
  crop: svg('<path d="M7 3v14h14M3 7h14v14"/>'),
  grip: svg('<circle cx="9" cy="6" r=".6"/><circle cx="15" cy="6" r=".6"/><circle cx="9" cy="12" r=".6"/><circle cx="15" cy="12" r=".6"/><circle cx="9" cy="18" r=".6"/><circle cx="15" cy="18" r=".6"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  chat: svg('<path d="M5 18.5V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9z"/>'),
  chevronRight: svg('<path d="m9 6 6 6-6 6"/>'),
  chart: svg('<path d="M4 4v16h16"/><path d="m7 15 4-4 3 3 5-6"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  wheel: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/><circle cx="12" cy="12" r="2"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  sliders: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  shuffle: svg('<path d="M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M17 4l3 3-3 3M17 14l3 3-3 3"/>'),
};
const WHEEL = `<svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true" style="flex:none">
  <circle cx="27" cy="27" r="25" style="fill:var(--sage-bg)"/><path d="M27 27V2a25 25 0 0 1 25 25z" style="fill:var(--blush-bg)"/>
  <path d="M27 27v25A25 25 0 0 1 2 27z" style="fill:var(--blush-bg)"/><path d="M27 27h25a25 25 0 0 1-25 25z" style="fill:var(--sand-bg)"/>
  <circle cx="27" cy="27" r="25" style="fill:none;stroke:var(--border)"/><circle cx="27" cy="27" r="5" style="fill:var(--text)"/></svg>`;

// ---------- twins ----------
const twins = () => state.settings.twins;
const twinName = key => (twins().find(t => t.key === key) || {}).name || key;
const bothNames = () => twins().map(t => t.name).join(' and ');
function whoText(who = []) {
  if (who.length >= 2) return bothNames();
  return who.map(twinName).join('');
}
const pills = (who = []) => twins().filter(t => who.includes(t.key))
  .map(t => `<span class="pill ${t.key}">${esc(t.name)}</span>`).join('');
// After birth: "20 months, 1 week". Before birth: weeks of pregnancy, counted
// from the due date (40 weeks), e.g. "32 weeks pregnant" / "32 wk".
function ageOn(date, short) {
  const s = state.settings;
  if (!Dates.valid(date) || !Dates.valid(s.birthday) || date >= s.birthday) return Dates.age(s.birthday, date, short);
  if (!Dates.valid(s.dueDate)) return short ? 'before birth' : 'Before you were born';
  const weeks = Math.floor(40 - (Dates.parse(s.dueDate) - Dates.parse(date)) / (7 * 86400000));
  if (weeks < 1) return short ? 'before birth' : 'Before you were born';
  return short ? `${weeks} wks` : `${weeks} weeks pregnant`;
}
const beforeBirth = date => Dates.valid(state.settings.birthday) && date < state.settings.birthday;

// ---------- routing ----------
const TAB_ROUTES = ['timeline', 'now', '', 'todo', 'letters'];
const scrollMemory = {};
let currentHash = null;

function parseHash() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

function route() {
  if (currentHash !== null) scrollMemory[currentHash] = window.scrollY;
  currentHash = location.hash || '#/';
  const [page = '', id, sub] = parseHash();

  if (!DB) return renderSetupNeeded();
  if (!state.user) {
    showChrome(false);
    return page === 'reset' ? renderReset() : renderLogin();
  }
  if (!state.settings || !state.loaded) return renderLoading();

  showChrome(TAB_ROUTES.includes(page) && !id, page);
  const screens = {
    '': renderHome, timeline: renderTimeline, add: () => renderForm(null, id), 'add-old': renderAddOld,
    moment: () => (sub === 'edit' ? renderForm(id) : renderMoment(id)),
    now: () => (id === 'questions' ? renderNowQuestions() : sub === 'edit' ? renderNowForm(id) : renderNow()),
    letters: renderLetters,
    journal: () => { location.replace('#/letters'); },
    letter: () => renderLetter(id, sub),
    words: () => renderWords(id),
    books: () => renderBooks(id), growth: renderGrowth, settings: renderSettings,
    todo: renderTodo, suggest: renderSuggest, wheel: renderWheel,
    idea: () => (id === 'new' ? renderIdeaForm(null) : sub === 'edit' ? renderIdeaForm(id) : sub === 'went' ? renderWent(id) : renderIdea(id)),
  };
  (screens[page] || renderHome)();
  // Coming back to a list puts you where you were; anything else starts at the top.
  window.scrollTo(0, TAB_ROUTES.includes(page) && !id ? (scrollMemory[currentHash] || 0) : 0);
}

// Re-draw from fresh data, but never while someone is filling in a form.
function refresh() {
  const [page = '', id, sub] = parseHash();
  if (['add', 'add-old', 'settings', 'wheel', 'letter', 'books', 'words'].includes(page) || sub === 'edit' || sub === 'went' || id === 'new') return;
  if (page === 'now' && id === 'questions') return;
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}

function showChrome(tabs, page) {
  view.classList.toggle('no-tabs', !tabs);
  tabsEl.hidden = !tabs;
  $$('a', tabsEl).forEach(a => {
    if (a.dataset.tab === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  bannerEl.hidden = !(DB && DB.demo);
}

// ---------- session ----------
function startSession() {
  DB.onAuth(async user => {
    state.unwatch.forEach(stop => stop());
    state.unwatch = [];
    state.user = user;
    state.settings = null;
    state.moments = [];
    state.ideas = [];
    state.loaded = false;
    if (!user) return route();
    route();
    try {
      state.settings = await DB.loadSettings();
    } catch (e) {
      console.error(e);
      toast(friendlyError(e), true);
      state.settings = { ...DEFAULT_SETTINGS };
    }
    // The first screen waits until both lists have arrived once.
    const got = { moments: false, ideas: false };
    const arrived = (key, list) => {
      state[key] = list;
      got[key] = true;
      if (state.loaded) return refresh();
      if (got.moments && got.ideas) { state.loaded = true; route(); }
    };
    const onError = e => { console.error(e); toast(friendlyError(e), true); };
    state.unwatch = [
      DB.watchMoments(list => arrived('moments', list), onError),
      DB.watchIdeas(list => arrived('ideas', list), onError),
    ];
  });
}

// ---------- screens: setup, sign in ----------
function renderLoading() {
  showChrome(false);
  view.innerHTML = '<p class="loading">Loading…</p>';
}

function renderSetupNeeded() {
  showChrome(false);
  view.innerHTML = `<div class="auth"><div class="auth-card">
    <h1 class="wordmark">A&amp;W</h1>
    <p class="age">Will and Millie’s story</p>
    <div class="card">
      <p>A&amp;W isn’t connected to Firebase yet, so nothing can be saved.</p>
      <p class="muted small" style="margin-top:8px">The setup steps are in README.md. Until then, you can look around with sample moments.</p>
      <button class="btn primary block" id="sample" style="margin-top:14px">Try sample mode</button>
    </div></div></div>`;
  $('#sample').onclick = startSample;
}

function startSample() {
  DB = DemoStore;
  try { sessionStorage.setItem('aw-sample', '1'); } catch {}
  startSession();
}

function renderLogin() {
  view.innerHTML = `<div class="auth"><form class="auth-card" id="f" novalidate>
    <h1 class="wordmark">A&amp;W</h1>
    <p class="age">Will and Millie’s story</p>
    <label class="field"><span class="field-label">Email</span><input type="email" id="email" autocomplete="username" required></label>
    <label class="field"><span class="field-label">Password</span><input type="password" id="pw" autocomplete="current-password" required></label>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" style="margin-top:20px">Sign in</button>
    <p style="text-align:center;margin-top:14px"><a class="small muted" href="#/reset">Forgot password?</a></p>
  </form></div>`;
  $('#f').onsubmit = e => {
    e.preventDefault();
    const email = $('#email').value.trim(), pw = $('#pw').value;
    const err = $('#err');
    if (!email || !pw) { err.textContent = 'Enter your email and password.'; err.hidden = false; return; }
    err.hidden = true;
    busy(e.submitter || $('button', e.target), async () => {
      try { await DB.signIn(email, pw); location.hash = '#/'; } catch (x) { err.textContent = friendlyError(x); err.hidden = false; }
    }, 'Signing in…');
  };
}

function renderReset() {
  view.innerHTML = `<div class="auth"><form class="auth-card" id="f" novalidate>
    <h1 class="wordmark">A&amp;W</h1>
    <p class="age">We’ll email you a link to pick a new password.</p>
    <label class="field"><span class="field-label">Email</span><input type="email" id="email" autocomplete="username"></label>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" style="margin-top:20px">Send link</button>
    <p style="text-align:center;margin-top:14px"><a class="small muted" href="#/login">Back to sign in</a></p>
  </form></div>`;
  $('#f').onsubmit = e => {
    e.preventDefault();
    const email = $('#email').value.trim(), err = $('#err');
    if (!email) { err.textContent = 'Enter your email.'; err.hidden = false; return; }
    busy($('button', e.target), async () => {
      try { await DB.resetPassword(email); toast('Link sent. Check your email.'); location.hash = '#/login'; } catch (x) { err.textContent = friendlyError(x); err.hidden = false; }
    }, 'Sending…');
  };
}

// ---------- pieces ----------
function photoGrid(m) {
  const ph = m.photos || [];
  if (!ph.length) return '';
  const shown = ph.slice(0, ph.length === 3 ? 3 : Math.min(ph.length, 4));
  const cls = ['', 'g1', 'g2', 'g3', 'g4'][shown.length];
  const extra = ph.length - shown.length;
  // Big tiles (one photo, two side by side, the large first of three) use the
  // full-size copy so they're sharp; small grid tiles use the preview.
  const big = i => shown.length <= 2 || (shown.length === 3 && i === 0);
  const cells = shown.map((p, i) => {
    const src = p.video ? (p.poster || p.thumbUrl) : big(i) ? p.url : (p.thumbUrl || p.url);
    const img = p.video
      ? `<div class="cell">${`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`}<span class="play-badge" aria-label="Video">▶</span></div>`
      : `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`;
    return i === shown.length - 1 && extra > 0 ? `<div class="cell">${img}<div class="more">+${extra}</div></div>` : img;
  }).join('');
  return `<div class="grid ${cls}">${cells}</div>`;
}

function kindBadge(m) {
  if (m.kind === 'first') return '<span class="badge-first">★ First</span>';
  if (m.kind === 'quote') return '<span class="badge-quote">“ Quote</span>';
  if (m.kind === 'growth') return '<span class="badge-quote">Growth</span>';
  if (m.kind === 'snapshot') return '<span class="badge-quote">Right now</span>';
  if (m.kind === 'words') return '<span class="badge-quote">Words</span>';
  return '';
}

// Letters and word lists live on their own pages, never on the timeline.
const isOnTimeline = m => m.kind !== 'letter' && m.kind !== 'wordlist';

// ---------- growth ----------
const MEASURES = [['weight', 'Weight', 'lb'], ['height', 'Height', 'in']];
const num = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
// "24.5 lb · 32 in"
function growthText(g = {}) {
  return [
    g.weight != null && `${g.weight} lb`,
    g.height != null && `${g.height} in`,
  ].filter(Boolean).join(' · ');
}
function growthLines(m, only) {
  return twins().filter(t => (!only || t.key === only) && m.growth && m.growth[t.key] && growthText(m.growth[t.key]))
    .map(t => `<p class="growth-line"><span class="pill ${t.key}">${esc(t.name)}</span>${esc(growthText(m.growth[t.key]))}</p>`).join('');
}

// only: when the timeline is filtered to one twin, growth shows just theirs.
function momentCard(m, label = '', only = null) {
  const body = m.kind === 'quote'
    ? `<p class="quote">“${esc(m.caption)}”</p><p class="quote-by">${esc(whoText(m.who))}</p>`
    : m.kind === 'snapshot' ? `<p class="caption">${esc(whoText(m.who))} right now · ${esc(ageOn(m.date, true))}</p>${snapshotSummary(m)}`
    : m.kind === 'words' ? `<p class="caption">${esc(whoText(m.who))}’s ${ordinal(m.n)} word: “${esc(m.word)}”</p>`
    : (m.caption ? `<p class="caption">${esc(m.caption)}</p>` : '') + (m.kind === 'growth' ? growthLines(m, only) : '');
  const href = m.kind === 'words' ? `#/words/${esc(m.who[0])}` : `#/moment/${esc(m.id)}`;
  return `<a class="card moment" href="${href}">
    ${label ? `<p class="otd-label">${esc(label)}</p>` : ''}
    <div class="moment-meta">${m.kind === 'growth' ? '' : pills(m.who)}${kindBadge(m)}<span class="date">${esc(Dates.short(m.date))}</span></div>
    ${photoGrid(m)}${body}</a>`;
}

// ---------- home ----------
function renderHome() {
  const t = Dates.today();
  const md = t.slice(5);
  const shown = state.moments.filter(isOnTimeline);
  const onThisDay = shown.filter(m => m.date.slice(5) === md && m.date < t);
  const recent = shown.filter(m => (m.photos || []).length).slice(0, 6);

  const otd = onThisDay.map(m => {
    const n = Dates.yearsAgo(m.date, t);
    const when = n === 1 ? 'One year ago today' : `${n} years ago today`;
    return momentCard(m, beforeBirth(m.date) ? `${when} · Before you were born, ${ageOn(m.date, true)}` : when);
  }).join('');

  const start = !state.moments.length ? `<div class="card empty">
      <h2>Start their story</h2>
      <p>Add a photo from today, or bring in old ones. Nothing here is ever due.</p>
      <a class="btn" href="#/add-old">${ICON.photos} Add old photos</a></div>` : '';

  view.innerHTML = `
    <header class="home-head">
      <div><h1 class="wordmark">A&amp;W</h1><p class="age">${esc(bothNames())} · ${esc(ageOn(t))}</p></div>
      <a class="icon-btn plain" href="#/settings" aria-label="Settings">${ICON.gear}</a>
    </header>
    <div class="quick">
      <a class="big-btn sage" href="#/add">${ICON.camera}Add moment</a>
      <a class="big-btn blush" href="#/idea/new">${ICON.pin}Save idea</a>
    </div>
    ${state.moments.length ? `<a class="text-link" href="#/add-old">Add old photos</a>` : '<div style="height:12px"></div>'}
    <a class="card wheel-card" href="#/todo">${WHEEL}<div><h2>What should we do today?</h2><p>Spin the wheel · Suggestions</p></div></a>
    ${start}
    ${otd}
    ${recent.length ? `<p class="section-label">Recent</p><div class="recent">${recent.map(m =>
      `<a href="#/moment/${esc(m.id)}"><img src="${esc(m.photos[0].video ? (m.photos[0].poster || m.photos[0].thumbUrl) : (m.photos[0].thumbUrl || m.photos[0].url))}" alt="${esc(m.caption || Dates.short(m.date))}" loading="lazy"></a>`).join('')}</div>` : ''}
  `;
}

// ---------- timeline ----------
// Two filters that combine: whose moments (both, Will, Millie) and what kind.
const KIND_FILTERS = [['all', 'All'], ['first', '★ Firsts'], ['quote', 'Quotes'], ['words', 'Words'], ['growth', 'Growth']];
function matches(m, who, kind) {
  if (who !== 'both' && !(m.who || []).includes(who)) return false;
  return kind === 'all' || m.kind === kind;
}

function renderTimeline() {
  const who = state.filterWho, kind = state.filterKind;
  const list = [...state.moments.filter(isOnTimeline), ...wordMilestones()]
    .filter(m => matches(m, who, kind))
    .sort((a, b) => b.date.localeCompare(a.date));
  const months = new Map();
  for (const m of list) {
    const k = Dates.monthKey(m.date);
    if (!months.has(k)) months.set(k, []);
    months.get(k).push(m);
  }
  const whoChips = [['both', 'Both'], ...twins().map(t => [t.key, t.name])].map(([key, text]) =>
    `<button class="chip ${key === 'both' ? '' : key}" data-who-f="${key}" aria-pressed="${who === key}">${esc(text)}</button>`).join('');
  const kindChips = KIND_FILTERS.map(([key, text]) =>
    `<button class="chip" data-kind-f="${key}" aria-pressed="${kind === key}">${esc(text)}</button>`).join('');

  // Pregnancy months sit under one "Before you were born" heading (newest first,
  // so it comes right after their birth month).
  let dividerShown = false;
  const body = [...months].map(([k, ms]) => {
    const pre = beforeBirth(ms[0].date);
    const divider = pre && !dividerShown ? (dividerShown = true, `<div class="born-divider">${DIVIDER}<span>Before you were born</span></div>`) : '';
    return `${divider}<div class="month"><h2>${esc(Dates.monthLabel(k))}</h2><span>${esc(ageOn(ms[0].date, true))}</span></div>
     ${ms.map(m => momentCard(m, '', who === 'both' ? null : who)).join('')}`;
  }).join('');

  const empty = state.moments.length
    ? `<div class="card empty"><p>Nothing here with this filter yet.</p></div>`
    : `<div class="card empty"><h2>Their story starts here</h2><p>Every moment you add shows up here, month by month.</p>
       <a class="btn primary" href="#/add">${ICON.camera} Add moment</a></div>`;

  view.innerHTML = `
    <div class="page-head"><h1>Timeline</h1><a class="icon-btn" href="#/add" aria-label="Add moment">${ICON.plus}</a></div>
    <div class="seg" role="group" aria-label="Whose moments" style="margin-bottom:8px">${whoChips}</div>
    <div class="chips" role="group" aria-label="What kind">${kindChips}</div>
    ${kind === 'growth' ? `<a class="card wheel-card" href="#/growth">${ICON.chart}<div><h2>Growth chart</h2><p>Weight and height over time</p></div></a>` : ''}
    ${body || empty}`;
  $$('[data-who-f]').forEach(b => b.onclick = () => { state.filterWho = b.dataset.whoF; renderTimeline(); window.scrollTo(0, 0); });
  $$('[data-kind-f]').forEach(b => b.onclick = () => { state.filterKind = b.dataset.kindF; renderTimeline(); window.scrollTo(0, 0); });
}

// ---------- one moment ----------
// Leaving a page (Back, Cancel, or after Save) steps back to where you came
// from instead of stacking up a new page, so Back never loops. If the app was
// opened straight to this page, it goes to `fallback` instead. `steps` skips
// more than one page (e.g. after deleting from an edit screen).
function goBack(fallback, steps = 1) {
  let inApp = false;
  try { inApp = sessionStorage.getItem('aw-nav') === '1'; } catch {}
  if (inApp && history.length > steps) history.go(-steps); else location.replace(fallback);
}
// Every "‹ Back" / "‹ Cancel" link behaves the same way.
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a.back');
  if (!a || e.defaultPrevented) return;
  e.preventDefault();
  goBack(a.getAttribute('href') || '#/');
});

function renderMoment(id) {
  const m = momentById(id);
  if (m && m.kind === 'letter') return renderLetter(id);
  if (!m) { view.innerHTML = `<a class="back" href="#/timeline">${ICON.back} Timeline</a><div class="card empty"><p>This moment isn’t here anymore.</p></div>`; return; }
  const ages = ageOn(m.date);
  // A short caption is the headline. A long one (like an imported Facebook post)
  // reads as a paragraph under the photos, and the date becomes the headline.
  const long = (m.kind === 'moment' || m.kind === 'first') && (m.caption || '').length > 90;
  const photosHtml = `<div class="full-photos">${(m.photos || []).map(p => p.video
      // A video (only the Facebook import has one): plays right here. thumbUrl is its still frame.
      ? `<video src="${esc(p.url)}" poster="${esc(p.thumbUrl || '')}" controls playsinline preload="none"
          style="aspect-ratio:${p.w || 16}/${p.h || 9}"></video>`
      : `<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="" loading="lazy" decoding="async"
        style="aspect-ratio:${p.w || 4}/${p.h || 3}"></a>`).join('')}</div>`;
  view.innerHTML = `
    <a class="back" href="#/timeline" id="back">${ICON.back} Back</a>
    <div class="moment-meta" style="margin-bottom:8px">${pills(m.who)}${kindBadge(m)}</div>
    <h1 style="font-size:24px">${long ? esc(Dates.pretty(m.date)) : m.kind === 'quote' ? '“' + esc(m.caption) + '”' : m.kind === 'snapshot' ? `${esc(whoText(m.who))} right now` : esc(m.caption || (m.kind === 'growth' ? 'Growth check' : Dates.pretty(m.date)))}</h1>
    ${m.ideaId && ideaById(m.ideaId) ? `<a class="text-link" style="margin:6px 0 0" href="#/idea/${esc(m.ideaId)}">${ICON.pin.replace('class="icon"', 'class="icon" style="width:16px;height:16px;vertical-align:-3px"')} ${esc(ideaById(m.ideaId).title)}</a>` : ''}
    <p class="muted small" style="margin:4px 0 14px">${esc([!long && (m.caption || m.kind === 'growth' || m.kind === 'snapshot') ? Dates.pretty(m.date) : '', ages, m.kind === 'quote' ? whoText(m.who) : ''].filter(Boolean).join(' · '))}</p>
    ${m.kind === 'growth' ? `<div style="margin-bottom:14px">${growthLines(m)}<a class="text-link" href="#/growth">See growth chart</a></div>` : ''}
    ${m.kind === 'snapshot' ? `<dl class="answers" style="margin-bottom:16px">${orderedAnswers(m.answers).map(([k, v]) =>
      `<div><dt>${esc(fieldLabel(k))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${photosHtml}
    ${long ? `<p class="moment-text">${esc(m.caption)}</p>` : ''}
    <div class="actions">
      <a class="btn" href="#/moment/${esc(m.id)}/edit">Edit</a>
      <button class="btn danger" id="del">Delete</button>
    </div>`;
  $('#back').onclick = e => { e.preventDefault(); goBack('#/timeline'); };
  $('#del').onclick = () => confirmBox('Delete this moment?',
    (m.photos || []).length ? 'Its photos will be deleted from A&W too. The originals on your phone aren’t touched.' : 'This can’t be undone.',
    'Delete', async () => { await DB.deleteMoment(m); toast('Deleted'); goBack('#/timeline'); });
}

// ---------- add / edit ----------
function whoChips(selected) {
  return twins().map(t => `<button type="button" class="chip ${t.key}" data-who="${t.key}" aria-pressed="${selected.includes(t.key)}">${esc(t.name)}</button>`).join('');
}
const readWho = root => $$('[data-who]', root).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.who);
function bindToggles(root) {
  $$('[data-who]', root).forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
}

function renderForm(id, startKind) {
  const m = id && id !== 'growth' ? momentById(id) : null;
  if (m && m.kind === 'snapshot') return renderNowForm(m.who[0], m.id);
  if (id && id !== 'growth' && !m) return renderMoment(id);
  const form = {
    kind: m ? m.kind : startKind === 'growth' ? 'growth' : 'moment',
    keep: m ? [...(m.photos || [])] : [],
    removed: [],
    added: [],             // { file, preview, date }
    dateTouched: !!m,
  };

  view.innerHTML = `
    <a class="back" href="${m ? '#/moment/' + esc(m.id) : '#/'}">${ICON.back} Cancel</a>
    <h1 style="font-size:26px;margin-bottom:6px">${m ? 'Edit moment' : 'Add moment'}</h1>
    <p class="muted small">Only a photo or a few words are needed. Everything else is optional.</p>

    <div class="field" style="margin-top:18px"><span class="field-label">Photos</span>
      <div class="picker" id="picker"></div>
      <input type="file" id="files" accept="image/*" multiple hidden>
    </div>

    <div class="field" style="margin-top:18px"><span class="field-label">Who</span>
      <div class="seg" id="who">${whoChips(m ? m.who : twins().map(t => t.key))}</div>
    </div>

    <div class="field" style="margin-top:18px"><span class="field-label">What kind</span>
      <div class="seg" id="kind">
        <button type="button" class="chip" data-kind="moment">Moment</button>
        <button type="button" class="chip" data-kind="first">★ First</button>
        <button type="button" class="chip" data-kind="quote">Quote</button>
        <button type="button" class="chip" data-kind="growth">Growth</button>
      </div>
    </div>

    <div id="growth-fields">${twins().map(t => `
      <div class="field growth-twin" data-gt="${t.key}" style="margin-top:18px"><span class="field-label">${esc(t.name)}</span>
        <div class="two">${MEASURES.map(([k, label, unit]) => `
          <label><span class="hint">${label} (${unit})</span>
          <input type="text" inputmode="decimal" data-g="${t.key}.${k}" value="${esc(m && m.growth && m.growth[t.key] && m.growth[t.key][k] != null ? m.growth[t.key][k] : '')}" autocomplete="off"></label>`).join('')}
        </div></div>`).join('')}
      <p class="hint" style="margin-top:6px">Fill in whatever you have from the checkup. Decimals are fine: 24.5 lb.</p>
    </div>

    <label class="field"><span class="field-label" id="cap-label">Caption</span>
      <textarea id="caption" rows="3"></textarea></label>

    <label class="field"><span class="field-label">Date</span>
      <input type="date" id="date" value="${esc(m ? m.date : Dates.today())}" max="${Dates.today()}">
      <p class="hint" id="date-hint"></p></label>

    <p class="error" id="err" hidden></p>
    <button class="btn primary block" id="save" style="margin-top:22px">Save</button>
    <p class="progress" id="progress" hidden></p>`;

  const caption = $('#caption');
  caption.value = m ? m.caption || '' : '';

  function drawKind() {
    $$('[data-kind]').forEach(b => b.setAttribute('aria-pressed', b.dataset.kind === form.kind));
    const quote = form.kind === 'quote', growth = form.kind === 'growth';
    $('#cap-label').textContent = quote ? 'What they said' : form.kind === 'first' ? 'What was the first?' : growth ? 'Note (optional)' : 'Caption';
    caption.placeholder = quote ? 'Uh oh, ball go bye bye' : form.kind === 'first' ? 'First steps' : growth ? '18-month checkup' : 'Pumpkin patch with Grandma';
    $('#growth-fields').hidden = !growth;
    const who = readWho($('#who'));
    $$('[data-gt]').forEach(el => { el.hidden = !who.includes(el.dataset.gt); });
  }
  $$('[data-kind]').forEach(b => b.onclick = () => { form.kind = b.dataset.kind; drawKind(); });
  bindToggles($('#who'));
  $('#who').addEventListener('click', () => setTimeout(drawKind));
  drawKind();

  function drawPicker() {
    const tiles = [
      ...form.keep.map((p, i) => `<div class="thumb"><img src="${esc(p.thumbUrl || p.url)}" alt=""><button type="button" class="remove" data-keep="${i}" aria-label="Remove photo">${ICON.x}</button></div>`),
      ...form.added.map((a, i) => `<div class="thumb"><img src="${esc(a.preview)}" alt=""><button type="button" class="remove" data-add="${i}" aria-label="Remove photo">${ICON.x}</button></div>`),
      `<button type="button" class="add-tile" id="pick">${ICON.plus}Add photos</button>`,
    ];
    $('#picker').innerHTML = tiles.join('');
    $('#pick').onclick = () => $('#files').click();
    $$('[data-keep]').forEach(b => b.onclick = () => { form.removed.push(...form.keep.splice(+b.dataset.keep, 1)); drawPicker(); });
    $$('[data-add]').forEach(b => b.onclick = () => { const [a] = form.added.splice(+b.dataset.add, 1); URL.revokeObjectURL(a.preview); drawPicker(); });
  }
  drawPicker();

  $('#date').oninput = () => { form.dateTouched = true; $('#date-hint').textContent = ''; };
  $('#files').onchange = async e => {
    const files = [...e.target.files];
    e.target.value = '';
    for (const file of files) {
      form.added.push({ file, preview: URL.createObjectURL(file), date: await Photos.takenOn(file) });
    }
    drawPicker();
    // Date follows the photos (earliest one) unless you've set it yourself.
    const dates = form.added.map(a => a.date).filter(Boolean).sort();
    if (!form.dateTouched && dates.length) {
      $('#date').value = dates[0];
      $('#date-hint').textContent = 'Date taken from the photo';
    }
  };

  $('#save').onclick = e => {
    const err = $('#err');
    const who = readWho($('#who'));
    const date = $('#date').value;
    const text = caption.value.trim();
    let growth = null, badNumber = false;
    if (form.kind === 'growth') {
      growth = {};
      for (const key of who) {
        const g = {};
        for (const [k] of MEASURES) {
          const raw = $(`[data-g="${key}.${k}"]`).value.trim();
          const v = num(raw);
          if (raw && (v == null || v <= 0)) badNumber = true;
          if (v != null && v > 0) g[k] = Math.round(v * 100) / 100;
        }
        if (Object.keys(g).length) growth[key] = g;
      }
    }
    const problem = !who.length ? 'Pick Will, Millie, or both.'
      : !Dates.valid(date) ? 'Pick a date.'
      : badNumber ? 'Measurements should be numbers, like 24.5.'
      : growth && !Object.keys(growth).length ? 'Add at least one measurement.'
      : form.kind === 'quote' && !text ? 'Type what they said.'
      : !text && !form.keep.length && !form.added.length ? 'Add a photo or a few words.'
      : '';
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    err.hidden = true;

    const progress = $('#progress');
    busy(e.target, async () => {
      const prepared = [];
      for (let i = 0; i < form.added.length; i++) {
        progress.hidden = false;
        progress.textContent = `Getting photo ${i + 1} of ${form.added.length} ready…`;
        prepared.push(await Photos.prepare(form.added[i].file));
      }
      const onEach = n => { progress.textContent = `Uploading ${n} of ${prepared.length}…`; };
      const data = { kind: form.kind, who: growth ? Object.keys(growth) : who, date, caption: text, growth: growth || null };
      if (m) {
        await DB.updateMoment(m, data, prepared, form.removed, onEach);
        toast('Saved');
        goBack(`#/moment/${m.id}`);
      } else {
        await DB.addMoment(data, prepared, onEach);
        toast('Saved');
        goBack('#/');
      }
      form.added.forEach(a => URL.revokeObjectURL(a.preview));
    }).finally(() => { progress.hidden = true; });
  };
}

// ---------- add old photos ----------
function renderAddOld() {
  let groups = []; // [{ date, files: [] }]

  view.innerHTML = `
    <a class="back" href="#/">${ICON.back} Cancel</a>
    <h1 style="font-size:26px;margin-bottom:6px">Add old photos</h1>
    <p class="muted small">Pick as many as you like. Photos from the same day become one moment, dated from the photo, so each lands in the right month. Captions can be added later, or never.</p>

    <div class="field" style="margin-top:18px"><span class="field-label">Who’s in these</span>
      <div class="seg" id="who">${whoChips(twins().map(t => t.key))}</div>
      <p class="hint">You can change any of them afterward.</p>
    </div>

    <button class="btn block" id="pick" style="margin-top:18px">${ICON.photos} Choose photos</button>
    <input type="file" id="files" accept="image/*" multiple hidden>
    <div id="summary"></div>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" id="save" style="margin-top:18px" hidden>Add</button>
    <p class="progress" id="progress" hidden></p>`;
  bindToggles($('#who'));
  $('#pick').onclick = () => $('#files').click();

  $('#files').onchange = async e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    $('#summary').innerHTML = '<p class="progress">Reading dates…</p>';
    const byDate = new Map();
    for (const f of files) {
      const d = (await Photos.takenOn(f)) || (f.lastModified ? Dates.iso(new Date(f.lastModified)) : Dates.today());
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(f);
    }
    groups = [...byDate].sort((a, b) => a[0].localeCompare(b[0])).map(([date, fs]) => ({ date, files: fs }));
    $('#summary').innerHTML = `<ul class="day-list">${groups.map(g =>
      `<li><span>${esc(Dates.pretty(g.date))}</span><span class="muted">${g.files.length} photo${g.files.length === 1 ? '' : 's'}</span></li>`).join('')}</ul>`;
    const save = $('#save');
    save.hidden = false;
    save.textContent = `Add ${files.length} photo${files.length === 1 ? '' : 's'} as ${groups.length} moment${groups.length === 1 ? '' : 's'}`;
  };

  $('#save').onclick = e => {
    const who = readWho($('#who'));
    const err = $('#err');
    if (!who.length) { err.textContent = 'Pick Will, Millie, or both.'; err.hidden = false; return; }
    err.hidden = true;
    const total = groups.reduce((n, g) => n + g.files.length, 0);
    const progress = $('#progress');
    let done = 0;
    busy(e.target, async () => {
      progress.hidden = false;
      for (const g of groups) {
        const prepared = [];
        for (const f of g.files) {
          progress.textContent = `Photo ${done + prepared.length + 1} of ${total}… keep A&W open until it finishes.`;
          prepared.push(await Photos.prepare(f));
        }
        await DB.addMoment({ kind: 'moment', who, date: g.date, caption: '' }, prepared);
        done += g.files.length;
      }
      toast(`Added ${total} photo${total === 1 ? '' : 's'}`);
      goBack('#/timeline');
    }, 'Adding…').finally(() => { progress.hidden = true; });
  };
}

// ---------- settings ----------
function renderSettings() {
  const s = state.settings;
  const theme = getTheme();
  view.innerHTML = `
    <a class="back" href="#/">${ICON.back} Home</a>
    <h1 style="font-size:26px;margin-bottom:16px">Settings</h1>
    <form id="f" novalidate>
      <section class="settings-group card">
        <h2>The twins</h2>
        <div class="two">${s.twins.map((t, i) => `
          <label class="field"><span class="field-label">${esc(t.fullName || 'Name')} goes by</span>
          <input type="text" data-twin="${i}" value="${esc(t.name)}" autocomplete="off"></label>`).join('')}</div>
        <label class="field"><span class="field-label">Birthday</span>
          <input type="date" id="bday" value="${esc(s.birthday)}" max="${Dates.today()}"></label>
        <label class="field"><span class="field-label">Original due date</span>
          <input type="date" id="due" value="${esc(s.dueDate || '')}"></label>
        <p class="hint">Used for “32 weeks” on moments from the pregnancy.</p>
      </section>

      <section class="settings-group card">
        <h2>Home</h2>
        <label class="field" style="margin-top:6px"><span class="field-label">Town or address</span>
          <input type="text" id="home" value="${esc((s.home && s.home.label) || '')}" placeholder="Stafford, VA" autocomplete="off"></label>
        <p class="hint">Where drive times and nearby ideas start from. Change it anytime, like if you move.</p>
      </section>

      <section class="settings-group card">
        <h2>Appearance</h2>
        <div class="seg" style="margin-top:10px" id="theme">
          ${[['system', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([k, t]) =>
            `<button type="button" class="chip" data-theme="${k}" aria-pressed="${theme === k}">${t}</button>`).join('')}
        </div>
      </section>

      <p class="error" id="err" hidden></p>
      <button class="btn primary block" id="save" style="margin-top:20px">Save</button>
    </form>

    <section class="settings-group card" style="margin-top:24px">
      <h2>Keepsakes</h2>
      <a class="row-link" href="#/books"><span>${ICON.book} Books</span><span class="muted small">Make a PDF</span></a>
      <a class="row-link" href="#/books/backup"><span>${ICON.download} Backup</span><span class="muted small">Photos and data</span></a>
      <a class="row-link" href="#/growth"><span>${ICON.chart} Growth chart</span><span class="muted small">Weight and height</span></a>
      <a class="row-link" href="#/letters"><span>${ICON.pen} Letters</span><span class="muted small">To William and Amelia</span></a>
    </section>

    <section class="settings-group card">
      <h2>Account</h2>
      <p class="muted small" style="margin:4px 0 12px">${DB.demo ? 'Sample mode. Nothing is saved.' : 'Signed in as ' + esc(state.user.email)}</p>
      <button class="btn block" id="out">${DB.demo ? 'Leave sample mode' : 'Sign out'}</button>
    </section>`;

  $$('[data-theme]').forEach(b => b.onclick = () => {
    setTheme(b.dataset.theme);
    $$('[data-theme]').forEach(x => x.setAttribute('aria-pressed', x === b));
  });

  $('#f').onsubmit = e => {
    e.preventDefault();
    const err = $('#err');
    const names = $$('[data-twin]').map(i => i.value.trim());
    const bday = $('#bday').value;
    const home = $('#home').value.trim();
    const problem = names.some(n => !n) ? 'Both names are needed.' : !Dates.valid(bday) ? 'Pick their birthday.' : '';
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    err.hidden = true;
    busy($('#save'), async () => {
      const patch = {
        twins: s.twins.map((t, i) => ({ ...t, name: names[i] })),
        birthday: bday,
        dueDate: Dates.valid($('#due').value) ? $('#due').value : '',
        // Moving clears the saved map point so drive times are worked out again.
        home: home === (s.home && s.home.label) ? s.home : { label: home },
      };
      await DB.saveSettings(patch);
      state.settings = { ...s, ...patch };
      toast('Saved');
      goBack('#/');
    });
  };

  $('#out').onclick = () => {
    try { sessionStorage.removeItem('aw-sample'); } catch {}
    DB.signOut();
  };
}

// ---------- start ----------
window.addEventListener('hashchange', () => {
  try { sessionStorage.setItem('aw-nav', '1'); } catch {}
  route();
});

bannerEl.innerHTML = 'Sample mode · nothing is saved <button type="button" id="leave-sample">Leave</button>';
$('#leave-sample').onclick = () => { try { sessionStorage.removeItem('aw-sample'); } catch {} location.hash = ''; location.reload(); };

const offline = $('#offline-bar');
const showOffline = () => { offline.hidden = navigator.onLine; };
window.addEventListener('online', showOffline);
window.addEventListener('offline', showOffline);
showOffline();

if (!DB) {
  let sample = false;
  try { sample = sessionStorage.getItem('aw-sample') === '1'; } catch {}
  if (sample) startSample(); else route();
} else {
  startSession();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Offline mode unavailable', e));
}

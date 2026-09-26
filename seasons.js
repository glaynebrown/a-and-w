/* Seasonal traditions: a banner on Home and To do while it's the season for
   something you love doing (pumpkin patch, Christmas lights...), starting a
   week early as a heads-up.

   - Saved ideas can be tagged with traditions (idea.seasons = ['pumpkins']),
     so your favorite spots show right in the banner.
   - "We went!" on one of those spots during the season marks it done for the
     year; "Not this year" hides it until next season (settings.seasonSkip).
   - "Last year" links to a moment from that tradition, found by words in the
     caption or a visit to one of its spots.
   - The list and dates are editable (settings.seasons); none of it nags. */

const HEADS_UP_DAYS = 7;
const DEFAULT_SEASONS = [
  { key: 'blossoms', name: 'Cherry blossoms', start: '03-20', end: '04-15', query: 'cherry blossoms', words: 'blossom' },
  { key: 'easter', name: 'Easter egg hunt', easter: true, query: 'easter egg hunt', words: 'easter|egg hunt' },
  { key: 'strawberries', name: 'Strawberry picking', start: '05-01', end: '06-15', query: 'strawberry picking', words: 'strawberr' },
  { key: 'fireworks', name: 'Fourth of July fireworks', start: '06-25', end: '07-04', query: 'fourth of july fireworks', words: 'firework|4th of july|fourth of july' },
  { key: 'sunflowers', name: 'Sunflower fields', start: '07-15', end: '08-31', query: 'sunflower field', words: 'sunflower' },
  { key: 'apples', name: 'Apple picking', start: '09-01', end: '10-31', query: 'apple picking orchard', words: 'apple pick|orchard' },
  { key: 'pumpkins', name: 'Pumpkin patch & fall festival', start: '09-15', end: '10-31', query: 'pumpkin patch', words: 'pumpkin|fall fest' },
  { key: 'halloween', name: 'Trunk-or-treat & Halloween', start: '10-01', end: '10-31', query: 'trunk or treat', words: 'trunk or treat|halloween|costume' },
  { key: 'lights', name: 'Christmas lights', start: '11-25', end: '01-05', query: 'christmas light show', words: 'light show|christmas lights|lights' },
  { key: 'santa', name: 'Photos with Santa', start: '11-25', end: '12-24', query: 'photos with santa', words: 'santa' },
];
const seasonList = () => (state.settings.seasons && state.settings.seasons.length ? state.settings.seasons : DEFAULT_SEASONS);

// Easter Sunday (Gregorian), as 'YYYY-MM-DD'.
function easterDate(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const addDays = (iso, n) => { const d = Dates.parse(iso); d.setDate(d.getDate() + n); return Dates.iso(d); };

// The season's dates in a given year (a window like Nov 25 - Jan 5 runs into the next year).
function windowFor(s, y) {
  if (s.easter) { const e = easterDate(y); return { start: addDays(e, -14), end: e, year: y }; }
  const end = s.end < s.start ? `${y + 1}-${s.end}` : `${y}-${s.end}`;
  return { start: `${y}-${s.start}`, end, year: y };
}

// Which traditions to show today, and how: 'soon' (heads-up week), 'now', or 'done'.
function currentSeasons(t = Dates.today()) {
  const y = Number(t.slice(0, 4));
  const skip = state.settings.seasonSkip || {};
  const out = [];
  for (const s of seasonList()) {
    if (s.off) continue;
    const w = [windowFor(s, y - 1), windowFor(s, y)].find(x => t >= addDays(x.start, -HEADS_UP_DAYS) && t <= x.end);
    if (!w || skip[s.key] === w.year) continue;
    const spots = state.ideas.filter(i => (i.seasons || []).includes(s.key) && !hiddenNow(i));
    const done = spots.some(i => (i.visits || []).some(v => v.date >= w.start && v.date <= w.end));
    out.push({ s, w, spots, status: done ? 'done' : t < w.start ? 'soon' : 'now', last: lastTime(s, w) });
  }
  return out;
}

// A moment from this tradition in an earlier season (newest first).
function lastTime(s, w) {
  const re = s.words ? new RegExp(s.words, 'i') : null;
  const spotIds = new Set(state.ideas.filter(i => (i.seasons || []).includes(s.key)).map(i => i.id));
  for (let back = 1; back <= 3; back++) {
    const pw = windowFor(s, w.year - back);
    const hit = state.moments.find(m => isOnTimeline(m) && m.date >= addDays(pw.start, -3) && m.date <= addDays(pw.end, 3)
      && ((m.ideaId && spotIds.has(m.ideaId)) || (re && re.test(m.caption || ''))));
    if (hit) return hit;
  }
  return null;
}

const shortMD = iso => Dates.parse(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const shorten = (s, n = 60) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// Home: one small "In season" card (tap through to To do for the details).
// To do: a full banner for each, with spots, Find nearby, Last time, Not this year.
function seasonBanners(where) {
  const list = currentSeasons().filter(x => where === 'todo' || x.status !== 'done');
  if (!list.length) return '';
  if (where === 'home') {
    // The X hides these particular traditions from Home for this season; a new one coming into season brings the card back.
    const hidden = state.settings.seasonHomeHidden || [];
    const tag = x => `${x.s.key}:${x.w.year}`;
    const showing = list.filter(x => !hidden.includes(tag(x)));
    if (!showing.length) return '';
    return `<div class="season season-home" data-tags="${esc(showing.map(tag).join(','))}">
      <button type="button" class="season-x" aria-label="Hide from Home">${ICON.x}</button>
      <a class="season-home-link" href="#/todo">
      <p class="season-label">In season</p>
      ${showing.map(({ s, w, spots, status }) => `<div class="season-line">
        <span class="season-name">${esc(s.name)}</span>
        <span class="season-when">${status === 'soon' ? `starts ${esc(shortMD(w.start))}` : `through ${esc(shortMD(w.end))}`}</span>
        ${spots.length ? `<span class="season-mini">${spots.map(i => esc(i.title)).join(' · ')}</span>` : ''}
      </div>`).join('')}
      </a>
    </div>`;
  }
  return `<div class="season-banners">${list.map(({ s, w, spots, status, last }) => {
    if (status === 'done') return `<div class="season done">✓ ${esc(s.name)} · done this year</div>`;
    const when = status === 'soon' ? `starts ${esc(shortMD(w.start))}` : `through ${esc(shortMD(w.end))}`;
    return `<div class="season" data-season="${esc(s.key)}">
      <div class="season-top"><p class="season-name">${esc(s.name)}</p><span class="season-when">${status === 'soon' ? 'Coming up · ' : ''}${when}</span></div>
      <div class="season-links">
        ${spots.map(i => `<a class="season-spot" href="#/idea/${esc(i.id)}">${ICON.pin}${esc(i.title)}</a>`).join('')}
        ${s.query ? `<button type="button" class="season-spot find" data-season-find="${esc(s.key)}">${ICON.search}Find ${spots.length ? 'more ' : ''}nearby</button>` : ''}
      </div>
      ${last ? `<a class="season-last" href="#/moment/${esc(last.id)}">Last time: ${esc(shorten(last.caption || 'a memory'))} · ${esc(shortMD(last.date))}, ${last.date.slice(0, 4)}</a>` : ''}
      <button type="button" class="link-btn season-skip" data-season-skip="${esc(s.key)}" data-year="${w.year}">Not this year</button>
    </div>`;
  }).join('')}</div>`;
}

// Wires up the banner buttons after a page draws them.
function bindSeasonBanners(root = document) {
  $$('.season-x', root).forEach(b => b.onclick = () => {
    const card = b.closest('.season-home');
    const seasonHomeHidden = [...new Set([...(state.settings.seasonHomeHidden || []), ...card.dataset.tags.split(',')])].slice(-40);
    state.settings = { ...state.settings, seasonHomeHidden };
    card.remove();
    DB.saveSettings({ seasonHomeHidden }).catch(console.error);
  });
  $$('[data-season-find]', root).forEach(b => b.onclick = () => {
    const s = seasonList().find(x => x.key === b.dataset.seasonFind);
    state.query = s.query;
    state.pendingNearby = s.query;
    if (location.hash === '#/todo') renderTodo(); else location.hash = '#/todo';
  });
  $$('[data-season-skip]', root).forEach(b => b.onclick = () => busy(b, async () => {
    const seasonSkip = { ...(state.settings.seasonSkip || {}), [b.dataset.seasonSkip]: Number(b.dataset.year) };
    await DB.saveSettings({ seasonSkip });
    state.settings = { ...state.settings, seasonSkip };
    b.closest('.season').remove();
    toast('Hidden until next season');
  }, '…'));
}

// ---------- editing the list ----------
const MONTH_SHORT = [...Array(12)].map((_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'short' }));
function mdPicker(id, value) {
  const [m, d] = (value || '01-01').split('-').map(Number);
  return `<span class="md-pick"><select data-md="${id}-m" aria-label="Month">${MONTH_SHORT.map((n, i) => `<option value="${i + 1}"${i + 1 === m ? ' selected' : ''}>${n}</option>`).join('')}</select>
    <select data-md="${id}-d" aria-label="Day">${[...Array(31)].map((_, i) => `<option${i + 1 === d ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></span>`;
}
const readMD = (root, id) => `${String($(`[data-md="${id}-m"]`, root).value).padStart(2, '0')}-${String($(`[data-md="${id}-d"]`, root).value).padStart(2, '0')}`;

function renderSeasons() {
  const list = seasonList().map(s => ({ ...s }));
  view.innerHTML = `
    <a class="back" href="#/todo">${ICON.back} Things to do</a>
    <h1 style="font-size:26px;margin-bottom:4px">Seasonal traditions</h1>
    <p class="muted small">A banner shows on Home and To do during each season, starting a week early. Turn off any you don’t do, change the dates, or add your own.</p>
    <div id="sl" style="margin-top:14px"></div>
    <button type="button" class="btn block" id="add" style="margin-top:12px">${ICON.plus} Add a tradition</button>
    <button type="button" class="link-btn" id="reset" style="display:block;margin:14px auto 0">Go back to the starting list</button>
    <button class="btn primary block" id="save" style="margin-top:18px">Save</button>`;

  const draw = () => {
    $('#sl').innerHTML = list.map((s, n) => `<div class="card season-row${s.off ? ' off' : ''}" data-row="${n}">
      <div class="season-row-top">
        <input type="text" data-name="${n}" value="${esc(s.name)}" placeholder="Beach week" aria-label="Name">
        <label class="switch" title="Show this one"><input type="checkbox" data-on="${n}"${s.off ? '' : ' checked'}></label>
      </div>
      ${s.easter ? '<p class="muted small" style="margin-top:8px">The two weeks before Easter (changes every year)</p>'
        : `<div class="season-dates">${mdPicker(`s${n}`, s.start)}<span class="muted">to</span>${mdPicker(`e${n}`, s.end)}</div>`}
      ${s.custom ? `<input type="text" data-query="${n}" value="${esc(s.query || '')}" placeholder="What to search nearby (beach, sledding hill…)" style="margin-top:8px">
        <button type="button" class="link-btn" data-del="${n}" style="margin-top:6px">Remove</button>` : ''}
    </div>`).join('');
    $$('[data-name]').forEach(i => i.oninput = () => { list[+i.dataset.name].name = i.value; });
    $$('[data-query]').forEach(i => i.oninput = () => { list[+i.dataset.query].query = i.value; });
    $$('[data-on]').forEach(i => i.onchange = () => { list[+i.dataset.on].off = !i.checked; i.closest('.season-row').classList.toggle('off', !i.checked); });
    $$('[data-del]').forEach(b => b.onclick = () => { list.splice(+b.dataset.del, 1); draw(); });
  };
  const readDates = () => list.forEach((s, n) => { if (!s.easter) { s.start = readMD(view, `s${n}`); s.end = readMD(view, `e${n}`); } });
  draw();
  $('#add').onclick = () => {
    readDates();
    list.push({ key: 'c' + Date.now().toString(36), name: '', start: '06-01', end: '08-31', query: '', custom: true });
    draw();
    $$('[data-name]').pop().focus();
  };
  $('#reset').onclick = () => { list.splice(0, list.length, ...DEFAULT_SEASONS.map(s => ({ ...s }))); draw(); };
  $('#save').onclick = e => {
    readDates();
    const seasons = list.filter(s => s.name.trim()).map(s => ({ ...s, name: s.name.trim(), query: (s.query || '').trim() }));
    busy(e.target, async () => {
      await DB.saveSettings({ seasons });
      state.settings = { ...state.settings, seasons };
      toast('Saved');
      goBack('#/todo');
    });
  };
}

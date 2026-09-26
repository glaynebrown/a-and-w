/* Things to do: saved places and at-home ideas, search, Suggestions, the
   wheel, "We went!" visits and heart ratings. Uses the helpers in app.js
   ($, esc, ICON, DB, state...), which are all loaded before anything runs.

   Ratings: the most recent rated visit counts.
     4-5 hearts  favorite: shows up more often, two slices on the wheel
     3 hearts    normal
     1-2 hearts  out of Suggestions and the wheel, either "Not for now"
                 (back in 6 months) or "Not for us" (until you bring it back).
                 It stays in the saved list, faded. */

const CATEGORIES = [
  ['park', 'Park / playground'], ['animals', 'Animals / farm'], ['water', 'Water / splash'],
  ['indoor', 'Indoor play'], ['library', 'Library / story time'], ['events', 'Seasonal / events'],
  ['food', 'Food / treats'], ['home', 'At home'],
];
const COSTS = [['free', 'Free'], ['under20', 'Under $20'], ['under50', 'Under $50'], ['more', '$50+']];
const SETTINGS_IO = [['indoor', 'Indoor'], ['outdoor', 'Outdoor'], ['both', 'Both']];
const LENGTHS = [['quick', 'Quick (under 1 hr)'], ['half', 'Half day'], ['full', 'Full day']];
const DRIVE_MOODS = [['rough', 'Rough day', 15], ['decent', 'Decent', 30], ['road', 'Road-trip mood', Infinity]];
const LIST_FILTERS = [
  ['all', 'All'], ['fav', 'Favorites'], ['try', 'Want to try'], ['been', 'Been there'], ['home', 'At home'], ['passed', 'Passed on'],
];

const catLabel = k => (CATEGORIES.find(c => c[0] === k) || [, ''])[1];
const costLabel = k => (COSTS.find(c => c[0] === k) || [, ''])[1];
const ideaById = id => state.ideas.find(i => i.id === id);
const isHome = i => i.category === 'home';

// ---------- idea status ----------
function hiddenNow(i, t = Dates.today()) {
  const h = i.hide;
  return !!h && (h.mode === 'never' || (h.mode === 'later' && h.until > t));
}
const isFav = i => (i.lastRating || 0) >= 4;
const beenThere = i => (i.visits || []).length > 0;
const weight = i => (isFav(i) ? 3 : 1);
const lastVisit = i => [...(i.visits || [])].sort((a, b) => b.date.localeCompare(a.date))[0];

function hearts(n, size = 13) {
  if (!n) return '';
  return `<span class="hearts" style="font-size:${size}px" aria-label="${n} of 5 hearts">${
    [1, 2, 3, 4, 5].map(k => `<span class="${k <= n ? 'on' : ''}">♥</span>`).join('')}</span>`;
}

function ideaMeta(i) {
  return [
    isHome(i) ? 'At home' : (i.drive != null && i.drive !== '' ? `${i.drive} min drive` : ''),
    costLabel(i.cost),
    i.setting === 'both' ? 'Indoor + outdoor' : (SETTINGS_IO.find(s => s[0] === i.setting) || [, ''])[1],
  ].filter(Boolean).join(' · ');
}

function ideaCard(i) {
  const ph = (i.photos || [])[0];
  const hidden = hiddenNow(i);
  const tag = hidden ? (i.hide.mode === 'never' ? 'Not for us' : 'Not for now')
    : isFav(i) ? '' : !beenThere(i) ? 'Want to try' : '';
  return `<a class="card idea-card${hidden ? ' faded' : ''}" href="#/idea/${esc(i.id)}">
    <div class="idea-thumb">${ph ? `<img src="${esc(ph.thumbUrl || ph.url)}" alt="" loading="lazy">` : ICON[isHome(i) ? 'home' : 'pin']}</div>
    <div class="idea-body">
      <p class="idea-title">${esc(i.title)}</p>
      <p class="idea-meta">${esc(ideaMeta(i))}</p>
      <p class="idea-tags">${hearts(i.lastRating)}${tag ? `<span class="tag">${esc(tag)}</span>` : ''}</p>
    </div></a>`;
}

// ---------- saved filters (Suggestions + wheel share them) ----------
const DEFAULT_PICKS = { budget: 'any', drive: 'road', cats: [], where: 'either', length: 'any', homeOnly: false };
function getPicks() {
  try { return { ...DEFAULT_PICKS, ...JSON.parse(localStorage.getItem('aw-picks') || '{}') }; } catch { return { ...DEFAULT_PICKS }; }
}
function setPicks(p) {
  try { localStorage.setItem('aw-picks', JSON.stringify(p)); } catch {}
}

const COST_RANK = { free: 0, under20: 1, under50: 2, more: 3 };
const LENGTH_RANK = { quick: 0, half: 1, full: 2 };
// Unknown details never rule an idea out -- a half-filled idea still shows up.
function fits(i, p) {
  if (p.homeOnly && !isHome(i)) return false;
  if (p.budget !== 'any' && i.cost && COST_RANK[i.cost] > COST_RANK[p.budget]) return false;
  const limit = (DRIVE_MOODS.find(d => d[0] === p.drive) || [])[2] ?? Infinity;
  if (!isHome(i) && i.drive != null && i.drive !== '' && Number(i.drive) > limit) return false;
  if (p.cats.length && !p.cats.includes(i.category)) return false;
  if (p.where !== 'either' && i.setting && i.setting !== 'both' && i.setting !== p.where) return false;
  if (p.length !== 'any' && i.length && LENGTH_RANK[i.length] > LENGTH_RANK[p.length]) return false;
  return true;
}
const pool = p => state.ideas.filter(i => !hiddenNow(i) && fits(i, p));

// Weighted random pick without repeats (favorites count 3x).
function weightedPicks(list, n) {
  const left = [...list], out = [];
  while (left.length && out.length < n) {
    const total = left.reduce((s, i) => s + weight(i), 0);
    let r = Math.random() * total;
    const k = left.findIndex(i => (r -= weight(i)) < 0);
    out.push(...left.splice(k < 0 ? left.length - 1 : k, 1));
  }
  return out;
}

// "Not this one" on the wheel hides an idea for the rest of today only.
const skipKey = () => `aw-skip-${Dates.today()}`;
function skippedToday() {
  try { return JSON.parse(localStorage.getItem(skipKey()) || '[]'); } catch { return []; }
}
function skipToday(id) {
  try {
    for (let n = 0; n < localStorage.length; n++) {
      const k = localStorage.key(n);
      if (k && k.startsWith('aw-skip-') && k !== skipKey()) localStorage.removeItem(k);
    }
    localStorage.setItem(skipKey(), JSON.stringify([...skippedToday(), id]));
  } catch {}
}

function directionsUrl(i) {
  const home = (state.settings.home && state.settings.home.label) || '';
  return i.address
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(i.address)}`
    : `https://maps.apple.com/?q=${encodeURIComponent(`${i.title} ${home}`.trim())}`;
}
function safeUrl(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; }
}

// ---------- Things to do (list + search) ----------
function listMatches(i, f) {
  switch (f) {
    case 'fav': return isFav(i) && !hiddenNow(i);
    case 'try': return !beenThere(i) && !hiddenNow(i);
    case 'been': return beenThere(i);
    case 'home': return isHome(i) && !hiddenNow(i);
    case 'passed': return hiddenNow(i);
    default: return true;
  }
}
function searchMatches(i, q) {
  if (!q) return true;
  const hay = [i.title, i.notes, i.address, catLabel(i.category), costLabel(i.cost)].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
}

function renderTodo() {
  view.innerHTML = `
    <div class="page-head"><h1>Things to do</h1><a class="icon-btn" href="#/idea/new" aria-label="Save idea">${ICON.plus}</a></div>
    <div class="search">${ICON.search}<input type="search" id="q" placeholder="Splash pad, story time, farm…" value="${esc(state.query)}" autocomplete="off" enterkeyhint="search"></div>
    <div class="quick" style="margin-top:12px">
      <a class="big-btn sage" href="#/suggest">${ICON.sliders}Suggestions</a>
      <a class="big-btn blush" href="#/wheel">${ICON.wheel}Spin the wheel</a>
    </div>
    <div class="list-head">
      <select id="lf" aria-label="Show">${LIST_FILTERS.map(([k, t]) => `<option value="${k}"${state.todoFilter === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <span class="muted small" id="count"></span>
    </div>
    <div id="list"></div>`;

  const draw = () => {
    const q = state.query.trim();
    const items = state.ideas
      .filter(i => listMatches(i, state.todoFilter) && searchMatches(i, q))
      // Favorites first, then want-to-try, then the rest; passed-on ones last.
      .sort((a, b) => (hiddenNow(a) - hiddenNow(b)) || ((b.lastRating || 0) - (a.lastRating || 0)) || a.title.localeCompare(b.title));
    $('#count').textContent = `${items.length} idea${items.length === 1 ? '' : 's'}`;
    const home = (state.settings.home && state.settings.home.label) || '';
    const web = q ? `<a class="card web-card" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${q} near ${home}`)}" target="_blank" rel="noopener">
        ${ICON.search}<div><p class="idea-title">Search Google Maps for “${esc(q)}”</p><p class="idea-meta">Near ${esc(home)} · opens Maps</p></div></a>` : '';
    const empty = !state.ideas.length
      ? `<div class="card empty"><h2>Save your first idea</h2><p>A place you want to try, or something from TikTok to do at home. Only a name is needed.</p>
         <a class="btn primary" href="#/idea/new">${ICON.plus} Save idea</a></div>`
      : !items.length ? `<div class="card empty"><p>${q ? 'None of your saved ideas match.' : 'Nothing here yet.'}</p></div>` : '';
    $('#list').innerHTML = items.map(ideaCard).join('') + empty + web;
  };
  draw();

  $('#q').oninput = e => { state.query = e.target.value; draw(); };
  $('#lf').onchange = e => { state.todoFilter = e.target.value; draw(); };
}

// ---------- Suggestions ----------
function chipGroup(name, options, selected, multi) {
  return `<div class="chip-wrap" data-group="${name}"${multi ? ' data-multi="1"' : ''}>${options.map(([k, t]) =>
    `<button type="button" class="chip" data-v="${k}" aria-pressed="${multi ? selected.includes(k) : selected === k}">${esc(t)}</button>`).join('')}</div>`;
}

function renderSuggest() {
  const p = getPicks();
  let shown = null;

  view.innerHTML = `
    <a class="back" href="#/todo">${ICON.back} Things to do</a>
    <h1 style="font-size:26px;margin-bottom:4px">Suggestions</h1>
    <p class="muted small">Answer only what matters today.</p>

    <p class="field-label" style="margin-top:18px">Budget</p>
    ${chipGroup('budget', [['free', 'Free'], ['under20', 'Under $20'], ['under50', 'Under $50'], ['any', 'Any']], p.budget)}
    <p class="field-label" style="margin-top:16px">How much car can they handle?</p>
    ${chipGroup('drive', DRIVE_MOODS.map(([k, t, m]) => [k, m === Infinity ? `${t} (45+)` : `${t} (${m} min)`]), p.drive)}
    <p class="field-label" style="margin-top:16px">Kind of thing</p>
    ${chipGroup('cats', CATEGORIES, p.cats, true)}
    <p class="field-label" style="margin-top:16px">Inside or outside</p>
    ${chipGroup('where', [['indoor', 'Indoor'], ['outdoor', 'Outdoor'], ['either', 'Either']], p.where)}
    <p class="field-label" style="margin-top:16px">How long</p>
    ${chipGroup('length', [['quick', 'Quick outing'], ['half', 'Half day'], ['any', 'Any']], p.length)}

    <div class="picks-head"><h2 id="matches"></h2><button class="btn" id="shuffle">${ICON.shuffle} Shuffle</button></div>
    <div id="picks"></div>
    <button class="btn block" id="all" style="margin-top:12px" hidden></button>
    <a class="btn block" href="#/wheel" style="margin-top:10px">Spin the wheel with these</a>`;

  $$('.chip-wrap').forEach(g => $$('.chip', g).forEach(b => b.onclick = () => {
    const name = g.dataset.group;
    if (g.dataset.multi) {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on);
      p[name] = $$('.chip', g).filter(x => x.getAttribute('aria-pressed') === 'true').map(x => x.dataset.v);
    } else {
      $$('.chip', g).forEach(x => x.setAttribute('aria-pressed', x === b));
      p[name] = b.dataset.v;
    }
    p.homeOnly = false;
    setPicks(p);
    shown = null;
    draw();
  }));

  function draw(showAll) {
    const list = pool(p);
    $('#matches').textContent = `${list.length} match${list.length === 1 ? '' : 'es'}`;
    if (!shown || shown.some(i => !list.includes(i))) shown = weightedPicks(list, 3);
    const items = showAll ? [...list].sort((a, b) => weight(b) - weight(a) || a.title.localeCompare(b.title)) : shown;
    $('#picks').innerHTML = items.map(ideaCard).join('') || `<div class="card empty"><p>Nothing saved fits all of that. Try loosening one choice.</p></div>`;
    $('#shuffle').hidden = list.length <= 3 || showAll;
    const all = $('#all');
    all.hidden = showAll || list.length <= 3;
    all.textContent = `See all ${list.length}`;
  }
  draw();
  $('#shuffle').onclick = () => { shown = weightedPicks(pool(p), 3); draw(); };
  $('#all').onclick = () => draw(true);
}

// ---------- the wheel ----------
const SLICE_COLORS = ['var(--sage-bg)', 'var(--blush-bg)', 'var(--sand-bg)'];
const MAX_IDEAS = 10; // on the wheel at once (favorites add a second slice)

// Every slice is the same size; favorites get two slices, placed on opposite
// sides of the wheel. The wheel is split into two halves with favorites at the
// same spots in each half, and everything else fills in around them.
function wheelSlices(ideas) {
  const shuffle = a => { for (let n = a.length - 1; n > 0; n--) { const k = Math.floor(Math.random() * (n + 1)); [a[n], a[k]] = [a[k], a[n]]; } return a; };
  const favs = shuffle(ideas.filter(isFav)), others = shuffle(ideas.filter(i => !isFav(i)));
  const total = ideas.length + favs.length;
  const size1 = Math.ceil(total / 2), size2 = total - size1;
  const favAt = new Map(favs.map((f, k) => [Math.floor(k * size2 / favs.length), f]));
  const half = size => [...Array(size)].map((_, n) => favAt.get(n) || others.shift());
  return [...half(size1), ...half(size2)].map(idea => ({ idea }));
}

function renderWheel() {
  const p = getPicks();
  let rotation = 0, spinning = false, slices = [];

  view.innerHTML = `
    <a class="back" href="#/todo">${ICON.back} Things to do</a>
    <h1 style="font-size:26px;margin-bottom:4px">What should we do?</h1>
    <p class="muted small" id="using"></p>
    <label class="switch"><input type="checkbox" id="home-only"${p.homeOnly ? ' checked' : ''}><span>At home only</span></label>
    <div class="wheel-wrap">
      <svg class="pointer" viewBox="0 0 24 20" width="28" height="24" aria-hidden="true"><path d="M12 20 2 2h20z" style="fill:var(--text)"/></svg>
      <svg id="wheel" viewBox="-150 -150 300 300" role="img" aria-label="Wheel of ideas"></svg>
    </div>
    <button class="btn primary block" id="spin">Spin</button>
    <div id="result"></div>`;

  function usingText() {
    const bits = [
      p.budget !== 'any' && (p.budget === 'free' ? 'Free' : costLabel(p.budget)),
      p.drive !== 'road' && DRIVE_MOODS.find(d => d[0] === p.drive)[1].toLowerCase(),
      p.cats.length && p.cats.map(catLabel).join(', '),
      p.where !== 'either' && p.where,
      p.length !== 'any' && (p.length === 'quick' ? 'quick outing' : 'half day'),
    ].filter(Boolean);
    return `${bits.length ? 'Using: ' + bits.join(' · ') : 'Using all your saved ideas'} · <a href="#/suggest">Change</a>`;
  }

  function build() {
    const skipped = skippedToday();
    const list = pool(p).filter(i => !skipped.includes(i.id));
    slices = wheelSlices(weightedPicks(list, Math.min(list.length, MAX_IDEAS)));
    $('#using').innerHTML = usingText();
    draw();
  }

  function draw() {
    const w = $('#wheel');
    $('#spin').disabled = !slices.length;
    if (!slices.length) {
      w.innerHTML = `<circle r="140" style="fill:var(--surface-2)"/><text text-anchor="middle" y="-6" class="wheel-empty">Nothing to spin</text>
        <text text-anchor="middle" y="16" class="wheel-empty small">Save ideas or loosen Suggestions</text>`;
      return;
    }
    const span = 360 / slices.length;
    const R = 140;
    const pt = (deg, r) => { const rad = (deg - 90) * Math.PI / 180; return [r * Math.cos(rad), r * Math.sin(rad)]; };
    const parts = slices.map((sl, n) => {
      const i = sl.idea;
      const start = n * span, end = start + span, mid = start + span / 2;
      sl.mid = mid;
      const [x1, y1] = pt(start, R), [x2, y2] = pt(end, R);
      const shape = slices.length === 1
        ? `<circle r="${R}" style="fill:${SLICE_COLORS[0]}"/>`
        : `<path d="M0 0L${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 ${span > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z" style="fill:${SLICE_COLORS[n % 3 === 0 && n === slices.length - 1 && n > 0 ? 1 : n % 3]};stroke:var(--surface);stroke-width:2"/>`;
      const max = isFav(i) ? 16 : 18;
      const label = esc(i.title.length > max ? i.title.slice(0, max - 1) + '…' : i.title) + (isFav(i) ? ' <tspan class="wheel-heart">♥</tspan>' : '');
      return `${shape}<text transform="rotate(${(mid - 90).toFixed(2)}) translate(${R - 10} 0)" text-anchor="end" dominant-baseline="middle" class="wheel-label">${label}</text>`;
    });
    w.innerHTML = `<g id="spinner" style="transform:rotate(${rotation}deg)">${parts.join('')}</g>
      <circle r="${R}" style="fill:none;stroke:var(--border)"/><circle r="14" style="fill:var(--surface);stroke:var(--border)"/>`;
  }

  function spin() {
    if (spinning || !slices.length) return;
    spinning = true;
    $('#result').innerHTML = '';
    // Any slice is equally likely; favorites have two, so they come up twice as often.
    const hit = slices[Math.floor(Math.random() * slices.length)];
    const winner = hit.idea;
    // Land inside the winner's slice under the pointer (top), not always dead center.
    const wobble = (Math.random() - 0.5) * (360 / slices.length) * 0.6;
    const target = -(hit.mid + wobble);
    rotation += 360 * 5 + (((target - rotation) % 360) + 360) % 360;
    const g = $('#spinner');
    g.style.transition = 'transform 4s cubic-bezier(.15,.7,.2,1)';
    g.style.transform = `rotate(${rotation}deg)`;
    const done = () => { spinning = false; showResult(winner); };
    g.addEventListener('transitionend', done, { once: true });
    // Reduced-motion or hidden tab: no transition event, so finish anyway.
    setTimeout(() => { if (spinning) done(); }, 4300);
  }

  function showResult(i) {
    const go = isHome(i)
      ? `<a class="btn primary" href="#/idea/${esc(i.id)}">Let’s do it</a>`
      : `<a class="btn primary" href="${esc(directionsUrl(i))}" target="_blank" rel="noopener">Let’s go</a>`;
    $('#result').innerHTML = `<div class="card result-card">
      <p class="otd-label">The wheel says</p>
      ${ideaCard(i).replace('class="card idea-card', 'class="idea-card flat')}
      ${(lastVisit(i) || {}).note ? `<p class="muted small" style="margin-top:6px">Last time: ${esc(lastVisit(i).note)}</p>` : ''}
      <div class="actions">${go}<button class="btn" id="again">Spin again</button></div>
      <button class="btn block" id="skip" style="margin-top:8px">Not this one today</button></div>`;
    $('#again').onclick = spin;
    $('#skip').onclick = () => { skipToday(i.id); build(); $('#result').innerHTML = ''; toast('Hidden for today'); };
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('#spin').onclick = spin;
  $('#home-only').onchange = e => { p.homeOnly = e.target.checked; setPicks(p); $('#result').innerHTML = ''; build(); };
  build();
}

// ---------- one idea ----------
function renderIdea(id) {
  const i = ideaById(id);
  if (!i) { view.innerHTML = `<a class="back" href="#/todo">${ICON.back} Things to do</a><div class="card empty"><p>This idea isn’t here anymore.</p></div>`; return; }
  const link = safeUrl(i.link);
  const visits = [...(i.visits || [])].sort((a, b) => b.date.localeCompare(a.date));
  const hidden = hiddenNow(i);
  const status = hidden
    ? `<div class="card note-card"><p>${i.hide.mode === 'never' ? 'Marked “Not for us.” It won’t show up in Suggestions or the wheel.'
        : `Marked “Not for now.” It comes back to Suggestions around ${esc(Dates.monthLabel(i.hide.until.slice(0, 7)))}.`}</p>
        <button class="btn" id="unhide" style="margin-top:10px">Bring it back now</button></div>`
    : '';

  view.innerHTML = `
    <a class="back" href="#/todo" id="back">${ICON.back} Back</a>
    ${(i.photos || []).length ? `<div class="full-photos">${i.photos.map(p => `<img src="${esc(p.url)}" alt="" loading="lazy" style="aspect-ratio:${p.w || 4}/${p.h || 3}">`).join('')}</div>` : ''}
    <p class="otd-label" style="color:var(--muted)">${esc(catLabel(i.category))}</p>
    <h1 style="font-size:26px">${esc(i.title)}</h1>
    <p class="muted small" style="margin:4px 0 6px">${esc(ideaMeta(i))}</p>
    ${i.lastRating ? `<p>${hearts(i.lastRating, 18)}</p>` : !beenThere(i) ? '<p><span class="tag">Want to try</span></p>' : ''}
    ${i.address ? `<p class="small" style="margin-top:10px">${esc(i.address)}</p>` : ''}
    ${link ? `<p style="margin-top:10px"><a class="small" href="${esc(link)}" target="_blank" rel="noopener">${esc(/tiktok\.com/i.test(link) ? 'Open the TikTok' : 'Open link')}</a></p>` : ''}
    ${i.notes ? `<p class="caption" style="margin-top:12px;white-space:pre-line">${esc(i.notes)}</p>` : ''}
    ${status}

    <div class="actions">
      <a class="btn primary" href="#/idea/${esc(i.id)}/went">We went!</a>
      ${isHome(i) ? '' : `<a class="btn" href="${esc(directionsUrl(i))}" target="_blank" rel="noopener">Directions</a>`}
    </div>

    ${visits.length ? `<p class="section-label">Visits</p>${visits.map(v => visitRow(v)).join('')}` : ''}

    <div class="actions" style="margin-top:28px">
      <a class="btn" href="#/idea/${esc(i.id)}/edit">Edit</a>
      <button class="btn danger" id="del">Delete</button>
    </div>`;

  $('#back').onclick = e => { e.preventDefault(); goBack('#/todo'); };
  const un = $('#unhide');
  if (un) un.onclick = e => busy(e.target, async () => { await DB.patchIdea(i.id, { hide: null }); toast('Back in Suggestions'); });
  $$('[data-remove-visit]').forEach(b => b.onclick = () => confirmBox('Remove this visit?',
    'Photos from it stay on the timeline.', 'Remove', async () => {
      const rest = (i.visits || []).filter(v => v.id !== b.dataset.removeVisit);
      await DB.patchIdea(i.id, { visits: rest, ...ratingPatch(rest, i.hide) });
    }));
  $('#del').onclick = () => confirmBox(`Delete “${i.title}”?`,
    beenThere(i) ? 'Photos from your visits stay on the timeline.' : 'This can’t be undone.',
    'Delete', async () => { await DB.deleteIdea(i); toast('Deleted'); location.hash = '#/todo'; });
}

function visitRow(v) {
  const m = v.momentId && momentById(v.momentId);
  const thumbs = m && (m.photos || []).length
    ? `<a class="visit-photos" href="#/moment/${esc(m.id)}">${m.photos.slice(0, 4).map(p => `<img src="${esc(p.thumbUrl || p.url)}" alt="" loading="lazy">`).join('')}</a>` : '';
  return `<div class="card visit">
    <div class="moment-meta"><span>${esc(Dates.pretty(v.date))}</span><span class="date">${hearts(v.rating)}</span></div>
    ${v.note ? `<p class="caption small" style="margin-top:4px">${esc(v.note)}</p>` : ''}
    ${thumbs}
    <button class="link-btn" data-remove-visit="${esc(v.id)}">Remove visit</button></div>`;
}

// After visits change: latest rated visit decides the rating; a new 3+ clears any hide.
function ratingPatch(visits, currentHide) {
  const rated = [...visits].filter(v => v.rating).sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastRating = rated ? rated.rating : null;
  return { lastRating, hide: lastRating && lastRating >= 3 ? null : currentHide || null };
}

// ---------- shared photo picker (idea form, We went!) ----------
function mountPicker(el, keep, added, onFirstDate) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.hidden = true;
  el.after(input);
  const removed = [];
  function draw() {
    el.innerHTML = [
      ...keep.map((p, n) => `<div class="thumb"><img src="${esc(p.thumbUrl || p.url)}" alt=""><button type="button" class="remove" data-keep="${n}" aria-label="Remove photo">${ICON.x}</button></div>`),
      ...added.map((a, n) => `<div class="thumb"><img src="${esc(a.preview)}" alt=""><button type="button" class="remove" data-add="${n}" aria-label="Remove photo">${ICON.x}</button></div>`),
      `<button type="button" class="add-tile">${ICON.plus}Add photos</button>`,
    ].join('');
    $('.add-tile', el).onclick = () => input.click();
    $$('[data-keep]', el).forEach(b => b.onclick = () => { removed.push(...keep.splice(+b.dataset.keep, 1)); draw(); });
    $$('[data-add]', el).forEach(b => b.onclick = () => { const [a] = added.splice(+b.dataset.add, 1); URL.revokeObjectURL(a.preview); draw(); });
  }
  input.onchange = async () => {
    const files = [...input.files];
    input.value = '';
    for (const file of files) added.push({ file, preview: URL.createObjectURL(file), date: await Photos.takenOn(file) });
    draw();
    const dates = added.map(a => a.date).filter(Boolean).sort();
    if (onFirstDate && dates.length) onFirstDate(dates[0]);
  };
  draw();
  return { removed };
}

async function prepareAll(added, progress) {
  const out = [];
  for (let n = 0; n < added.length; n++) {
    progress.hidden = false;
    progress.textContent = `Getting photo ${n + 1} of ${added.length} ready…`;
    out.push(await Photos.prepare(added[n].file));
  }
  if (out.length) progress.textContent = 'Uploading…';
  return out;
}

// ---------- save / edit an idea ----------
function renderIdeaForm(id) {
  const i = id ? ideaById(id) : null;
  if (id && !i) return renderIdea(id);
  const v = i || { category: '', cost: '', setting: '', length: '' };
  const keep = i ? [...(i.photos || [])] : [], added = [];

  const opt = (name, list, cur) => chipGroup(name, list, cur);
  view.innerHTML = `
    <a class="back" href="${i ? '#/idea/' + esc(i.id) : '#/todo'}">${ICON.back} Cancel</a>
    <h1 style="font-size:26px;margin-bottom:6px">${i ? 'Edit idea' : 'Save idea'}</h1>
    <p class="muted small">Only the name is needed. Fill in the rest now, later, or never.</p>

    <label class="field"><span class="field-label">Name or idea</span>
      <input type="text" id="title" value="${esc(v.title || '')}" placeholder="Sensory bin with rice" autocomplete="off"></label>

    <p class="field-label" style="margin-top:18px">Kind of thing</p>
    ${opt('category', CATEGORIES, v.category)}

    <label class="field"><span class="field-label">Link</span>
      <input type="text" id="link" inputmode="url" value="${esc(v.link || '')}" placeholder="Paste a TikTok or website link" autocomplete="off"></label>

    <div class="field" style="margin-top:18px"><span class="field-label">Photo or screenshot</span><div class="picker" id="picker"></div></div>

    <div id="place-fields">
      <label class="field"><span class="field-label">Address or town</span>
        <input type="text" id="address" value="${esc(v.address || '')}" placeholder="123 Main St, Stafford, VA" autocomplete="off"></label>
      <label class="field"><span class="field-label">Drive time, one way (minutes)</span>
        <input type="text" id="drive" inputmode="numeric" value="${esc(v.drive ?? '')}" placeholder="25" autocomplete="off"></label>
    </div>

    <p class="field-label" style="margin-top:18px">Cost</p>
    ${opt('cost', COSTS, v.cost)}
    <p class="field-label" style="margin-top:18px">Inside or outside</p>
    ${opt('setting', SETTINGS_IO, v.setting)}
    <p class="field-label" style="margin-top:18px">How long</p>
    ${opt('length', LENGTHS, v.length)}

    <label class="field"><span class="field-label">Notes</span>
      <textarea id="notes" rows="3" placeholder="Go before 10, it gets packed">${esc(v.notes || '')}</textarea></label>

    <p class="error" id="err" hidden></p>
    <button class="btn primary block" id="save" style="margin-top:22px">Save</button>
    <p class="progress" id="progress" hidden></p>`;

  // Tapping a selected choice again clears it (all of these are optional).
  const picked = {};
  $$('.chip-wrap').forEach(g => {
    picked[g.dataset.group] = v[g.dataset.group] || '';
    $$('.chip', g).forEach(b => b.onclick = () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      $$('.chip', g).forEach(x => x.setAttribute('aria-pressed', on && x === b));
      picked[g.dataset.group] = on ? b.dataset.v : '';
      if (g.dataset.group === 'category') placeFields();
    });
  });
  const placeFields = () => { $('#place-fields').hidden = picked.category === 'home'; };
  placeFields();
  const pick = mountPicker($('#picker'), keep, added);

  $('#save').onclick = e => {
    const err = $('#err');
    const title = $('#title').value.trim();
    const driveRaw = $('#drive').value.trim();
    const drive = driveRaw === '' ? null : Math.round(Number(driveRaw));
    const problem = !title ? 'Give it a name.' : driveRaw && (!Number.isFinite(drive) || drive < 0) ? 'Drive time should be a number of minutes.' : '';
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    err.hidden = true;
    const home = picked.category === 'home';
    const data = {
      title, category: picked.category, cost: picked.cost, setting: picked.setting, length: picked.length,
      link: $('#link').value.trim(), notes: $('#notes').value.trim(),
      address: home ? '' : $('#address').value.trim(), drive: home ? 0 : drive,
    };
    const progress = $('#progress');
    busy(e.target, async () => {
      const prepared = await prepareAll(added, progress);
      if (i) {
        await DB.updateIdea(i, data, prepared, pick.removed);
        toast('Saved');
        location.hash = `#/idea/${i.id}`;
      } else {
        await DB.addIdea({ ...data, lastRating: null, hide: null }, prepared);
        toast('Saved');
        location.hash = '#/todo';
      }
    }).finally(() => { progress.hidden = true; });
  };
}

// ---------- We went! ----------
function renderWent(id) {
  const i = ideaById(id);
  if (!i) return renderIdea(id);
  const added = [];
  let rating = 0, passMode = 'later';

  view.innerHTML = `
    <a class="back" href="#/idea/${esc(i.id)}">${ICON.back} Cancel</a>
    <h1 style="font-size:26px;margin-bottom:4px">We went!</h1>
    <p class="muted">${esc(i.title)}</p>

    <label class="field"><span class="field-label">When</span>
      <input type="date" id="date" value="${Dates.today()}" max="${Dates.today()}"><p class="hint" id="date-hint"></p></label>

    <div class="field" style="margin-top:18px"><span class="field-label">Photos</span><div class="picker" id="picker"></div>
      <p class="hint">These go on the timeline too.</p></div>

    <div class="field" style="margin-top:18px" id="who-field"><span class="field-label">Who’s in the photos</span>
      <div class="seg" id="who">${whoChips(twins().map(t => t.key))}</div></div>

    <div class="field" style="margin-top:18px"><span class="field-label">How was it? (optional)</span>
      <div class="rate" id="rate">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-r="${n}" aria-label="${n} heart${n === 1 ? '' : 's'}">♥</button>`).join('')}</div>
      <p class="hint" id="rate-hint"></p></div>

    <div class="card note-card" id="pass" hidden>
      <p style="margin-bottom:10px">Take it out of Suggestions and the wheel:</p>
      <div class="seg">${chipGroup('pass', [['later', 'Not for now'], ['never', 'Not for us']], passMode)}</div>
      <p class="hint" id="pass-hint"></p>
    </div>

    <label class="field"><span class="field-label">Quick note (optional)</span>
      <input type="text" id="note" placeholder="Go early · bring towels · too crowded on weekends" autocomplete="off"></label>

    <p class="error" id="err" hidden></p>
    <button class="btn primary block" id="save" style="margin-top:22px">Save visit</button>
    <p class="progress" id="progress" hidden></p>`;

  bindToggles($('#who'));
  let dateTouched = false;
  $('#date').oninput = () => { dateTouched = true; $('#date-hint').textContent = ''; };
  const drawWho = () => { $('#who-field').hidden = !added.length; };
  mountPicker($('#picker'), [], added, d => {
    if (!dateTouched) { $('#date').value = d; $('#date-hint').textContent = 'Date taken from the photo'; }
    drawWho();
  });
  // Removing photos also goes through the picker; re-check after any tap there.
  $('#picker').addEventListener('click', () => setTimeout(drawWho));
  drawWho();

  const HINTS = ['', 'Won’t come up in Suggestions', 'Won’t come up in Suggestions', 'Stays in the mix', 'A favorite: shows up more often', 'A favorite: shows up more often'];
  function drawRate() {
    $$('[data-r]').forEach(b => b.classList.toggle('on', +b.dataset.r <= rating));
    $('#rate-hint').textContent = HINTS[rating];
    $('#pass').hidden = !(rating && rating <= 2);
  }
  $$('[data-r]').forEach(b => b.onclick = () => { rating = rating === +b.dataset.r ? 0 : +b.dataset.r; drawRate(); });
  const passHint = () => { $('#pass-hint').textContent = passMode === 'later' ? 'Comes back in about 6 months.' : 'Hidden until you bring it back.'; };
  $$('[data-group="pass"] .chip').forEach(b => b.onclick = () => {
    passMode = b.dataset.v;
    $$('[data-group="pass"] .chip').forEach(x => x.setAttribute('aria-pressed', x === b));
    passHint();
  });
  passHint();
  drawRate();

  $('#save').onclick = e => {
    const err = $('#err');
    const date = $('#date').value;
    const who = readWho($('#who'));
    const problem = !Dates.valid(date) ? 'Pick a date.' : added.length && !who.length ? 'Pick Will, Millie, or both for the photos.' : '';
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    err.hidden = true;
    const note = $('#note').value.trim();
    const progress = $('#progress');
    busy(e.target, async () => {
      const prepared = await prepareAll(added, progress);
      const momentId = prepared.length
        ? await DB.addMoment({ kind: 'moment', who, date, caption: i.title, ideaId: i.id }, prepared)
        : null;
      const visits = [...(i.visits || []), { id: Math.random().toString(36).slice(2, 10), date, rating: rating || null, note, momentId }];
      const patch = { visits, ...ratingPatch(visits, i.hide) };
      // A low rating on the newest visit hides it the way you chose.
      if (rating && rating <= 2 && patch.lastRating === rating) {
        // Six months from today, even when logging an older visit.
        const until = Dates.parse(Dates.today());
        until.setMonth(until.getMonth() + 6);
        patch.hide = passMode === 'never' ? { mode: 'never' } : { mode: 'later', until: Dates.iso(until) };
      }
      await DB.patchIdea(i.id, patch);
      toast(prepared.length ? 'Saved, and added to the timeline' : 'Saved');
      location.hash = `#/idea/${i.id}`;
    }).finally(() => { progress.hidden = true; });
  };
}

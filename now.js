/* Right Now tab: a snapshot of who each twin is at the moment (favorite
   food, word they say most...), swipe between Will and Millie, with the
   history of every snapshot below.

   A snapshot is a timeline moment with kind 'snapshot', one twin in `who`,
   and `answers: { fieldKey: text }`. Saving twice on the same day updates
   that day's snapshot instead of adding another. Each new snapshot starts
   from the last one, so an update can be a single changed line. */

const DEFAULT_NOW_FIELDS = [
  { key: 'food', label: 'Favorite food' },
  { key: 'book', label: 'Favorite book' },
  { key: 'animal', label: 'Favorite animal' },
  { key: 'toy', label: 'Favorite toy' },
  { key: 'song', label: 'Favorite song or show' },
  { key: 'word', label: 'Word they say most' },
  { key: 'funny', label: 'Funny thing they do' },
  { key: 'skill', label: 'New thing they can do' },
  { key: 'dislike', label: 'Doesn’t like' },
  { key: 'nickname', label: 'Nickname right now' },
];
const nowFields = () => (state.settings.nowFields && state.settings.nowFields.length ? state.settings.nowFields : DEFAULT_NOW_FIELDS);
// Labels for answers whose question was later removed or renamed away.
const fieldLabel = key => (nowFields().find(f => f.key === key) || DEFAULT_NOW_FIELDS.find(f => f.key === key) || { label: key }).label;

// Answers in the same order as the questions (the database stores them
// alphabetically), with any answers to removed questions at the end.
function orderedAnswers(answers = {}) {
  const keys = nowFields().map(f => f.key);
  const rest = Object.keys(answers).filter(k => !keys.includes(k)).sort();
  return [...keys, ...rest].filter(k => answers[k]).map(k => [k, answers[k]]);
}
const sameAnswers = (a = {}, b = {}) => JSON.stringify(orderedAnswers(a)) === JSON.stringify(orderedAnswers(b));

// Newest first.
const snapshotsFor = key => state.moments.filter(m => m.kind === 'snapshot' && (m.who || [])[0] === key);

// The newest photo tagged only this twin (a snapshot photo or a timeline
// moment). Photos of both twins together never become one twin's circle.
function currentPhoto(key) {
  const solo = state.moments.find(m => isOnTimeline(m) && (m.photos || []).length
    && (m.who || []).length === 1 && m.who[0] === key);
  return solo ? solo.photos[0] : null;
}

// What changed in each snapshot compared with the one before it.
function changes(key) {
  const list = snapshotsFor(key);
  return list.map((m, n) => {
    const prev = (list[n + 1] || {}).answers || {};
    const cur = m.answers || {};
    const keys = orderedAnswers({ ...prev, ...cur }).map(([k]) => k);
    const diff = keys.filter(k => (cur[k] || '') !== (prev[k] || '') && cur[k]).map(k => ({ k, now: cur[k], was: prev[k] || '' }));
    return { m, diff, first: n === list.length - 1 };
  });
}

// ---------- the tab ----------
function renderNow() {
  if (!state.nowTwin || !twins().some(t => t.key === state.nowTwin)) state.nowTwin = twins()[0].key;
  const view$ = state.nowView || 'date';

  const panel = t => {
    const snap = snapshotsFor(t.key)[0];
    const answers = (snap && snap.answers) || {};
    const photo = currentPhoto(t.key);
    const filled = nowFields().filter(f => answers[f.key]);
    return `<section class="now-panel" data-twin="${t.key}">
      <div class="now-card ${t.key}">
        <div class="now-top">
          ${photo ? `<button type="button" class="now-photo-btn" data-crop="${t.key}" aria-label="Adjust ${esc(t.name)}’s photo"><span class="now-photo">${circleImg(t.key, photo)}</span><span class="crop-badge">${ICON.crop}</span></button>`
            : `<div class="now-photo"><span>${esc(t.name[0])}</span></div>`}
          <div><h2>${esc(t.name)}</h2><p class="muted small">${esc(ageOn(Dates.today()))}</p>
            ${snap ? `<p class="muted small">As of ${esc(Dates.short(snap.date))}</p>` : ''}</div>
        </div>
        ${filled.length ? `<dl class="answers">${filled.map(f => `<div><dt>${esc(f.label)}</dt><dd>${esc(answers[f.key])}</dd></div>`).join('')}</dl>`
          : `<p class="muted" style="margin:14px 0 4px">What’s ${esc(t.name)} into these days? Fill in as much or as little as you like.</p>`}
        <a class="row-link words-link" href="#/words/${t.key}"><span>${ICON.chat} ${esc(wordsLine(t.key))}</span>${ICON.chevronRight}</a>
        <a class="btn primary block" href="#/now/${t.key}/edit" style="margin-top:14px">${snap ? 'Update' : 'Start'} ${esc(t.name)}’s snapshot</a>
      </div>
    </section>`;
  };

  view.innerHTML = `
    <div class="page-head"><h1>Right Now</h1><a class="icon-btn plain" href="#/now/questions" aria-label="Change the questions">${ICON.gear}</a></div>
    <div class="seg now-switch" role="tablist">${twins().map(t =>
      `<button type="button" class="chip ${t.key}" data-go="${t.key}" role="tab" aria-pressed="${state.nowTwin === t.key}">${esc(t.name)}</button>`).join('')}</div>
    <div class="now-swipe" id="swipe">${twins().map(panel).join('')}</div>
    <div class="list-head" style="margin-top:26px">
      <h2 style="font-size:20px" id="hist-title"></h2>
      <div class="seg mini">
        <button type="button" class="chip" data-hv="date" aria-pressed="${view$ === 'date'}">By date</button>
        <button type="button" class="chip" data-hv="field" aria-pressed="${view$ === 'field'}">By question</button>
      </div>
    </div>
    <div id="history"></div>`;

  const swipe = $('#swipe');
  const index = () => twins().findIndex(t => t.key === state.nowTwin);
  // Jump (no animation) to the twin you were last on.
  requestAnimationFrame(() => { swipe.scrollLeft = index() * swipe.clientWidth; });

  // The row is only as tall as the twin showing, so there's no gap under a shorter card.
  const fitHeight = () => {
    const panel = $$('.now-panel', swipe)[index()];
    if (panel) swipe.style.height = panel.offsetHeight + 'px';
  };

  function drawHistory() {
    const t = twins()[index()];
    fitHeight();
    $('#hist-title').textContent = `${t.name}’s history`;
    $$('[data-go]').forEach(b => b.setAttribute('aria-pressed', b.dataset.go === t.key));
    const rows = changes(t.key);
    if (!rows.length) { $('#history').innerHTML = `<div class="card empty"><p>Each snapshot you save shows up here, so you can see how ${esc(t.name)} changes.</p></div>`; return; }
    if ((state.nowView || 'date') === 'date') {
      $('#history').innerHTML = rows.map(({ m, diff, first }) => `<a class="card snap-row" href="#/moment/${esc(m.id)}">
        <div class="moment-meta"><span>${esc(Dates.pretty(m.date))}</span><span class="date">${esc(ageOn(m.date, true))}</span></div>
        ${diff.length ? `<ul class="diffs">${diff.map(d => `<li><span class="muted">${esc(fieldLabel(d.k))}:</span> ${esc(d.now)}${!first && d.was ? ` <span class="was">was ${esc(d.was)}</span>` : ''}</li>`).join('')}</ul>`
          : '<p class="muted small" style="margin-top:4px">New photo</p>'}</a>`).join('');
    } else {
      // Each question, with every different answer over time (oldest to newest).
      const byField = nowFields().map(f => {
        const seen = [];
        [...snapshotsFor(t.key)].reverse().forEach(m => {
          const v = (m.answers || {})[f.key];
          if (v && (!seen.length || seen[seen.length - 1].v !== v)) seen.push({ v, date: m.date });
        });
        return { f, seen };
      }).filter(x => x.seen.length);
      $('#history').innerHTML = byField.map(({ f, seen }) => `<div class="card">
        <p class="muted small">${esc(f.label)}</p>
        <p class="evolve">${seen.map((s, n) => `<span${n === seen.length - 1 ? ' class="latest"' : ''}>${esc(s.v)} <small>${esc(Dates.parse(s.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }))}</small></span>`).join('<span class="arrow">→</span>')}</p>
      </div>`).join('') || `<div class="card empty"><p>Nothing yet.</p></div>`;
    }
  }

  let settle;
  swipe.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      const n = Math.round(swipe.scrollLeft / swipe.clientWidth);
      const key = (twins()[n] || {}).key;
      if (key && key !== state.nowTwin) { state.nowTwin = key; drawHistory(); }
    }, 80);
  });
  $$('[data-go]').forEach(b => b.onclick = () => {
    state.nowTwin = b.dataset.go;
    swipe.scrollTo({ left: index() * swipe.clientWidth, behavior: 'smooth' });
    drawHistory();
  });
  $$('[data-crop]').forEach(b => b.onclick = () => openCrop(b.dataset.crop));
  $$('[data-hv]').forEach(b => b.onclick = () => {
    state.nowView = b.dataset.hv;
    $$('[data-hv]').forEach(x => x.setAttribute('aria-pressed', x === b));
    drawHistory();
  });
  drawHistory();
}

// ---------- update a snapshot ----------
function renderNowForm(key) {
  const t = twins().find(x => x.key === key);
  if (!t) { location.hash = '#/now'; return; }
  const today = Dates.today();
  const last = snapshotsFor(key)[0];
  const todays = last && last.date === today ? last : null;
  const start = (last && last.answers) || {};
  const keep = todays ? [...(todays.photos || [])] : [], added = [];

  view.innerHTML = `
    <a class="back" href="#/now">${ICON.back} Cancel</a>
    <h1 style="font-size:26px;margin-bottom:4px">${esc(t.name)} right now</h1>
    <p class="muted small">${last ? 'Filled in from last time. Change what’s different, skip the rest.' : 'Answer whatever you like. Blank is fine.'}</p>
    ${nowFields().map(f => `<label class="field"><span class="field-label">${esc(f.label)}</span>
      <input type="text" data-a="${esc(f.key)}" value="${esc(start[f.key] || '')}" autocomplete="off"></label>`).join('')}
    <div class="field" style="margin-top:18px"><span class="field-label">Current photo (optional)</span><div class="picker" id="picker"></div>
      <p class="hint">Skip it and Right Now uses the newest photo tagged just them.</p></div>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" id="save" style="margin-top:22px">Save</button>
    <p class="progress" id="progress" hidden></p>
    <p class="hint" style="text-align:center;margin-top:10px"><a href="#/now/questions">Change these questions</a></p>`;

  const pick = mountPicker($('#picker'), keep, added);

  $('#save').onclick = e => {
    const answers = {};
    // Carry over answers to questions that aren't shown anymore.
    Object.entries(start).forEach(([k, v]) => { if (!nowFields().some(f => f.key === k) && v) answers[k] = v; });
    $$('[data-a]').forEach(i => { const v = i.value.trim(); if (v) answers[i.dataset.a] = v; });
    const same = sameAnswers(answers, start) && !added.length && !pick.removed.length;
    if (same) { toast('Nothing changed'); location.hash = '#/now'; return; }
    const progress = $('#progress');
    busy(e.target, async () => {
      const prepared = await prepareAll(added, progress);
      const data = { kind: 'snapshot', who: [key], date: today, caption: '', answers };
      if (todays) await DB.updateMoment(todays, data, prepared, pick.removed);
      else await DB.addMoment(data, prepared);
      state.nowTwin = key;
      toast('Saved, and added to the timeline');
      location.hash = '#/now';
    }).finally(() => { progress.hidden = true; });
  };
}

// Short summary for timeline cards: what changed (or everything, the first time).
function snapshotSummary(m, max = 4) {
  const key = (m.who || [])[0];
  const row = changes(key).find(r => r.m.id === m.id);
  const items = row && row.diff.length ? row.diff : orderedAnswers(m.answers).map(([k, v]) => ({ k, now: v }));
  const shown = items.slice(0, max);
  return `<ul class="diffs">${shown.map(d => `<li><span class="muted">${esc(fieldLabel(d.k))}:</span> ${esc(d.now)}</li>`).join('')}
    ${items.length > max ? `<li class="muted">+${items.length - max} more</li>` : ''}</ul>`;
}

// ---------- the circle photo ----------
// How the photo sits in the circle: x/y = which part is centered (0-100%),
// zoom = how far in. Saved per twin; a new photo starts centered again.
const photoId = p => p.path || p.url;
function cropFor(key, photo) {
  const c = (state.settings.nowCrop || {})[key];
  return c && c.src === photoId(photo) ? c : { x: 50, y: 50, zoom: 1 };
}
const cropStyle = c => `object-position:${c.x}% ${c.y}%;transform:scale(${c.zoom});transform-origin:${c.x}% ${c.y}%`;
const circleImg = (key, photo) => `<img src="${esc(photo.thumbUrl || photo.url)}" alt="" style="${cropStyle(cropFor(key, photo))}">`;

function openCrop(key) {
  const photo = currentPhoto(key);
  if (!photo) return;
  const c = { ...cropFor(key, photo) };
  openModal(`<h2>Adjust the circle</h2>
    <p>Drag the photo to move it. Use the slider to zoom.</p>
    <div class="crop-circle" id="cc"><img src="${esc(photo.url)}" alt="" draggable="false"></div>
    <label class="crop-zoom"><span class="muted small">Zoom</span><input type="range" id="cz" min="1" max="3" step="0.05" value="${c.zoom}"></label>
    <div class="actions"><button class="btn" id="creset">Reset</button><button class="btn primary" id="csave">Save</button></div>
    <p class="hint" style="text-align:center;margin-top:10px">Want a different photo? Add one when you update the snapshot.</p>`,
  (root, close) => {
    const circle = $('#cc', root), img = $('img', circle);
    const draw = () => { img.style.cssText = cropStyle(c); $('#cz', root).value = c.zoom; };
    draw();
    let drag = null;
    circle.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y }; circle.setPointerCapture(e.pointerId); });
    circle.addEventListener('pointermove', e => {
      if (!drag) return;
      // Dragging right shows more of the left side, so the center point moves the other way.
      const k = 100 / (circle.clientWidth * c.zoom);
      c.x = Math.min(100, Math.max(0, drag.cx - (e.clientX - drag.x) * k));
      c.y = Math.min(100, Math.max(0, drag.cy - (e.clientY - drag.y) * k));
      draw();
    });
    const end = () => { drag = null; };
    circle.addEventListener('pointerup', end);
    circle.addEventListener('pointercancel', end);
    $('#cz', root).oninput = e => { c.zoom = Number(e.target.value); draw(); };
    $('#creset', root).onclick = () => { Object.assign(c, { x: 50, y: 50, zoom: 1 }); draw(); };
    $('#csave', root).onclick = e => busy(e.target, async () => {
      const nowCrop = { ...(state.settings.nowCrop || {}), [key]: { src: photoId(photo), x: Math.round(c.x), y: Math.round(c.y), zoom: Math.round(c.zoom * 100) / 100 } };
      await DB.saveSettings({ nowCrop });
      state.settings = { ...state.settings, nowCrop };
      close();
      renderNow();
    });
  });
}

// ---------- the questions ----------
// Keys stay fixed, so renaming a question keeps its history together.
// Drag the handle on the left to reorder.
function renderNowQuestions() {
  const fields = nowFields().map(f => ({ ...f }));
  view.innerHTML = `
    <a class="back" href="#/now">${ICON.back} Right Now</a>
    <h1 style="font-size:26px;margin-bottom:4px">Questions</h1>
    <p class="muted small">What each snapshot asks. Drag ${ICON.grip.replace('class="icon"', 'class="icon" style="width:14px;height:14px;vertical-align:-2px"')} to reorder, tap to rename, or remove. Answers you already saved are kept.</p>
    <div id="nf" style="margin-top:12px"></div>
    <button type="button" class="btn block" id="nf-add" style="margin-top:10px">${ICON.plus} Add a question</button>
    <button type="button" class="link-btn" id="nf-reset" style="display:block;margin:14px auto 0">Go back to the starting questions</button>
    <button class="btn primary block" id="save" style="margin-top:20px">Save</button>`;

  const draw = () => {
    $('#nf').innerHTML = fields.map((f, n) => `<div class="nf-row" data-row="${n}">
      <span class="grip" data-grip="${n}" aria-label="Drag to reorder">${ICON.grip}</span>
      <input type="text" data-nf="${n}" value="${esc(f.label)}" placeholder="Favorite playground" autocomplete="off" aria-label="Question ${n + 1}">
      <button type="button" class="icon-btn" data-nf-del="${n}" aria-label="Remove question">${ICON.x}</button></div>`).join('');
    $$('[data-nf]').forEach(i => i.oninput = () => { fields[+i.dataset.nf].label = i.value; });
    $$('[data-nf-del]').forEach(b => b.onclick = () => { fields.splice(+b.dataset.nfDel, 1); draw(); });
    $$('[data-grip]').forEach(g => g.addEventListener('pointerdown', startDrag));
  };

  // Touch-friendly drag: the row follows your finger, and the others make room.
  function startDrag(e) {
    e.preventDefault();
    const handle = e.currentTarget;
    const from = +handle.dataset.grip;
    const rows = $$('.nf-row');
    const row = rows[from];
    const h = row.offsetHeight + 6;
    const startY = e.clientY;
    let to = from;
    row.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const dy = ev.clientY - startY;
      row.style.transform = `translateY(${dy}px)`;
      to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h)));
      rows.forEach((r, n) => {
        if (n === from) return;
        const shift = from < to && n > from && n <= to ? -h : from > to && n < from && n >= to ? h : 0;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      const [f] = fields.splice(from, 1);
      fields.splice(to, 0, f);
      draw();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  draw();
  $('#nf-add').onclick = () => {
    fields.push({ key: 'q' + Date.now().toString(36), label: '' });
    draw();
    $$('[data-nf]').pop().focus();
  };
  $('#nf-reset').onclick = () => { fields.splice(0, fields.length, ...DEFAULT_NOW_FIELDS.map(f => ({ ...f }))); draw(); };
  $('#save').onclick = e => busy(e.target, async () => {
    const nowFieldsList = fields.map(f => ({ key: f.key, label: f.label.trim() })).filter(f => f.label);
    await DB.saveSettings({ nowFields: nowFieldsList });
    state.settings = { ...state.settings, nowFields: nowFieldsList };
    toast('Saved');
    location.hash = '#/now';
  });
}

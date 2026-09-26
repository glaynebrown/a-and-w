/* Words: a running list of each twin's words, reached from Right Now.

   One timeline moment per twin holds the list (kind 'wordlist', never shown
   itself): words: [{ w, date, early, note, t }].
     early  pasted from an old list: said "before" that date, exact day unknown
     t      when it was added, to keep same-day words in order

   Milestone cards (50th, 100th word...) are worked out from the list and
   shown on the timeline. They're only made for words with a real date, so
   pasting in an old list doesn't create milestones on the paste day. */

const WORD_MILESTONES = [50, 100, 150, 200, 300, 400, 500, 750, 1000];

const wordListDoc = key => state.moments.find(m => m.kind === 'wordlist' && (m.who || [])[0] === key);
// Oldest first: pasted-in early words, then everything else by date.
function wordsInOrder(key) {
  const doc = wordListDoc(key);
  return [...((doc && doc.words) || [])].sort((a, b) =>
    (b.early - a.early) || (a.early ? a.t - b.t : a.date.localeCompare(b.date) || a.t - b.t));
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

// Timeline cards for word milestones (not stored; rebuilt from the lists).
function wordMilestones() {
  return twins().flatMap(t => {
    const list = wordsInOrder(t.key);
    return WORD_MILESTONES.filter(n => list.length >= n && !list[n - 1].early).map(n => ({
      id: `words-${t.key}-${n}`, kind: 'words', who: [t.key], date: list[n - 1].date, n, word: list[n - 1].w, photos: [],
    }));
  });
}

function wordsLine(key) {
  const list = wordsInOrder(key);
  if (!list.length) return 'Start a word list';
  return `Words: ${list.length} · newest: ${list[list.length - 1].w}`;
}

// "Milk, ball\n1. doggy\n- uh oh" -> ['Milk', 'ball', 'doggy', 'uh oh']
function splitWords(text) {
  return String(text)
    .split(/[\n,;•]+/)
    .map(w => w.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

async function saveWords(key, words) {
  const doc = wordListDoc(key);
  if (doc) await DB.updateMoment(doc, { words }, [], []);
  else await DB.addMoment({ kind: 'wordlist', who: [key], date: Dates.today(), caption: '', words }, []);
}

// Adds words (skipping ones already on the list). Returns { added, dupes }.
async function addWords(key, raw, early) {
  const current = [...((wordListDoc(key) || {}).words || [])];
  const have = new Set(current.map(x => x.w.toLowerCase()));
  const today = Dates.today();
  let t = Date.now(), added = 0, dupes = 0;
  const before = wordsInOrder(key).length;
  for (const w of raw) {
    if (have.has(w.toLowerCase())) { dupes++; continue; }
    have.add(w.toLowerCase());
    current.push({ w, date: today, early: !!early, note: '', t: t++ });
    added++;
  }
  if (added) await saveWords(key, current);
  const after = before + added;
  const hit = !early && WORD_MILESTONES.filter(n => n > before && n <= after).pop();
  return { added, dupes, hit };
}

// ---------- the page ----------
function renderWords(key) {
  const t = twins().find(x => x.key === key);
  if (!t) { location.replace('#/now'); return; }
  const list = wordsInOrder(key);
  const newestFirst = [...list].reverse();
  const nextMilestone = WORD_MILESTONES.find(n => n > list.length);

  view.innerHTML = `
    <a class="back" href="#/now">${ICON.back} Right Now</a>
    <div class="words-head ${t.key}">
      <div><h1>${esc(t.name)}’s words</h1>
        <p class="muted small">${nextMilestone ? `${nextMilestone - list.length} more to ${nextMilestone}` : 'Wow.'}</p></div>
      <p class="word-count">${list.length}</p>
    </div>

    <div class="card">
      <div class="word-add">
        <input type="text" id="w" placeholder="New word" autocomplete="off" autocapitalize="off" enterkeyhint="done">
        <button class="btn primary" id="add">Add</button>
      </div>
      <p class="hint">Dated today. Add a few at once with commas.</p>
      <button type="button" class="link-btn" id="paste-open" style="margin-top:10px">Paste a list from Notes</button>
      <div id="paste" hidden>
        <textarea id="pasted" rows="6" placeholder="mama, dada, ball, uh oh…" style="margin-top:10px"></textarea>
        <p class="hint">One per line or separated by commas. Numbers and bullets are ignored, and words already on the list are skipped.</p>
        <label class="switch" style="margin-top:8px"><input type="checkbox" id="early" checked><span>These are older words (said before today)</span></label>
        <button class="btn block" id="paste-add" style="margin-top:10px">Add these words</button>
      </div>
    </div>

    ${newestFirst.length ? `<p class="section-label">Newest first</p>
      <div class="card word-list">${newestFirst.map(x => `<button type="button" class="word-row" data-t="${x.t}">
        <span class="word">${esc(x.w)}</span>
        <span class="muted small">${x.early ? `before ${esc(Dates.short(x.date))}, ${x.date.slice(0, 4)}` : esc(Dates.short(x.date))}</span>
        ${x.note ? `<span class="word-note">${esc(x.note)}</span>` : ''}</button>`).join('')}</div>`
      : `<div class="card empty" style="margin-top:12px"><p>Add ${esc(t.name)}’s words as you hear them, or paste the list you’ve been keeping.</p></div>`}`;

  const quick = () => {
    const raw = splitWords($('#w').value);
    if (!raw.length) { $('#w').focus(); return; }
    busy($('#add'), async () => {
      const r = await addWords(key, raw, false);
      if (r.hit) toast(`${t.name}’s ${ordinal(r.hit)} word! It’s on the timeline.`);
      else if (!r.added) toast(raw.length === 1 ? 'Already on the list' : 'Those are already on the list');
      else toast(`Added${r.dupes ? ` (${r.dupes} already there)` : ''}`);
      renderWords(key);
      $('#w').focus();
    });
  };
  $('#add').onclick = quick;
  $('#w').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); quick(); } };

  $('#paste-open').onclick = () => { $('#paste').hidden = false; $('#paste-open').hidden = true; $('#pasted').focus(); };
  $('#paste-add').onclick = e => {
    const raw = splitWords($('#pasted').value);
    if (!raw.length) { toast('Paste some words first', true); return; }
    busy(e.target, async () => {
      const r = await addWords(key, raw, $('#early').checked);
      toast(`Added ${r.added} word${r.added === 1 ? '' : 's'}${r.dupes ? ` · ${r.dupes} already there` : ''}`);
      if (r.hit) setTimeout(() => toast(`${t.name}’s ${ordinal(r.hit)} word! It’s on the timeline.`), 2600);
      renderWords(key);
    }, 'Adding…');
  };

  $$('.word-row').forEach(b => b.onclick = () => editWord(key, +b.dataset.t));
}

function editWord(key, t) {
  const doc = wordListDoc(key);
  const x = doc && doc.words.find(w => w.t === t);
  if (!x) return;
  openModal(`<h2>Edit word</h2>
    <label class="field"><span class="field-label">Word</span><input type="text" id="ew" value="${esc(x.w)}" autocomplete="off" autocapitalize="off"></label>
    <label class="field"><span class="field-label">${x.early ? 'Said before' : 'First said'}</span><input type="date" id="ed" value="${esc(x.date)}" max="${Dates.today()}"></label>
    <label class="field"><span class="field-label">Note (optional)</span><input type="text" id="en" value="${esc(x.note || '')}" placeholder="Says “nana” for banana" autocomplete="off"></label>
    <div class="actions"><button class="btn danger" id="edel">Remove</button><button class="btn primary" id="esave">Save</button></div>`,
  (root, close) => {
    $('#esave', root).onclick = e => {
      const w = $('#ew', root).value.trim(), date = $('#ed', root).value;
      if (!w || !Dates.valid(date)) { toast('Needs a word and a date', true); return; }
      busy(e.target, async () => {
        // Setting a real date on an older word makes it a normal dated word.
        const words = doc.words.map(y => y.t === t ? { ...y, w, date, note: $('#en', root).value.trim(), early: y.early && date === y.date } : y);
        await saveWords(key, words);
        close();
        renderWords(key);
      });
    };
    $('#edel', root).onclick = e => busy(e.target, async () => {
      await saveWords(key, doc.words.filter(y => y.t !== t));
      close();
      renderWords(key);
    }, 'Removing…');
  });
}

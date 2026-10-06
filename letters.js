/* Letters tab: dated letters to each twin, shown as sealed envelopes, written
   on stationery. They open each twin's book and never appear on the timeline.

   Stored as timeline moments so they sync and back up with everything else:
     { kind: 'letter', caption: text, who: [twin, ...], date } */

// A letter can be to more than one; it's in each of their lists (and books).
const lettersTo = key => state.moments.filter(m => m.kind === 'letter' && (m.who || []).includes(key));

function renderLetters() {
  const all = state.moments.filter(m => m.kind === 'letter');
  view.innerHTML = `
    <div class="page-head"><h1>Letters</h1></div>
    <a class="write-letter" href="#/letter/new">${DIVIDER}<span>Write a letter</span>${QUILL}</a>
    ${all.length ? `<div class="envelopes">${all.map(l => `<a class="env-link" href="#/letter/${esc(l.id)}">
      ${envelope(l.who)}<span class="env-name">${esc(letterNames(l.who))}</span><span class="env-date">${esc(Dates.short(l.date))}, ${l.date.slice(0, 4)}</span></a>`).join('')}</div>`
      : ''}`;
}

// A little divider: a line, a sage dot and a blush dot, a line.
const DIVIDER = `<svg width="120" height="14" viewBox="0 0 120 14" aria-hidden="true"><path d="M0 7h46M74 7h46" style="stroke:var(--sand)"/>
  <circle cx="54" cy="7" r="3" style="fill:var(--sage)"/><circle cx="66" cy="7" r="3" style="fill:var(--blush)"/></svg>`;

// Letters use their full names (William, Amelia) and those initials on the seal.
const letterName = key => { const t = twins().find(x => x.key === key); return t ? (t.fullName || t.name) : key; };

// Who a letter is to, in family order: "William", "William & Amelia",
// "Ava, Leo & June" (or with "and" for the Dear line).
const inFamilyOrder = who => twins().map(t => t.key).filter(k => [].concat(who || []).includes(k));
function letterNames(who, and = '&') {
  const n = inFamilyOrder(who).map(letterName);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} ${and} ${n[n.length - 1]}` : (n[0] || '');
}

// A watercolor quill writing a line that ends in a little loop (the line is
// light in dark mode). Made from the user's drawing by art/make-quill.py.
const QUILL = '<span class="quill"><img class="quill-light" src="quill.png" alt=""><img class="quill-dark" src="quill-dark.png" alt=""></span>';

// The envelope: the user's painted envelope with its seal lifted off
// (envelope.jpg), and on top the wax seal in the twin's color with their
// initial pressed in (seal-<color>.png). Made by art/make-envelope.py.
const sealColor = key => ({ will: 'sage', millie: 'blush' }[key] || 'sage');
// One child: their color and initial. More than one: a gold seal with a heart
// pressed in (their names are written under the envelope).
const SEAL_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z"/></svg>';
function envelope(who, cls = '') {
  const keys = inFamilyOrder(who);
  const many = keys.length > 1;
  const mark = many ? SEAL_HEART : esc((letterName(keys[0]) || '?')[0]);
  return `<span class="envelope ${cls}" aria-hidden="true"><img class="env-paper" src="envelope.jpg" alt="">
    <span class="env-seal"><img src="seal-${many ? 'gold' : sealColor(keys[0])}.png" alt=""><span class="env-initial${many ? ' heart' : ''}">${mark}</span></span></span>`;
}

// The stationery's corners: a line-drawn sprig of baby's breath, top left and
// (turned around) bottom right. The same drawing is on letter pages in the PDF books.
const PAPER_CORNERS = '<img class="corner" src="paper-branch.png" alt=""><img class="corner br" src="paper-branch-br.png" alt="">';
const longDate = s => Dates.parse(s).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

// Routes: #/letter/new, #/letter/ID (read), #/letter/ID/edit
function renderLetter(id, sub) {
  if (id === 'new' || sub === 'edit') return renderLetterForm(id === 'new' ? null : id);
  const m = momentById(id);
  if (!m || m.kind !== 'letter') { location.replace('#/letters'); return; }
  const name = letterNames(m.who, 'and');
  const body = m.caption.replace(/^\s*dear\s+[^,\n]*,?\s*/i, '');
  view.innerHTML = `
    <a class="back" href="#/letters">${ICON.back} Letters</a>
    <article class="paper">
      ${PAPER_CORNERS}
      <p class="paper-date">${esc(longDate(m.date))}</p>
      <p class="paper-dear">Dear ${esc(name)},</p>
      <div class="paper-text">${esc(body)}</div>
    </article>
    <p style="text-align:center;margin-top:14px"><a class="small muted" href="#/letter/${esc(m.id)}/edit">Edit</a></p>`;
}

function renderLetterForm(id) {
  const m = id ? momentById(id) : null;
  if (id && (!m || m.kind !== 'letter')) { location.replace('#/letters'); return; }
  let to = m ? inFamilyOrder(m.who) : [];
  const body = m ? m.caption.replace(/^\s*dear\s+[^,\n]*,?\s*/i, '') : '';
  view.innerHTML = `
    <a class="back" href="${m ? '#/letter/' + esc(m.id) : '#/letters'}">${ICON.back} ${m ? 'Back' : 'Letters'}</a>
    <div class="paper">
      ${PAPER_CORNERS}
      <label class="paper-date date-tap"><span id="date-text">${esc(longDate(m ? m.date : Dates.today()))}</span>
        <input type="date" id="date" value="${esc(m ? m.date : Dates.today())}" max="${Dates.today()}" aria-label="Date"></label>
      <p class="paper-dear">Dear ${twins().map(t => `<button type="button" class="dear-name ${t.key}" data-to="${t.key}" aria-pressed="${to.includes(t.key)}">${esc(letterName(t.key))}</button>`).join(' ')},</p>
      <textarea id="letter" class="paper-lines" aria-label="Your letter">${esc(body)}</textarea>
    </div>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" id="save" style="margin-top:16px">${m ? 'Save' : 'Seal letter'}</button>
    ${m ? '<button type="button" class="link-btn" id="del" style="display:block;margin:16px auto 0">Delete this letter</button>' : ''}`;

  // Tap names to add or take them off; a letter can be to one child or several.
  const pickTo = key => {
    to = to.includes(key) ? to.filter(k => k !== key) : inFamilyOrder([...to, key]);
    $$('[data-to]').forEach(b => b.setAttribute('aria-pressed', to.includes(b.dataset.to)));
    $('#err').hidden = true;
  };
  $$('[data-to]').forEach(b => b.onclick = () => pickTo(b.dataset.to));
  $('#date').oninput = e => { if (Dates.valid(e.target.value)) $('#date-text').textContent = longDate(e.target.value); };

  $('#save').onclick = e => {
    const text = $('#letter').value.trim(), date = $('#date').value, err = $('#err');
    const problem = !to.length ? 'Tap one or both names next to “Dear.”' : !text ? 'Write something first.' : !Dates.valid(date) ? 'Pick a date.' : '';
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    busy(e.target, async () => {
      if (m) {
        await DB.updateMoment(m, { caption: text, date, who: to }, [], []);
        toast('Saved');
        goBack(`#/letter/${m.id}`);
      } else {
        await DB.addMoment({ kind: 'letter', who: to, date, caption: text }, []);
        await sealFlourish(to);
        goBack('#/letters');
      }
    }, m ? 'Saving…' : 'Sealing…');
  };
  if (m) $('#del').onclick = () => confirmBox('Delete this letter?', 'This can’t be undone.', 'Delete',
    async () => { await DB.deleteMoment(m); toast('Deleted'); goBack('#/letters', 2); });
}

// The envelope floats in and the wax seal stamps down. Skipped if the phone asks for less motion.
function sealFlourish(who) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { toast('Sealed'); return Promise.resolve(); }
  const el = document.createElement('div');
  el.className = 'seal-overlay';
  el.innerHTML = `<div class="seal-stage">${envelope(who, 'sealing')}<p>Sealed for ${esc(letterNames(who))}</p></div>`;
  document.body.appendChild(el);
  // Hand back while the envelope still covers the screen, so the Letters page
  // is drawn underneath first; then the envelope fades away over it (instead
  // of uncovering the writing page for a moment).
  return new Promise(resolve => setTimeout(() => {
    resolve();
    setTimeout(() => {
      el.classList.add('done');
      setTimeout(() => el.remove(), 350);
    }, 150);
  }, 1900));
}

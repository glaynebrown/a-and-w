/* Letters tab: dated letters to each twin, shown as sealed envelopes, written
   on stationery. They open each twin's book and never appear on the timeline.

   Stored as timeline moments so they sync and back up with everything else:
     { kind: 'letter', caption: text, who: [twin], date } */

const lettersTo = key => state.moments.filter(m => m.kind === 'letter' && (m.who || [])[0] === key);

function renderLetters() {
  const all = state.moments.filter(m => m.kind === 'letter');
  view.innerHTML = `
    <div class="page-head"><h1>Letters</h1></div>
    <a class="write-letter" href="#/letter/new">${DIVIDER}<span>Write a letter</span>${QUILL}</a>
    ${all.length ? `<div class="envelopes">${all.map(l => `<a class="env-link" href="#/letter/${esc(l.id)}">
      ${envelope(l.who[0])}<span class="env-name">${esc(letterName(l.who[0]))}</span><span class="env-date">${esc(Dates.short(l.date))}, ${l.date.slice(0, 4)}</span></a>`).join('')}</div>`
      : `<p class="muted small" style="text-align:center;margin-top:4px">Birthdays are a nice time for one.</p>`}
    ${ENVELOPE_DEFS}`;
}

// A little divider: a line, a sage dot and a blush dot, a line.
const DIVIDER = `<svg width="120" height="14" viewBox="0 0 120 14" aria-hidden="true"><path d="M0 7h46M74 7h46" style="stroke:var(--sand)"/>
  <circle cx="54" cy="7" r="3" style="fill:var(--sage)"/><circle cx="66" cy="7" r="3" style="fill:var(--blush)"/></svg>`;

// Letters use their full names (William, Amelia) and those initials on the seal.
const letterName = key => { const t = twins().find(x => x.key === key); return t ? (t.fullName || t.name) : key; };

// A solid feather quill writing a line that ends in a little loop.
const QUILL = `<svg class="quill" width="64" height="40" viewBox="0 0 64 40" aria-hidden="true">
  <path d="M15.5 26.5C19 16 34 7 61 3.5C54 9.5 47 14.5 38.5 18.5L40 20.5C34 23 28.5 25 23.5 26.5L24.5 28.5C21 29.3 18.5 29.2 16.5 28.8Z" style="fill:var(--text)"/>
  <path d="M25 16.2l2.6 2M33.5 11.2l2.4 2.3M43 7.2l2 2.2" style="fill:none;stroke:var(--bg);stroke-width:1.1;stroke-linecap:round"/>
  <path d="M17 28Q35 16.5 58.5 5" style="fill:none;stroke:var(--bg);stroke-width:.7;stroke-linecap:round"/>
  <path d="M16.3 26.6l2.6 2.4-1.2 1.3-2.6-2.4z" style="fill:var(--text)"/>
  <path d="M15.4 28.3l1.9 1.8-8.6 6.9-.4-.4z" style="fill:var(--text)"/>
  <path d="M15.7 29.5 11 33.4" style="stroke:var(--bg);stroke-width:.5"/>
  <path d="M8.5 37C20 37.6 34 37.4 46 36.6C54 36 57 33 53.5 32.2C50 31.5 49 36 58 36.8" style="fill:none;stroke:var(--text);stroke-width:1;stroke-linecap:round"/>
</svg>`;

const WAX = { will: ['#9fb897', '#6f8c68', '#4f6a49'], millie: ['#dc9a8a', '#b86a5a', '#8f4d40'] };

// Shared paper texture, shading and wax colors (drawn once per page).
const ENVELOPE_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="wc" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3"/>
  </filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/>
    <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.10 0"/>
    <feComposite in2="SourceGraphic" operator="in"/></filter>
  <radialGradient id="paper" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#fdf9f1"/><stop offset=".7" stop-color="#f5ecdc"/><stop offset="1" stop-color="#e2cfb2"/></radialGradient>
  <linearGradient id="flap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f0e2"/><stop offset="1" stop-color="#ecdfc9"/></linearGradient>
  ${Object.entries(WAX).map(([k, [a, b, c]]) => `<radialGradient id="wax-${k}" cx="40%" cy="35%" r="70%">
    <stop offset="0" stop-color="${a}"/><stop offset=".65" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`).join('')}
</defs></svg>`;

// Wavy wax-seal outline around (cx, cy).
function sealPath(cx, cy, r) {
  const n = 14, pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.9 : r * 1.02 + (i % 4 === 0 ? 0.6 : 0);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 2) {
    const c = pts[i], e = pts[(i + 1) % pts.length];
    d += `Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// A watercolor-style envelope, sealed with wax in the twin's color and a sprig of baby's breath.
function envelope(key, cls = '') {
  const initial = esc((letterName(key) || '?')[0]);
  // Baby's breath: little clusters at the tips of stems fanning up-left from the seal.
  const tips = [[56, 40], [48, 50], [64, 34], [44, 60], [70, 42], [54, 30]];
  const blooms = tips.flatMap(([x, y], i) => [[x, y], [x - 3.2, y + 1.5], [x + 1.5, y - 3], [x - 1.5, y - 2.6], [x + 3, y + .8]].slice(0, i % 2 ? 4 : 5));
  return `<svg class="envelope ${cls}" viewBox="0 0 160 110" aria-hidden="true">
    <g filter="url(#wc)">
      <rect x="6" y="8" width="148" height="96" rx="3" fill="url(#paper)" stroke="#cbb89a" stroke-width=".8"/>
      <rect x="6" y="8" width="148" height="96" rx="3" filter="url(#grain)" opacity=".9"/>
      <path d="M6 104 70 60M154 104 90 60" stroke="#d6c4a6" stroke-width=".8" fill="none"/>
      <path d="M6 8 6 104 64 58Z" fill="#efe3cf" opacity=".55"/>
      <path d="M154 8 154 104 96 58Z" fill="#efe3cf" opacity=".55"/>
      <path class="flap" d="M6.5 8.5 80 66 153.5 8.5Z" fill="url(#flap)" stroke="#cbb89a" stroke-width=".8"/>
    </g>
    <g class="sprig" stroke="#9aa594" stroke-width=".7" fill="none" stroke-linecap="round">
      ${tips.map(([x, y]) => `<path d="M80 66Q${((80 + x) / 2 + 3).toFixed(1)} ${((66 + y) / 2 + 2).toFixed(1)} ${x} ${y}"/>`).join('')}
      <path d="M80 66 98 76" stroke-width=".9"/>
    </g>
    <g class="sprig">${blooms.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7" fill="#fdfcf8" stroke="#c4c8bd" stroke-width=".45"/>`).join('')}</g>
    <g class="seal">
      <path d="${sealPath(80, 66, 14)}" fill="url(#wax-${key})"/>
      <circle cx="80" cy="66" r="9" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.2"/>
      <text x="80" y="66" text-anchor="middle" dominant-baseline="central" class="seal-letter">${initial}</text>
    </g>
  </svg>`;
}

const SPRIG_CORNER = color => `<svg class="corner" viewBox="0 0 34 34" aria-hidden="true"><path d="M4 30C10 20 16 12 30 4" style="stroke:var(--${color})" fill="none"/>
  <ellipse cx="12" cy="20" rx="4" ry="2" transform="rotate(-40 12 20)" style="fill:var(--${color}-bg)"/>
  <ellipse cx="19" cy="13" rx="4" ry="2" transform="rotate(-40 19 13)" style="fill:var(--${color}-bg)"/>
  <circle cx="28" cy="6" r="2.5" style="fill:var(--${color === 'sage' ? 'blush' : 'sage'})"/></svg>`;
const longDate = s => Dates.parse(s).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

// Routes: #/letter/new, #/letter/ID (read), #/letter/ID/edit
function renderLetter(id, sub) {
  if (id === 'new' || sub === 'edit') return renderLetterForm(id === 'new' ? null : id);
  const m = momentById(id);
  if (!m || m.kind !== 'letter') { location.hash = '#/letters'; return; }
  const name = letterName(m.who[0]);
  const body = m.caption.replace(/^\s*dear\s+[^,\n]*,?\s*/i, '');
  view.innerHTML = `
    <a class="back" href="#/letters">${ICON.back} Letters</a>
    <article class="paper">
      ${SPRIG_CORNER('sage')}${SPRIG_CORNER('blush')}
      <p class="paper-date">${esc(longDate(m.date))}</p>
      <p class="paper-dear">Dear ${esc(name)},</p>
      <div class="paper-text">${esc(body)}</div>
    </article>
    <p style="text-align:center;margin-top:14px"><a class="small muted" href="#/letter/${esc(m.id)}/edit">Edit</a></p>`;
}

function renderLetterForm(id) {
  const m = id ? momentById(id) : null;
  if (id && (!m || m.kind !== 'letter')) { location.hash = '#/letters'; return; }
  let to = m ? m.who[0] : null;
  const body = m ? m.caption.replace(/^\s*dear\s+[^,\n]*,?\s*/i, '') : '';
  view.innerHTML = `
    <a class="back" href="${m ? '#/letter/' + esc(m.id) : '#/letters'}">${ICON.back} ${m ? 'Back' : 'Letters'}</a>
    <div class="paper">
      ${SPRIG_CORNER('sage')}${SPRIG_CORNER('blush')}
      <label class="paper-date date-tap"><span id="date-text">${esc(longDate(m ? m.date : Dates.today()))}</span>
        <input type="date" id="date" value="${esc(m ? m.date : Dates.today())}" max="${Dates.today()}" aria-label="Date"></label>
      <p class="paper-dear">Dear ${twins().map(t => `<button type="button" class="dear-name ${t.key}" data-to="${t.key}" aria-pressed="${to === t.key}">${esc(letterName(t.key))}</button>`).join(' ')},</p>
      <textarea id="letter" class="paper-lines" aria-label="Your letter">${esc(body)}</textarea>
    </div>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" id="save" style="margin-top:16px">${m ? 'Save' : 'Seal letter'}</button>
    ${m ? '<button type="button" class="link-btn" id="del" style="display:block;margin:16px auto 0">Delete this letter</button>' : ''}`;

  const pickTo = key => {
    to = key;
    $$('[data-to]').forEach(b => b.setAttribute('aria-pressed', b.dataset.to === key));
    $('#err').hidden = true;
  };
  $$('[data-to]').forEach(b => b.onclick = () => pickTo(b.dataset.to));
  $('#date').oninput = e => { if (Dates.valid(e.target.value)) $('#date-text').textContent = longDate(e.target.value); };

  $('#save').onclick = e => {
    const text = $('#letter').value.trim(), date = $('#date').value, err = $('#err');
    const problem = !to ? `Tap ${twins().map(t => letterName(t.key)).join(' or ')} next to “Dear.”` : !text ? 'Write something first.' : !Dates.valid(date) ? 'Pick a date.' : '';
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    busy(e.target, async () => {
      if (m) {
        await DB.updateMoment(m, { caption: text, date, who: [to] }, [], []);
        toast('Saved');
        location.hash = `#/letter/${m.id}`;
      } else {
        await DB.addMoment({ kind: 'letter', who: [to], date, caption: text }, []);
        await sealFlourish(to);
        location.hash = '#/letters';
      }
    }, m ? 'Saving…' : 'Sealing…');
  };
  if (m) $('#del').onclick = () => confirmBox('Delete this letter?', 'This can’t be undone.', 'Delete',
    async () => { await DB.deleteMoment(m); toast('Deleted'); location.hash = '#/letters'; });
}

// The envelope folds shut and the wax seal presses on. Skipped if the phone asks for less motion.
function sealFlourish(key) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { toast('Sealed'); return Promise.resolve(); }
  const el = document.createElement('div');
  el.className = 'seal-overlay';
  el.innerHTML = `${ENVELOPE_DEFS}<div class="seal-stage">${envelope(key, 'sealing')}<p>Sealed for ${esc(letterName(key))}</p></div>`;
  document.body.appendChild(el);
  return new Promise(resolve => setTimeout(() => {
    el.classList.add('done');
    setTimeout(() => { el.remove(); resolve(); }, 350);
  }, 1900));
}

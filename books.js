/* Keepsakes (reached from Settings): keepsake PDFs (one per twin or both, by
   year or all time), the growth chart, and a full backup download.
   Letters are written in the Letters tab and open each book.
   PDFs and ZIPs are made on the phone; nothing is sent anywhere.
   Uses helpers from app.js ($, esc, ICON, DB, state...). */

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ($(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error('Couldn’t load the tool for this. Check your connection.')); };
    document.head.appendChild(s);
  });
}

// On iPhone the Share sheet is the way to "Save to Files", AirDrop or email a
// file. It has to start from a tap, so the file is made first and then this
// runs from a "Save or share" button.
async function saveFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

const fileSafe = s => String(s).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
const years = () => [...new Set(state.moments.map(m => m.date.slice(0, 4)))].sort();
// Letters to a twin within the book's years, oldest first.
const lettersFor = (key, year) => lettersTo(key).filter(l => year === 'all' || l.date.startsWith(year)).reverse();

// ---------- Books page ----------
function renderBooks(section) {
  const pick = { who: twins()[1] ? twins()[1].key : 'both', year: 'all', print: false };
  const whoOpts = [...twins().map(t => [t.key, `${t.name}’s book`]), ['both', 'Both']];
  const yearOpts = [['all', 'All time'], ...years().map(y => [y, y])];

  view.innerHTML = `
    <a class="back" href="#/settings">${ICON.back} Settings</a>
    <div class="page-head"><h1>Books</h1></div>

    <section class="card">
      <h2 style="font-size:20px">Make a book</h2>
      <p class="muted small" style="margin:2px 0 14px">A PDF of their timeline, month by month: photos, firsts, quotes, and growth.</p>
      <p class="field-label">Whose book</p>
      <div class="chip-wrap" id="b-who">${whoOpts.map(([k, t]) => `<button type="button" class="chip" data-v="${k}" aria-pressed="${pick.who === k}">${esc(t)}</button>`).join('')}</div>
      <p class="field-label" style="margin-top:14px">Which years</p>
      <div class="chip-wrap" id="b-year">${yearOpts.map(([k, t]) => `<button type="button" class="chip" data-v="${k}" aria-pressed="${pick.year === k}">${esc(t)}</button>`).join('')}</div>
      <label class="switch" style="margin-top:14px"><input type="checkbox" id="b-print"><span>For printing (sharper photos, bigger file)</span></label>
      <p class="hint" id="b-count"></p>
      <button class="btn primary block" id="make" style="margin-top:14px">Make PDF</button>
      <p class="progress" id="b-progress" hidden></p>
      <div id="b-ready"></div>
    </section>

    <section class="card" id="backup">
      <h2 style="font-size:20px">Backup</h2>
      <p class="muted small" style="margin:2px 0 12px">A copy of everything to keep in iCloud Drive or Google Drive, just in case.</p>
      <button class="btn block" id="zip-all">${ICON.download} Photos and data</button>
      <button class="btn block" id="zip-data" style="margin-top:8px">Data only (small)</button>
      <p class="progress" id="z-progress" hidden></p>
      <div id="z-ready"></div>
    </section>`;

  const count = () => {
    const n = bookMoments(pick).length;
    $('#b-count').textContent = n ? `${n} moment${n === 1 ? '' : 's'} in this book` : 'Nothing in this range yet.';
  };
  const single = (id, key) => $$(`#${id} .chip`).forEach(b => b.onclick = () => {
    $$(`#${id} .chip`).forEach(x => x.setAttribute('aria-pressed', x === b));
    pick[key] = b.dataset.v;
    $('#b-ready').innerHTML = '';
    count();
  });
  single('b-who', 'who');
  single('b-year', 'year');
  $('#b-print').onchange = e => { pick.print = e.target.checked; $('#b-ready').innerHTML = ''; };
  count();
  if (section === 'backup') requestAnimationFrame(() => $('#backup').scrollIntoView());

  $('#make').onclick = e => {
    if (!bookMoments(pick).length) { toast('Nothing in this range yet.', true); return; }
    const progress = $('#b-progress');
    progress.hidden = false;
    busy(e.target, async () => {
      const { blob, name } = await makeBook(pick, t => { progress.textContent = t; });
      ready($('#b-ready'), blob, name);
    }, 'Making…').finally(() => { progress.hidden = true; });
  };

  const zip = (withPhotos, btn) => {
    const progress = $('#z-progress');
    progress.hidden = false;
    busy(btn, async () => {
      const { blob, name } = await makeBackup(withPhotos, t => { progress.textContent = t; });
      ready($('#z-ready'), blob, name);
    }, 'Working…').finally(() => { progress.hidden = true; });
  };
  $('#zip-all').onclick = e => zip(true, e.target);
  $('#zip-data').onclick = e => zip(false, e.target);
}

function ready(el, blob, name) {
  const mb = blob.size / 1048576;
  el.innerHTML = `<div class="note-card card">
    <p><strong style="font-weight:500">${esc(name)}</strong> is ready <span class="muted small">(${mb >= 1 ? mb.toFixed(1) + ' MB' : Math.max(1, Math.round(blob.size / 1024)) + ' KB'})</span></p>
    <button class="btn primary block" style="margin-top:10px">Save or share</button></div>`;
  $('button', el).onclick = () => saveFile(blob, name);
}

// ---------- growth chart ----------
const monthsOld = date => (Dates.parse(date) - Dates.parse(state.settings.birthday)) / (86400000 * 30.4375);

function growthPoints(key, measure) {
  return state.moments
    .filter(m => m.kind === 'growth' && m.growth && m.growth[key] && m.growth[key][measure] != null)
    .map(m => ({ x: monthsOld(m.date), y: m.growth[key][measure], m }))
    .sort((a, b) => a.x - b.x);
}

function lineChart(measure, label, unit) {
  const series = twins().map(t => ({ t, pts: growthPoints(t.key, measure) })).filter(s => s.pts.length);
  if (!series.length) return '';
  const all = series.flatMap(s => s.pts);
  const W = 340, H = 190, L = 36, R = 10, T = 12, B = 28;
  const xMax = Math.max(6, Math.ceil(Math.max(...all.map(p => p.x)) / 3) * 3);
  // Round the scale to friendly steps (1, 2, 5, 10...) so labels read 10, 15, 20.
  const lo = Math.min(...all.map(p => p.y)), hi = Math.max(...all.map(p => p.y));
  const raw = Math.max(0.5, (hi - lo) / 3), pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(k => k * pow).find(s => s >= raw);
  const yMin = Math.max(0, Math.floor(lo / step) * step - (lo % step === 0 ? step : 0));
  const yMax = Math.ceil(hi / step) * step + (hi % step === 0 ? step : 0);
  const X = x => L + (x / xMax) * (W - L - R);
  const Y = y => T + (1 - (y - yMin) / (yMax - yMin)) * (H - T - B);
  const xStep = xMax <= 12 ? 3 : xMax <= 36 ? 6 : 12;
  const xTicks = [...Array(Math.floor(xMax / xStep) + 1)].map((_, n) => n * xStep);
  const yTicks = [...Array(Math.round((yMax - yMin) / step) + 1)].map((_, n) => yMin + n * step);
  const color = key => (key === 'will' ? 'var(--sage-ink)' : 'var(--blush-ink)');

  return `<section class="card chart-card">
    <div class="chart-head"><h2>${label}</h2><span class="muted small">${unit}</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} over time">
      ${yTicks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid-line"/>
        <text x="${L - 6}" y="${Y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle" class="axis">${Math.round(v * 10) / 10}</text>`).join('')}
      ${xTicks.map(v => `<text x="${X(v).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="axis">${v}${v === xTicks[xTicks.length - 1] ? ' mo' : ''}</text>`).join('')}
      ${series.map(s => `<polyline points="${s.pts.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}" style="fill:none;stroke:${color(s.t.key)};stroke-width:2"/>
        ${s.pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" style="fill:${color(s.t.key)}"><title>${esc(s.t.name)}: ${p.y} ${unit}, ${esc(Dates.pretty(p.m.date))}</title></circle>`).join('')}`).join('')}
    </svg>
    <div class="legend">${series.map(s => `<span><i style="background:${color(s.t.key)}"></i>${esc(s.t.name)}</span>`).join('')}</div>
  </section>`;
}

function renderGrowth() {
  const entries = state.moments.filter(m => m.kind === 'growth');
  const charts = MEASURES.map(([k, label, unit]) => lineChart(k, label, unit)).join('');
  view.innerHTML = `
    <a class="back" href="#/timeline" id="back">${ICON.back} Back</a>
    <div class="page-head"><h1>Growth</h1><a class="icon-btn" href="#/add/growth" aria-label="Add growth">${ICON.plus}</a></div>
    ${charts || `<div class="card empty"><h2>No measurements yet</h2><p>After a checkup, add their weight and height. The chart builds itself.</p>
      <a class="btn primary" href="#/add/growth">${ICON.plus} Add growth</a></div>`}
    ${entries.length ? `<p class="section-label">All checkups</p>${entries.map(m => `<a class="card moment" href="#/moment/${esc(m.id)}">
      <div class="moment-meta"><span>${esc(Dates.pretty(m.date))}</span><span class="date">${esc(ageOn(m.date, true))}</span></div>
      ${m.caption ? `<p class="caption small">${esc(m.caption)}</p>` : ''}${growthLines(m)}</a>`).join('')}` : ''}`;
  $('#back').onclick = e => { e.preventDefault(); goBack('#/timeline'); };
}

// ---------- the PDF ----------
function bookMoments({ who, year }) {
  return state.moments
    .filter(m => m.kind !== 'letter' && m.kind !== 'wordlist')
    .filter(m => (who === 'both' || (m.who || []).includes(who)) && (year === 'all' || m.date.startsWith(year)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The built-in PDF fonts only know Western characters; swap the rest.
function pdfText(s) {
  return String(s || '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/★/g, '*').replace(/♥/g, '')
    .replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, '');
}

// Loads a photo and crops/shrinks it to exactly the box it fills on the page.
async function photoForPdf(url, boxW, boxH, pxPerPt, fit) {
  const blob = await (await fetch(url)).blob();
  let img;
  try { img = await createImageBitmap(blob); } catch {
    const u = URL.createObjectURL(blob);
    img = new Image(); img.src = u; await img.decode(); URL.revokeObjectURL(u);
  }
  const iw = img.width, ih = img.height;
  let sx = 0, sy = 0, sw = iw, sh = ih, w = boxW, h = boxH;
  if (fit) {
    // Whole photo, as large as fits the box.
    const s = Math.min(boxW / iw, boxH / ih);
    w = iw * s; h = ih * s;
  } else {
    // Fill the box, trimming the edges (centered).
    const target = boxW / boxH;
    if (iw / ih > target) { sw = ih * target; sx = (iw - sw) / 2; } else { sh = iw / target; sy = (ih - sh) / 2; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(Math.min(w * pxPerPt, sw)));
  canvas.height = Math.max(1, Math.round(Math.min(h * pxPerPt, sh)));
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  if (img.close) img.close();
  const data = canvas.toDataURL('image/jpeg', 0.85);
  canvas.width = canvas.height = 0;
  return { data, w, h };
}

async function makeBook(pick, progress) {
  progress('Getting ready…');
  await loadScript(JSPDF_URL);
  const { jsPDF } = window.jspdf;

  const S = 576, M = 48, W = S - 2 * M, GAP = 6, BOTTOM = S - M - 10;
  const C = {
    bg: [251, 247, 242], text: [74, 74, 63], muted: [138, 138, 122], line: [232, 225, 214],
    will: [62, 90, 58], millie: [138, 74, 62], gold: [176, 138, 62], card: [255, 255, 255],
  };
  const pxPerPt = pick.print ? 3 : 1.6;
  const twin = twins().find(t => t.key === pick.who);
  const title = twin ? `${twin.name}'s Book` : `${bothNames()}`;
  const list = bookMoments(pick);
  const span = list.length ? [list[0].date.slice(0, 4), list[list.length - 1].date.slice(0, 4)] : [];
  const yearsText = pick.year !== 'all' ? pick.year : span[0] === span[1] ? span[0] : `${span[0]} - ${span[1]}`;

  const doc = new jsPDF({ unit: 'pt', format: [S, S], compress: true });
  let page = 1, y = M;
  const fill = () => { doc.setFillColor(...C.bg); doc.rect(0, 0, S, S, 'F'); };
  const color = c => doc.setTextColor(...c);
  const font = (face, style, size) => { doc.setFont(face, style); doc.setFontSize(size); };
  function footer() {
    if (page === 1) return;
    font('helvetica', 'normal', 8); color(C.muted);
    doc.text(pdfText(`${title}  ·  ${page}`), S / 2, S - 22, { align: 'center' });
  }
  function newPage() { footer(); doc.addPage([S, S]); page++; fill(); y = M; }

  // Cover
  fill();
  const withPhotos = list.filter(m => (m.photos || []).length);
  const coverMoment = [...withPhotos].reverse().find(m => twin ? m.who.length === 1 : m.who.length > 1) || withPhotos[withPhotos.length - 1];
  font('times', 'normal', 34); color(C.text);
  doc.text(pdfText(title), S / 2, 96, { align: 'center' });
  font('helvetica', 'normal', 12); color(C.muted);
  doc.text(pdfText([twin ? twin.fullName : twins().map(t => t.fullName).join(' and '), yearsText].filter(Boolean).join('  ·  ')), S / 2, 120, { align: 'center' });
  if (coverMoment) {
    try {
      const p = coverMoment.photos[0];
      const ph = await photoForPdf(p.video ? (p.poster || p.thumbUrl) : p.url, 380, 330, pxPerPt, false);
      doc.addImage(ph.data, 'JPEG', (S - 380) / 2, 160, 380, 330);
    } catch (e) { console.warn('Cover photo skipped', e); }
  }
  font('helvetica', 'normal', 10); color(C.muted);
  doc.text(pdfText(`Born ${Dates.parse(state.settings.birthday).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`), S / 2, 522, { align: 'center' });

  // Letter(s)
  const letterFor = twin ? [twin] : twins();
  for (const t of letterFor) {
    for (const l of lettersFor(t.key, pick.year)) {
      const text = l.caption.trim();
      newPage();
      font('helvetica', 'normal', 9); color(C.muted);
      doc.text(pdfText(`${Dates.pretty(l.date)}  ·  ${ageOn(l.date)}`), M, y + 8);
      y += 26;
      font('times', 'italic', 20); color(C.text);
      if (!/^dear\b/i.test(text)) { doc.text(pdfText(`Dear ${t.fullName || t.name},`), M, y + 16); y += 40; }
      font('times', 'normal', 13);
      for (const line of doc.splitTextToSize(pdfText(text), W)) {
        if (y > BOTTOM - 10) newPage();
        doc.text(line, M, y + 12);
        y += 19;
      }
    }
  }

  // Months
  const months = new Map();
  for (const m of list.filter(x => x.kind !== 'growth')) {
    const k = Dates.monthKey(m.date);
    if (!months.has(k)) months.set(k, []);
    months.get(k).push(m);
  }
  const totalPhotos = list.reduce((n, m) => n + Math.min((m.photos || []).length, 6), 0);
  let photoN = 0;

  function monthHeader(k, ms, cont) {
    font('times', 'normal', cont ? 14 : 24); color(C.text);
    doc.text(pdfText(Dates.monthLabel(k) + (cont ? ' (continued)' : '')), M, y + (cont ? 12 : 22));
    if (!cont) {
      font('helvetica', 'normal', 10); color(C.muted);
      const last = ms[ms.length - 1].date;
      doc.text(pdfText(beforeBirth(last) ? ageOn(last, true).replace(' wks', ' weeks') : ageOn(last)), S - M, y + 22, { align: 'right' });
    }
    y += cont ? 22 : 34;
    doc.setDrawColor(...C.line); doc.setLineWidth(0.8); doc.line(M, y, S - M, y);
    y += 18;
  }

  // maxH keeps photos + text on one page (a continued page has ~430pt of room).
  function photoBoxes(m, maxH = 320) {
    const ph = (m.photos || []).slice(0, 6);
    if (!ph.length) return { boxes: [], h: 0 };
    if (ph.length === 1) {
      const p = ph[0], a = (p.w || 4) / (p.h || 3);
      const h = Math.min(320, maxH, W / a), w = h * a;
      return { boxes: [{ p, x: M + (W - w) / 2, y: 0, w, h, fit: true }], h };
    }
    const cols = ph.length === 2 || ph.length === 4 ? 2 : 3;
    const cell = (W - GAP * (cols - 1)) / cols;
    const rows = Math.ceil(ph.length / cols);
    const size = Math.min(ph.length === 4 ? Math.min(cell, 180) : cell, (maxH - GAP * (rows - 1)) / rows);
    const rowW = cols * size + GAP * (cols - 1), x0 = M + (W - rowW) / 2;
    const boxes = ph.map((p, n) => ({ p, x: x0 + (n % cols) * (size + GAP), y: Math.floor(n / cols) * (size + GAP), w: size, h: size }));
    return { boxes, h: Math.ceil(ph.length / cols) * (size + GAP) - GAP };
  }

  // Everything about one entry's layout, worked out before drawing so page
  // breaks never split a photo from its caption.
  function layout(m) {
    const meta = [Dates.short(m.date), pick.who === 'both' ? whoText(m.who) : '', isFirst(m) ? 'FIRST' : '',
      m.ideaId && ideaById(m.ideaId) && m.caption !== ideaById(m.ideaId).title ? ideaById(m.ideaId).title : ''].filter(Boolean);
    let lines = [], textFont = ['times', 'normal', 13], lineH = 17;
    if (m.kind === 'quote') {
      textFont = ['times', 'italic', 17]; lineH = 22;
      doc.setFont(...textFont.slice(0, 2)); doc.setFontSize(textFont[2]);
      lines = doc.splitTextToSize(pdfText(`"${m.caption}"`), W);
      if (pick.who === 'both') lines.push(`- ${pdfText(whoText(m.who))}`);
    } else if (m.kind === 'snapshot') {
      doc.setFont('times', 'normal'); doc.setFontSize(13);
      lines = [pdfText(`All about ${whoText(m.who)} at ${ageOn(m.date)}`), ...orderedAnswers(m.answers)
        .flatMap(([k, v]) => doc.splitTextToSize(pdfText(`${fieldLabel(k)}: ${v}`), W))];
    } else {
      const parts = [m.caption];
      if (m.kind === 'growth' && m.growth) {
        const keys = twin ? [twin.key] : Object.keys(m.growth);
        parts.push(...keys.filter(key => m.growth[key]).map(key => `${twin ? '' : twinName(key) + ': '}${growthText(m.growth[key])}`));
      }
      doc.setFont(textFont[0], textFont[1]); doc.setFontSize(textFont[2]);
      lines = parts.filter(Boolean).flatMap(t => doc.splitTextToSize(pdfText(t), W));
    }
    const room = BOTTOM - (M + 40) - 14 - 8 - lines.length * lineH - 18;
    const { boxes, h: photoH } = photoBoxes(m, Math.max(120, room));
    const h = 14 + (photoH ? photoH + 8 : 0) + lines.length * lineH + 18;
    return { meta, boxes, photoH, lines, textFont, lineH, h };
  }
  const HEADER_H = 52;

  // A month starts on the current page only if its title and first entry both fit.
  let firstMonth = true, chapter = null;
  const chapterPage = title => {
    newPage();
    font('times', 'italic', 28); color(C.text);
    doc.text(pdfText(title), S / 2, S / 2, { align: 'center' });
  };
  for (const [k, ms] of months) {
    const first = layout(ms[0]);
    // Pregnancy posts get their own chapter, then the story starts again at birth.
    const now = beforeBirth(ms[0].date) ? 'before' : 'after';
    if (now !== chapter) {
      if (now === 'before') chapterPage('Before you were born');
      else if (chapter === 'before') chapterPage(twin ? `Hello, ${twin.name}` : 'Hello, world');
      if (chapter !== null || now === 'before') firstMonth = true;
      chapter = now;
    }
    if (firstMonth || y + 14 + HEADER_H + first.h > BOTTOM) newPage(); else y += 14;
    firstMonth = false;
    monthHeader(k, ms);
    for (const m of ms) {
      const { meta, boxes, photoH, lines, textFont, lineH, h: blockH } = layout(m);
      if (y + blockH > BOTTOM && y > M + HEADER_H + 10) { newPage(); monthHeader(k, ms, true); }

      // meta line
      font('helvetica', 'normal', 9);
      let x = M;
      meta.forEach((t, n) => {
        const isFirst = t === 'FIRST';
        color(isFirst ? C.gold : C.muted);
        const s = pdfText((n ? '  ·  ' : '') + (isFirst ? 'First!' : t));
        doc.text(s, x, y + 8);
        x += doc.getTextWidth(s);
      });
      y += 14;

      for (const b of boxes) {
        photoN++;
        progress(`Adding photo ${photoN} of ${totalPhotos}…`);
        try {
          const ph = await photoForPdf(b.p.video ? (b.p.poster || b.p.thumbUrl) : b.p.url, b.w, b.h, pxPerPt, b.fit);
          doc.addImage(ph.data, 'JPEG', b.x, y + b.y, b.w, b.h);
        } catch (e) {
          console.warn('Photo skipped', e);
          doc.setFillColor(...C.line); doc.rect(b.x, y + b.y, b.w, b.h, 'F');
        }
      }
      if (photoH) y += photoH + 8;

      font(...textFont); color(C.text);
      for (const line of lines) { doc.text(line, M, y + lineH - 5); y += lineH; }
      y += 18;
    }
  }

  // Growth table
  const growthRows = list.filter(m => m.kind === 'growth' && m.growth);
  if (growthRows.length) {
    newPage();
    font('times', 'normal', 24); color(C.text);
    doc.text('Growing', M, y + 22);
    y += 44;
    for (const t of letterFor) {
      const rows = growthRows.filter(m => m.growth[t.key]);
      if (!rows.length) continue;
      if (!twin) { font('times', 'normal', 15); color(C[t.key] || C.text); doc.text(pdfText(t.name), M, y + 12); y += 24; }
      const cols = [['Date', M], ['Age', M + 150], ['Weight', M + 270], ['Height', M + 370]];
      font('helvetica', 'normal', 9); color(C.muted);
      cols.forEach(([h, cx]) => doc.text(h, cx, y + 8));
      y += 16;
      font('helvetica', 'normal', 11); color(C.text);
      for (const m of rows) {
        if (y > BOTTOM - 10) newPage();
        const g = m.growth[t.key];
        [Dates.short(m.date) + ', ' + m.date.slice(0, 4), ageOn(m.date, true),
          g.weight != null ? `${g.weight} lb` : '-', g.height != null ? `${g.height} in` : '-']
          .forEach((v, n) => doc.text(pdfText(v), cols[n][1], y + 10));
        y += 20;
      }
      y += 16;
    }
  }

  // Words: every word up to the end of the book's years, in the order they came.
  for (const t of letterFor) {
    const words = wordsInOrder(t.key).filter(x => pick.year === 'all' || x.date.slice(0, 4) <= pick.year);
    if (!words.length) continue;
    newPage();
    font('times', 'normal', 24); color(C.text);
    doc.text(pdfText(`${t.name}'s words`), M, y + 22);
    font('helvetica', 'normal', 10); color(C.muted);
    doc.text(pdfText(`${words.length} words`), S - M, y + 22, { align: 'right' });
    y += 44;
    const cols = 3, colW = W / cols, rowH = 15;
    let n = 0;
    font('times', 'normal', 12); color(C.text);
    for (const x of words) {
      const col = n % cols;
      if (col === 0 && n > 0) y += rowH;
      if (y > BOTTOM - 4) { newPage(); font('times', 'normal', 12); color(C.text); }
      doc.text(pdfText(`${words.indexOf(x) + 1}. ${x.w}`), M + col * colW, y + 10, { maxWidth: colW - 8 });
      n++;
    }
    y += rowH + 10;
  }

  // Last page
  newPage();
  font('times', 'italic', 18); color(C.text);
  doc.text('To be continued...', S / 2, S / 2 - 6, { align: 'center' });
  font('helvetica', 'normal', 9); color(C.muted);
  doc.text(pdfText(`Made ${Dates.pretty(Dates.today())}`), S / 2, S / 2 + 16, { align: 'center' });
  footer();

  progress('Finishing…');
  const name = `${fileSafe(twin ? `${twin.name}s Book` : `${bothNames()} Book`)}-${pick.year === 'all' ? 'All' : pick.year}.pdf`;
  return { blob: doc.output('blob'), name };
}

// ---------- backup ----------
async function makeBackup(withPhotos, progress) {
  progress('Getting ready…');
  await loadScript(JSZIP_URL);
  const zip = new JSZip();
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'url' || k === 'thumbUrl' ? undefined : v)));
  zip.file('a-and-w-data.json', JSON.stringify({
    exportedAt: new Date().toISOString(),
    settings: strip(state.settings), moments: strip(state.moments), ideas: strip(state.ideas),
  }, null, 2));
  zip.file('README.txt', 'A&W backup\n\na-and-w-data.json has every moment, idea, visit and setting.\n' +
    (withPhotos ? 'photos/ has every timeline photo, named by date. ideas/ has photos saved with ideas.\n' : 'Photos are not included in this data-only backup.\n'));

  if (withPhotos) {
    const jobs = [
      ...state.moments.flatMap(m => (m.photos || []).map((p, n) => ({ url: p.url, path: `photos/${m.date}_${fileSafe(m.caption || m.kind) || 'moment'}_${m.id.slice(0, 5)}-${n + 1}.${p.video ? 'mp4' : 'jpg'}` }))),
      ...state.ideas.flatMap(i => (i.photos || []).map((p, n) => ({ url: p.url, path: `ideas/${fileSafe(i.title) || 'idea'}_${i.id.slice(0, 5)}-${n + 1}.jpg` }))),
    ];
    let failed = 0;
    for (let n = 0; n < jobs.length; n++) {
      progress(`Adding photo ${n + 1} of ${jobs.length}…`);
      try {
        const blob = await (await fetch(jobs[n].url)).blob();
        zip.file(jobs[n].path, blob, { binary: true });
      } catch (e) { console.warn('Backup photo skipped', e); failed++; }
    }
    if (failed) toast(`${failed} photo${failed === 1 ? '' : 's'} couldn’t be added. Try again on Wi-Fi.`, true);
  }
  progress('Zipping…');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return { blob, name: `A-and-W-backup-${Dates.today()}${withPhotos ? '' : '-data'}.zip` };
}

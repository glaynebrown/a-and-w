/* Date and age helpers. Dates are stored as plain 'YYYY-MM-DD' strings (no
   time zones to trip over); they're turned into Date objects only for math. */
const Dates = (() => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const pad = n => String(n).padStart(2, '0');

  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const parse = s => {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const valid = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(parse(s));

  // Whole months (and leftover days) from birthday to date.
  function span(birthday, date) {
    const b = parse(birthday), d = parse(date);
    if (d < b) return null;
    let months = (d.getFullYear() - b.getFullYear()) * 12 + d.getMonth() - b.getMonth();
    if (d.getDate() < b.getDate()) months--;
    const anchor = new Date(b.getFullYear(), b.getMonth() + months, b.getDate());
    const days = Math.round((d - anchor) / 86400000);
    return { months, days };
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // "20 months, 1 week" / "2 years, 3 months" (long) or "20 mo" / "2 yr 3 mo" (short).
  function age(birthday, date, short) {
    if (!valid(birthday) || !valid(date)) return '';
    const s = span(birthday, date);
    if (!s) return short ? 'before birth' : '';
    const { months, days } = s;
    const weeks = Math.floor(days / 7);
    if (months === 0) {
      if (weeks === 0) return short ? `${days} d` : plural(days, 'day');
      return short ? `${weeks} wk` : plural(weeks, 'week');
    }
    if (months < 24) {
      if (short) return `${months} mo`;
      return weeks ? `${plural(months, 'month')}, ${plural(weeks, 'week')}` : plural(months, 'month');
    }
    const y = Math.floor(months / 12), m = months % 12;
    if (short) return m ? `${y} yr ${m} mo` : `${y} yr`;
    return m ? `${plural(y, 'year')}, ${plural(m, 'month')}` : plural(y, 'year');
  }

  const monthKey = s => s.slice(0, 7);
  const monthLabel = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const pretty = s => parse(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const short = s => parse(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const yearsAgo = (s, t = today()) => Number(t.slice(0, 4)) - Number(s.slice(0, 4));

  return { iso, today, parse, valid, age, monthKey, monthLabel, pretty, short, yearsAgo };
})();

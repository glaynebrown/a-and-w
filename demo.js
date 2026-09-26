/* Sample mode: lets you try A&W before Firebase is set up. Same functions as
   store.js, but everything lives in memory and disappears on reload. Photos
   you add stay on this phone only (never uploaded). */
const DemoStore = (() => {
  const SAMPLE_COLORS = [['#DDE7DA', '#A9BFA4'], ['#F4DCD6', '#E8B4A8'], ['#EFE6D6', '#D9C9A8'], ['#E4EBE1', '#C9B79A']];
  // A soft placeholder "photo" (hills and a sun) so sample cards aren't empty.
  function samplePhoto(i) {
    const [bg, fg] = SAMPLE_COLORS[i % SAMPLE_COLORS.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bg}"/><circle cx="${90 + (i * 53) % 220}" cy="90" r="34" fill="#fff" opacity=".7"/><path d="M0 230 Q100 150 200 215 T400 190 V300 H0Z" fill="${fg}"/><path d="M0 265 Q120 215 250 255 T400 245 V300 H0Z" fill="${fg}" opacity=".6"/></svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return { path: `sample-${i}`, thumbPath: `sample-${i}-t`, url, thumbUrl: url, w: 400, h: 300 };
  }

  const t = Dates.today();
  const shift = (months, day) => {
    const d = Dates.parse(t);
    return Dates.iso(new Date(d.getFullYear(), d.getMonth() - months, day ?? d.getDate()));
  };

  let n = 0;
  const m = (date, kind, who, caption, photos = 0) =>
    ({ id: `s${++n}`, date, kind, who, caption, photos: [...Array(photos)].map((_, i) => samplePhoto(n * 5 + i)) });

  const snap = (date, key, answers, photos = 0) => ({ id: `s${++n}`, date, kind: 'snapshot', who: [key], caption: '', answers, photos: [...Array(photos)].map((_, i) => samplePhoto(n * 5 + i)) });
  const letter = (date, key, text) => ({ id: `s${++n}`, date, kind: 'letter', who: [key], caption: text, photos: [] });
  const wordlist = (key, list) => ({ id: `s${++n}`, date: '2026-09-01', kind: 'wordlist', who: [key], caption: '', photos: [],
    words: list.split(',').map((w, i) => ({ w: w.trim(), date: '2026-09-01', early: true, note: '', t: 1000 + i })) });
  const growth = (date, caption, g) => ({ id: `s${++n}`, date, kind: 'growth', who: Object.keys(g), caption, photos: [], growth: g });
  let moments = [
    m(shift(0, 20), 'moment', ['will', 'millie'], 'First time at the pumpkin patch', 3),
    m(shift(0, 12), 'first', ['millie'], 'Said "doggy" at the park'),
    m(shift(0, 3), 'quote', ['will'], 'Uh oh, ball go bye bye'),
    m(shift(1, 27), 'moment', ['will'], 'Wouldn’t let go of the hose', 1),
    m(shift(1, 9), 'first', ['will', 'millie'], 'First time at the splash pad', 2),
    m(shift(4, 15), 'moment', ['millie'], 'Beach day', 4),
    m(shift(12), 'first', ['will', 'millie'], 'First time eating spaghetti', 1),
    m('2025-01-25', 'first', ['will', 'millie'], 'Hello, world', 2),
    snap(shift(4, 2), 'millie', { food: 'Bananas', animal: 'Ducks', word: 'Mama', funny: 'Blows raspberries at the dog' }),
    snap(shift(2, 5), 'millie', { food: 'Blueberries', animal: 'Ducks', word: 'Uh oh', funny: 'Blows raspberries at the dog', book: 'Goodnight Moon' }),
    snap(shift(0, 18), 'millie', { food: 'Pasta', animal: 'Dogs', word: 'Doggy', funny: 'Fake sneezes to make us laugh', book: 'Goodnight Moon', skill: 'Climbing the big slide' }, 1),
    snap(shift(3, 1), 'will', { food: 'Cheerios', toy: 'Blue truck', word: 'Ball' }),
    snap(shift(0, 16), 'will', { food: 'Cheese', toy: 'Blue truck', word: 'Ball', funny: 'Dances when the dryer buzzes', dislike: 'Socks' }),
    letter('2026-01-25', 'will', 'Dear Will,\n\nHappy first birthday. You laugh with your whole body.'),
    letter('2026-01-25', 'millie', 'Dear Millie,\n\nHappy first birthday. You already run this house.'),
    wordlist('millie', 'mama, dada, hi, bye, uh oh, ball, dog, cat, milk, more, no, yes, up, down, shoe, sock, hat, duck, moo, baa, book, bath, night night, bubble, apple, nana, cracker, water, all done, please, thank you, bird, car, truck, baby, eye, nose, mouth, ear, hair, toes, belly, outside, go, stop, hot, cold, wow, uh huh'),
    wordlist('will', 'mama, dada, hi, bye, ball, uh oh, dog, car, truck, go, no, more, milk, up, boom, choo choo, vroom, moo, duck, book, bath, shoe, cracker, water, all done, night night, outside, hot, wow, yay, bus, tractor'),
    growth('2025-01-26', 'Birth', { will: { weight: 5.9, height: 18.5 }, millie: { weight: 5.4, height: 18 } }),
    growth('2025-03-27', '2-month checkup', { will: { weight: 10.8, height: 22.4 }, millie: { weight: 10.1, height: 21.8 } }),
    growth('2025-07-28', '6-month checkup', { will: { weight: 16.2, height: 26.1 }, millie: { weight: 15.3, height: 25.5 } }),
    growth('2026-01-27', '12-month checkup', { will: { weight: 21.4, height: 29.8 }, millie: { weight: 20.1, height: 29.1 } }),
    growth('2026-07-27', '18-month checkup', { will: { weight: 24.6, height: 32.2 }, millie: { weight: 23.2, height: 31.6 } }),
  ];
  // Made-up examples (not real places) so Things to do has something to show.
  let k = 0;
  const idea = (title, category, cost, drive, setting, length, extra = {}) => ({
    id: `i${++k}`, title, category, cost, drive, setting, length, address: '', link: '', notes: '',
    photos: extra.photo ? [samplePhoto(100 + k)] : [], visits: [], lastRating: null, hide: null, ...extra,
  });
  const visit = (months, rating, note = '') => ({ id: `v${Math.random().toString(36).slice(2, 7)}`, date: shift(months, 10), rating, note, momentId: null });
  let ideas = [
    idea('Neighborhood splash pad', 'water', 'free', 10, 'outdoor', 'quick',
      { photo: 1, visits: [visit(1, 5, 'Bring towels and water shoes')], lastRating: 5 }),
    idea('Pumpkin patch farm', 'events', 'under20', 35, 'outdoor', 'half',
      { photo: 1, visits: [visit(0, 4, 'Go early, weekends get packed')], lastRating: 4 }),
    idea('Library story time', 'library', 'free', 12, 'indoor', 'quick', { notes: 'Tuesdays 10:30' }),
    idea('Indoor play gym', 'indoor', 'under20', 20, 'indoor', 'quick', { photo: 1 }),
    idea('Duck pond walk', 'park', 'free', 8, 'outdoor', 'quick', { visits: [visit(3, 3)], lastRating: 3 }),
    idea('Petting zoo', 'animals', 'under20', 40, 'outdoor', 'half', { photo: 1 }),
    idea('Children’s museum', 'indoor', 'under50', 55, 'indoor', 'half'),
    idea('Fenced playground', 'park', 'free', 15, 'outdoor', 'quick', { visits: [visit(2, 5)], lastRating: 5 }),
    idea('Sensory bin with rice', 'home', 'free', 0, 'indoor', 'quick', { link: 'https://www.tiktok.com/', notes: 'Saw on TikTok. Use a big storage bin.' }),
    idea('Bathtub painting', 'home', 'free', 0, 'indoor', 'quick'),
    idea('Busy mall play area', 'indoor', 'free', 25, 'indoor', 'quick',
      { visits: [visit(2, 1, 'Way too crowded')], lastRating: 1, hide: { mode: 'never' } }),
  ];

  let settings = { ...DEFAULT_SETTINGS };
  const watchers = new Set();
  const ideaWatchers = new Set();
  const notifyIdeas = () => ideaWatchers.forEach(cb => cb([...ideas]));
  const sorted = () => [...moments].sort((a, b) => b.date.localeCompare(a.date));
  const notify = () => watchers.forEach(cb => cb(sorted()));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function keep(prepared, onEach) {
    const out = [];
    for (const p of prepared) {
      await wait(150);
      out.push({
        path: `local-${Math.random()}`, thumbPath: '', w: p.full.w, h: p.full.h,
        url: URL.createObjectURL(p.full.blob), thumbUrl: URL.createObjectURL(p.thumb.blob),
      });
      if (onEach) onEach(out.length);
    }
    return out;
  }

  return {
    configured: true,
    demo: true,
    onAuth: cb => { setTimeout(() => cb({ uid: 'sample', email: 'sample mode' })); return () => {}; },
    signIn: async () => {},
    signOut: async () => { location.hash = ''; location.reload(); },
    resetPassword: async () => {},
    loadSettings: async () => ({ ...settings }),
    saveSettings: async patch => { settings = { ...settings, ...patch }; },
    watchMoments(cb) {
      watchers.add(cb);
      setTimeout(() => cb(sorted()));
      return () => watchers.delete(cb);
    },
    async addMoment(data, prepared, onEach) {
      const photos = await keep(prepared, onEach);
      const id = `s${++n}`;
      moments.push({ id, ...data, photos });
      notify();
      return id;
    },
    async updateMoment(moment, data, prepared, removed, onEach) {
      const added = await keep(prepared, onEach);
      const gone = new Set(removed.map(p => p.path));
      moments = moments.map(x => x.id !== moment.id ? x
        : { ...x, ...data, photos: [...(x.photos || []).filter(p => !gone.has(p.path)), ...added] });
      notify();
    },
    async deleteMoment(moment) {
      moments = moments.filter(x => x.id !== moment.id);
      notify();
    },

    watchIdeas(cb) {
      ideaWatchers.add(cb);
      setTimeout(() => cb([...ideas]));
      return () => ideaWatchers.delete(cb);
    },
    async addIdea(data, prepared) {
      const photos = await keep(prepared);
      const id = `i${++k}`;
      ideas.push({ id, ...data, photos, visits: [] });
      notifyIdeas();
      return id;
    },
    async updateIdea(item, data, prepared, removed) {
      const added = await keep(prepared);
      const gone = new Set(removed.map(p => p.path));
      ideas = ideas.map(x => x.id !== item.id ? x
        : { ...x, ...data, photos: [...(x.photos || []).filter(p => !gone.has(p.path)), ...added] });
      notifyIdeas();
    },
    async patchIdea(id, patch) {
      ideas = ideas.map(x => x.id === id ? { ...x, ...patch } : x);
      notifyIdeas();
    },
    async deleteIdea(item) {
      ideas = ideas.filter(x => x.id !== item.id);
      notifyIdeas();
    },
  };
})();

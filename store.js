/* All data access lives here, so app.js only deals in plain objects.

   Firestore layout (one account -- yours):
     users/{uid}                     settings: twins, birthday, home location
     users/{uid}/moments/{id}        one timeline entry:
        { kind: 'moment'|'quote'|'growth'|..., first: true for a ★ First (older ones: kind 'first'), who: ['will','millie'], date: 'YYYY-MM-DD',
          caption, photos: [{ path, thumbPath, url, thumbUrl, w, h }], ideaId?, createdAt, updatedAt }
     users/{uid}/ideas/{id}          one place or at-home idea:
        { title, category, cost, drive, setting, length, address, link, notes, photos,
          visits: [{ id, date, rating, note, momentId }],
          lastRating, hide: null | { mode: 'later', until } | { mode: 'never' } }

   Storage: users/{uid}/{moments|ideas}/{id}/{n}.jpg and {n}-thumb.jpg

   When firebase-config.js hasn't been filled in yet, the app can run in
   "sample mode" instead (demo.js): same functions, kept in memory only. */

const DEFAULT_SETTINGS = {
  twins: [
    { key: 'will', name: 'Will', fullName: 'William' },
    { key: 'millie', name: 'Millie', fullName: 'Amelia' },
  ],
  birthday: '2025-01-25',
  dueDate: '2025-02-22', // for "32 weeks" on posts from the pregnancy
  home: { label: 'Stafford, VA' },
};

const Store = (() => {
  const configured = typeof firebaseConfig !== 'undefined' && !/PASTE/.test(firebaseConfig.apiKey);
  if (!configured) return { configured: false };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();

  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    console.warn('Firestore offline persistence unavailable:', err.code);
  });

  // Offline, Firestore saves on the phone right away and syncs later; don't
  // make the screen wait for the server in that case.
  const write = p => {
    if (navigator.onLine) return p;
    p.catch(e => console.error('Offline save failed to sync', e));
    return Promise.resolve();
  };
  function needOnline(what) {
    if (!navigator.onLine) throw new Error(`You’re offline. ${what} needs an internet connection.`);
  }

  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const uid = () => auth.currentUser.uid;
  const userDoc = () => db.collection('users').doc(uid());
  const moments = () => userDoc().collection('moments');
  const ideas = () => userDoc().collection('ideas');
  const withId = d => ({ id: d.id, ...d.data() });

  const ignoreMissing = e => { if (e.code !== 'storage/object-not-found') throw e; };
  const removeFile = path => path ? storage.ref(path).delete().catch(ignoreMissing) : Promise.resolve();

  async function putBlob(path, blob) {
    const ref = storage.ref(path);
    await ref.put(blob, { contentType: 'image/jpeg', cacheControl: 'private, max-age=31536000' });
    return ref.getDownloadURL();
  }

  // prepared = output of Photos.prepare(). Unique names so edits never collide.
  // folder = 'moments' or 'ideas'.
  async function uploadPhotos(folder, id, prepared, onEach) {
    const out = [];
    for (const p of prepared) {
      const base = `users/${uid()}/${folder}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const [url, thumbUrl] = await Promise.all([
        putBlob(`${base}.jpg`, p.full.blob),
        putBlob(`${base}-thumb.jpg`, p.thumb.blob),
      ]);
      out.push({ path: `${base}.jpg`, thumbPath: `${base}-thumb.jpg`, url, thumbUrl, w: p.full.w, h: p.full.h });
      if (onEach) onEach(out.length);
    }
    return out;
  }

  return {
    configured: true,
    demo: false,

    onAuth: cb => auth.onAuthStateChanged(cb),
    signIn: (email, password) => auth.signInWithEmailAndPassword(email, password),
    signOut: async () => {
      await auth.signOut();
      if (self.caches) await caches.delete('aw-photos-v2').catch(() => {});
    },
    resetPassword: email => auth.sendPasswordResetEmail(email),

    async loadSettings() {
      const snap = await userDoc().get();
      if (snap.exists) return { ...DEFAULT_SETTINGS, ...snap.data() };
      await write(userDoc().set({ ...DEFAULT_SETTINGS, createdAt: ts() }));
      return { ...DEFAULT_SETTINGS };
    },
    saveSettings: patch => write(userDoc().set(patch, { merge: true })),

    watchMoments(cb, onError) {
      return moments().orderBy('date', 'desc').onSnapshot(
        snap => cb(snap.docs.map(withId)),
        onError);
    },

    async addMoment(data, prepared, onEach) {
      if (prepared.length) needOnline('Uploading photos');
      const ref = moments().doc();
      const photos = await uploadPhotos('moments', ref.id, prepared, onEach);
      await write(ref.set({ ...data, photos, createdAt: ts(), updatedAt: ts() }));
      return ref.id;
    },

    async updateMoment(moment, data, prepared, removed, onEach) {
      if (prepared.length) needOnline('Uploading photos');
      const added = await uploadPhotos('moments', moment.id, prepared, onEach);
      const gone = new Set(removed.map(p => p.path));
      const photos = [...(moment.photos || []).filter(p => !gone.has(p.path)), ...added];
      await write(moments().doc(moment.id).update({ ...data, photos, updatedAt: ts() }));
      // Delete files only after the entry no longer points at them.
      await Promise.all(removed.flatMap(p => [removeFile(p.path), removeFile(p.thumbPath)])).catch(console.error);
    },

    async deleteMoment(moment) {
      await write(moments().doc(moment.id).delete());
      await Promise.all((moment.photos || []).flatMap(p => [removeFile(p.path), removeFile(p.thumbPath)])).catch(console.error);
    },

    // ----- things to do -----
    watchIdeas(cb, onError) {
      return ideas().onSnapshot(snap => cb(snap.docs.map(withId)), onError);
    },

    async addIdea(data, prepared) {
      if (prepared.length) needOnline('Uploading photos');
      const ref = ideas().doc();
      const photos = await uploadPhotos('ideas', ref.id, prepared);
      await write(ref.set({ ...data, photos, visits: [], createdAt: ts(), updatedAt: ts() }));
      return ref.id;
    },

    async updateIdea(idea, data, prepared, removed) {
      if (prepared.length) needOnline('Uploading photos');
      const added = await uploadPhotos('ideas', idea.id, prepared);
      const gone = new Set(removed.map(p => p.path));
      const photos = [...(idea.photos || []).filter(p => !gone.has(p.path)), ...added];
      await write(ideas().doc(idea.id).update({ ...data, photos, updatedAt: ts() }));
      await Promise.all(removed.flatMap(p => [removeFile(p.path), removeFile(p.thumbPath)])).catch(console.error);
    },

    // Google search near home (runs in the "nearby" server function, which holds the key).
    async nearby(query, home) {
      needOnline('Searching nearby');
      const call = firebase.app().functions('us-east1').httpsCallable('nearby');
      return (await call({ query, home })).data;
    },

    // A pasted Google Maps link -> that place's details (the "fromLink" server function).
    async fromLink(url, home) {
      needOnline('Looking up a link');
      const call = firebase.app().functions('us-east1').httpsCallable('fromLink');
      return (await call({ url, home })).data;
    },

    // Small changes: visits, ratings, "not for now".
    patchIdea: (id, patch) => write(ideas().doc(id).update({ ...patch, updatedAt: ts() })),

    // Visit photos live on the timeline moment, so deleting an idea leaves them there.
    async deleteIdea(idea) {
      await write(ideas().doc(idea.id).delete());
      await Promise.all((idea.photos || []).flatMap(p => [removeFile(p.path), removeFile(p.thumbPath)])).catch(console.error);
    },
  };
})();

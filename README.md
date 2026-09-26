# A&W

Will and Millie's story. Five tabs: **Timeline** (moments, firsts, quotes, growth) · **Right Now** (who each twin is at the moment, with history and growth) · **Home** · **To do** (saved ideas, Suggestions, the wheel, heart ratings) · **Letters** (dated letters to William and Amelia, as sealed envelopes). Keepsake PDF books and backups live in Settings. No streaks, no reminders, nothing is ever "due."

Plain HTML/CSS/JS + Firebase (Auth, Firestore, Storage). Hosted on GitHub Pages, installed to the iPhone home screen.

## Files

| File | What it does |
|---|---|
| `index.html`, `styles.css` | The page and its look (soft nursery; sage = Will, blush = Millie) |
| `app.js` | Home, timeline, add/edit moment, add old photos, settings, sign in, routing |
| `now.js` | Right Now tab: snapshots, history by date or by question |
| `letters.js` | Letters tab: envelopes, stationery, and the seal animation |
| `words.js` | Each twin's word list (from Right Now) and word milestones on the timeline |
| `todo.js` | Things to do: saved ideas, search, Suggestions, the wheel, “We went!” visits and ratings |
| `books.js` | Books (keepsake PDFs), growth chart, backup ZIP (all made on the phone) |
| `store.js` | Everything that talks to Firebase |
| `demo.js` | Sample mode: try the app with made-up moments before Firebase is set up (nothing saved) |
| `photos.js` | Reads the date a photo was taken and shrinks it on the phone before uploading |
| `dates.js` | Ages ("20 months, 1 week") and date formatting |
| `firebase-config.js` | Your Firebase project's public config (paste yours in) |
| `firestore.rules`, `storage.rules` | Security: only your account can see or add anything |
| `cors.json` | Lets the site read its own photos to put them in PDFs and backups |
| `sw.js` | Offline mode: the app and photos you've already seen work with no signal |
| `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Home-screen app: name, icon, full-screen |

## One-time setup

### 1. Firebase project
1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → "A-and-W".
2. Upgrade to **Blaze** (gear → Usage and billing). Enter the card yourself.
3. Set a **budget alert** (Google Cloud Billing → Budgets & alerts → $5).

### 2. Connect the website
1. Project settings → General → **Add app → Web** → name it "A&W".
2. Copy the `firebaseConfig` values into `firebase-config.js`.

### 3. Turn on the pieces
- **Authentication** → Get started → **Email/Password** → Enable.
  - **Users** tab → **Add user** → your email and a password. This is your A&W login.
  - **Settings** → **User actions** → uncheck **Enable create (sign-up)**, so nobody else can make an account.
  - **Settings** → **Authorized domains** → add `glaynebrown.github.io`.
- **Firestore Database** → Create database → Standard edition, `(default)` → `nam5 (United States)` → production mode.
- **Storage** → Get started → `us-central1` → production mode.

### 4. Security rules
Deployed from the Mac (Claude does this):
```
firebase use --add            # pick the A-and-W project
firebase deploy --only firestore:rules,storage
gcloud storage buckets update gs://BUCKET --cors-file=cors.json   # BUCKET = storageBucket in firebase-config.js
```
Without the CORS step, the app works but PDFs and backups can't include photos.

### 5. GitHub Pages
1. New repo **a-and-w** (public is fine: no photos or data live in the code).
2. Upload the site files: `index.html`, `styles.css`, `app.js`, `todo.js`, `books.js`, `now.js`, `words.js`, `letters.js`, `store.js`, `demo.js`, `photos.js`, `dates.js`, `firebase-config.js`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.
3. Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
4. Site: `https://glaynebrown.github.io/a-and-w/`

### 6. On your iPhone
Open the site in Safari → Share → **Add to Home Screen** → sign in once.

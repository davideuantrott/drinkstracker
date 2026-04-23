# AlcoTrack — Claude Code Project Brief

## What this project is

AlcoTrack is a personal alcohol tracking Progressive Web App (PWA) targeting iPhone via Safari "Add to Home Screen". It reproduces the core functionality of the Android app AlcoDroid. The primary user is the repo owner (davideuantrott@googlemail.com).

---

## Current state — Build 2 (active)

Build 1 was a single self-contained HTML file (`alcotracker.html`, ~1600 lines, kept as backup). Build 2, implemented in this repo, is a full Vite project with Supabase auth and cloud sync. **The build compiles cleanly** (`npm run build` — 55 modules, zero errors). Supabase has been configured and Google OAuth is set up. The app is ready to deploy to Vercel.

Recent changes (Build 2.1):
- **BAC formula fixed** — removed erroneous `× 10` from Widmark denominator in `src/bac.js`; values were 10× too small
- **Custom drinks** — manually-entered drinks are auto-saved to `at-customs` localStorage key and appear in a "Saved" section in the add-drink modal; each can be deleted with ×
- **Redesign** — new visual design based on `fitness-app-design-system.jsonc`: deep navy backgrounds, coral/pink→orange gradient accent, Poppins + Roboto Mono fonts

---

## Project structure

```
drinkstracker/
├── index.html              ← app shell HTML (all tab markup lives here)
├── vite.config.js          ← Vite + vite-plugin-pwa config
├── package.json
├── .env.example            ← copy to .env and fill in Supabase keys
├── alcotracker.html        ← Build 1 backup (do not touch)
├── alcotrack-claude-code-handoff.md  ← original feature spec / handoff doc
├── supabase/
│   └── 001_initial.sql     ← paste into Supabase SQL Editor to create tables
└── src/
    ├── main.js             ← entry point; boots app, handles auth state
    ├── style.css           ← all CSS (design tokens, layout, every component)
    ├── bac.js              ← pure BAC calculation functions (Widmark formula)
    ├── auth.js             ← Supabase client + auth helpers
    ├── storage.js          ← state manager: localStorage + Supabase sync layer
    ├── charts.js           ← canvas chart drawing (BAC over time, weekly bars)
    ├── presets.js          ← PRESETS array + getPresetIcon() helper
    └── ui/
        ├── today.js        ← renders Now tab (BAC hero, drink log, delete)
        ├── log.js          ← renders History tab (grouped by day)
        ├── stats.js        ← renders Stats tab + triggers chart redraws
        ├── settings.js     ← renders Profile tab, binds all settings inputs
        ├── modal.js        ← add-drink modal + migration modal logic
        └── auth-screen.js  ← auth UI (Google OAuth + email/password)
```

---

## Design system

Source: `fitness-app-design-system.jsonc` in the repo root.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0D1B3E` | App background (deep navy) |
| `--surface` | `#0F2044` | Cards |
| `--surface2` | `#162B56` | Inputs, chips |
| `--surface3` | `#1A3060` | Alternative surfaces |
| `--accent` | `#FF4D7D` | Primary coral/pink |
| `--accent-end` | `#FF9040` | Gradient end (amber-orange) |
| `--accent2` | `#FFCC00` | Gold — secondary highlights |
| `--green` | `#34d399` | Safe/sober |
| `--amber` | `#fbbf24` | Caution |
| `--red` | `#f87171` | Over limit / danger |
| `--muted` | `#A8C0E8` | Labels, secondary text (periwinkle) |

Primary gradient: `linear-gradient(135deg, #FF4D7D, #FF9040)` — used on FAB, buttons, logo, BAC number.

Fonts: `Poppins` (UI/headings, 400–800) + `Roboto Mono` (numeric values, 300–500).

---

## Architecture — key patterns

**State management:** `src/storage.js` is the single source of truth. It holds `_log` (array) and `_settings` (object) in memory, exposes `getLog()` / `getSettings()`, and handles all persistence. UI modules call these getters — they never hold their own copies of state.

**Sync strategy:** localStorage-first. Every write hits localStorage immediately (so the UI never blocks), then syncs to Supabase async in the background. Failed syncs are queued in `at-sync-queue` localStorage key and retried on connectivity restore (`window.addEventListener('online', processQueue)`). A small coloured dot in the top-right corner shows sync status (amber pulsing = pending, red = error/tap to retry, hidden = synced).

**Auth flow:** `src/auth.js` creates the Supabase client (returns `null` if env vars are absent). `src/main.js` calls `onAuthChange()` which fires on every session change. If no session → show auth screen. If session → hide auth screen, call `pullFromSupabase()`, then check if the user has unmigrated local data and show the migration modal if so.

**Local-only mode:** If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are not set in `.env`, `isSupabaseEnabled` is `false`. The auth screen never appears, all data stays in localStorage. This is intentional — lets the app run in dev without Supabase configured.

**Events between modules:** UI modules never import each other. Cross-module side effects are coordinated via `window.dispatchEvent(new CustomEvent('at:data-changed'))` and `at:settings-changed`. `main.js` listens and re-renders the appropriate tab.

**Offline/migration flow on first login:**
1. `pullFromSupabase()` checks if Supabase has data for this user.
2. If Supabase has data → merge (cloud wins), write merged set to localStorage.
3. If Supabase has NO data AND localStorage has drinks → return `{ hadLocalData: true }`.
4. `main.js` then shows the migration modal ("Add X drinks to your account?").
5. Yes → `migrateLocalToCloud()` upserts all local entries to Supabase.
6. No → local data stays local (user starts fresh in cloud).

---

## Data model

**Drink entry (localStorage + Supabase):**
```js
{
  id: "uuid-v4-string",     // crypto.randomUUID() — same value used as Supabase PK
  timestamp: 1713876000000, // Unix ms
  name: "Pint Lager",
  volumeMl: 568,
  abv: 4.5,
  cost: 5.00                // 0 if not entered
}
```

**localStorage keys:**
| Key | Contents |
|---|---|
| `at-log` | JSON array of drink entries |
| `at-settings` | JSON settings object |
| `at-sync-queue` | JSON array of pending sync ops |
| `at-migrated` | `"true"` after first migration |
| `at-customs` | JSON array of user-saved custom drink presets |

**Supabase tables:** `drink_log` and `user_settings` — see `supabase/001_initial.sql` for full schema. Both have Row Level Security enforced; users can only see/write their own rows.

---

## Setup required before the app is live

The code is complete and builds. These are one-time infrastructure steps the user needs to do:

### 1. Create a Supabase project
- Go to [supabase.com](https://supabase.com) → New Project
- Choose a name (e.g. `alcotrack`), set a DB password, pick a nearby region
- Wait ~1 minute for provisioning

### 2. Run the database migration
- Supabase dashboard → **SQL Editor → New query**
- Paste the full contents of `supabase/001_initial.sql`
- Click **Run**

### 3. Enable Google OAuth (optional but recommended)
**In Supabase:**
- Authentication → Providers → Google → Enable

**In Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):
- APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application
- Add to **Authorised redirect URIs**:
  - `http://localhost:5173`
  - `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
- Copy Client ID + Secret back into Supabase's Google provider settings

### 4. Create `.env` file
```bash
cp .env.example .env
```
Fill in values from Supabase → Project Settings → API:
```
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
`.env` is gitignored — never commit it.

### 5. Run locally
```bash
npm install      # if on a new machine
npm run dev      # opens http://localhost:5173
```

### 6. Deploy to Vercel
- Push repo to GitHub (already done), connect in Vercel
- Vercel → Project Settings → Environment Variables: add the two `VITE_SUPABASE_*` vars
- Also add the Vercel deployment URL to Supabase → Authentication → URL Configuration → Site URL, and add it to Google OAuth's authorised redirect URIs

---

## Commands

```bash
npm run dev      # local dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

---

## What's planned for Build 3

From `alcotrack-claude-code-handoff.md`:

### AlcoDroid data import
- UI in Profile tab → Data section: "Import from AlcoDroid"
- Accepts `.backup` / `.db` (SQLite via sql.js WebAssembly) or `.csv`
- Shows preview card ("Found 347 drinks from Jun 2019 – Apr 2026")
- Options: Merge with existing / Replace all data
- Deduplication on `(timestamp, volumeMl, abv)` after import
- After import, sync to Supabase via the existing sync layer

### Drink edit
- Currently drinks can only be deleted and re-added
- Needs an edit flow (tap entry → edit sheet → save)

### Magic link / passwordless auth
- Third auth option in the auth screen alongside Google and email/password
- Supabase supports this out of the box: `supabase.auth.signInWithOtp({ email })`

### Known tech debt
| Item | Notes |
|---|---|
| No PWA icons | `vite-plugin-pwa` config has no icons — add `pwa-192x192.png` and `pwa-512x512.png` to `public/` and reference them in `vite.config.js` manifest |
| BAC chart uses raw canvas | Works fine; could move to Chart.js for maintainability |
| No data validation on import | Add min/max sanity checks on `volumeMl` and `abv` |
| Calories are approximate | Label more clearly in UI |
| Custom drinks not synced to cloud | `at-customs` is localStorage-only; could add a `user_customs` Supabase table if needed |

---

## Key function reference

| Function | File | What it does |
|---|---|---|
| `calcBACPermille(drinks, settings)` | `src/bac.js` | Widmark formula, returns current BAC in permille |
| `calcBACAtTime(drinks, t, settings)` | `src/bac.js` | BAC at a specific timestamp (used for chart) |
| `calcUnits(volumeMl, abv)` | `src/bac.js` | UK units = `(vol × abv) / 1000` |
| `initStorage()` | `src/storage.js` | Load from localStorage, migrate old IDs to UUIDs |
| `addLogEntry(entry)` | `src/storage.js` | Write to localStorage + queue Supabase upsert |
| `deleteLogEntry(id)` | `src/storage.js` | Remove from localStorage + queue Supabase delete |
| `saveSettings(s)` | `src/storage.js` | Persist settings locally + sync to Supabase |
| `pullFromSupabase()` | `src/storage.js` | Fetch cloud data on login, merge with local |
| `migrateLocalToCloud()` | `src/storage.js` | Push all local entries to Supabase (first-login migration) |
| `processQueue()` | `src/storage.js` | Flush pending offline sync operations |
| `renderToday()` | `src/ui/today.js` | Re-render Now tab (BAC, stats row, drink list) |
| `renderLog()` | `src/ui/log.js` | Re-render History tab |
| `renderStats()` | `src/ui/stats.js` | Re-render Stats tab + redraw both charts |
| `loadSettingsForm()` | `src/ui/settings.js` | Populate settings form from current state |
| `getCustomDrinks()` | `src/storage.js` | Return array of user-saved custom drink presets |
| `saveCustomDrink(drink)` | `src/storage.js` | Save a custom drink (deduplicates by name+vol+abv) |
| `deleteCustomDrink(id)` | `src/storage.js` | Remove a custom drink by id |
| `openModal()` | `src/ui/modal.js` | Open the add-drink bottom sheet |
| `showAuthScreen()` | `src/ui/auth-screen.js` | Show auth overlay, hide app |
| `hideAuthScreen()` | `src/ui/auth-screen.js` | Hide auth overlay, show app |

# AlcoTrack — Claude Code Project Brief

## What this project is

AlcoTrack is a personal alcohol tracking Progressive Web App (PWA) targeting iPhone via Safari "Add to Home Screen". It reproduces the core functionality of the Android app AlcoDroid. The primary user is the repo owner (davideuantrott@googlemail.com).

---

## Current state — Build 2.7 (live)

Build 1 was a single self-contained HTML file (`alcotracker.html`, ~1600 lines, kept as backup). Build 2, implemented in this repo, is a full Vite project with Supabase auth and cloud sync. **The app is live and fully functional.**

Infrastructure:
- **Supabase** — project created, DB migrated, Google OAuth enabled; three tables: `drink_log`, `user_settings`, `user_customs`
- **Vercel** — deployed and connected to this GitHub repo (auto-deploys on push to main); `VITE_SUPABASE_*` env vars set in Vercel project settings
- **Google OAuth** — OAuth 2.0 client configured; Vercel URL added to authorised redirect URIs; Supabase Site URL updated to Vercel deployment URL

Build compiles cleanly (`npm run build` — 56 modules, zero errors).

Changes made in Build 2.1:
- **BAC formula fixed** — removed erroneous `× 10` from Widmark denominator in `src/bac.js`; values were 10× too small
- **Custom drinks** — manually-entered drinks are auto-saved to `at-customs` localStorage key and appear in a "Saved" section in the add-drink modal; each can be deleted with ×
- **Redesign** — new visual design based on `fitness-app-design-system.jsonc`: deep navy backgrounds, coral/pink→orange gradient accent, Poppins + Roboto Mono fonts

Changes made in Build 2.2:
- **Custom drink sync** — `user_customs` Supabase table added (`supabase/002_user_customs.sql`); `saveCustomDrink`/`deleteCustomDrink` push immediately; `pullFromSupabase` merges cloud customs on login so saved drinks appear on all devices
- **Live BAC chart on Now tab** — canvas chart below the BAC hero; colored gradient fill (green→amber→red keyed to legal limit), dashed limit line, vertical current-time marker, sober-time annotation; redraws every 60s via existing ticker
- **Quick-add chips on Now tab** — last 3 unique drink types from log history shown as chips; tap to add instantly at current time; hidden when log is empty
- **Enhanced Stats charts** — DAILY/WEEKLY/MONTHLY tab switcher replaces the two fixed chart cards; Daily shows BAC trend for today; Weekly shows 7-day bars + yellow 7-day rolling average line; Monthly shows 30-day bars + 30-day rolling average line

Changes made in Build 2.3:
- **BAC continuity across midnight** — BAC calculation on the Now tab uses a 24 h lookback window (`bacDrinks`) so drinks consumed just before midnight continue decaying correctly into the next morning; stats row (units/drinks/cals) still shows today-only figures
- **Pannable Now-tab chart** — horizontal swipe on the BAC chart scrolls back up to 3 days; a date label appears in the top-right when panned; the now-marker hides when it scrolls off-screen; vertical swipes still scroll the page normally
- **Safe-area / Dynamic Island padding** — `#main-content` gains `padding-top: env(safe-area-inset-top)` so the BAC hero clears the iPhone notch/Dynamic Island; sync dot position adjusted to match; today-tab drink list gains 80 px bottom padding so the last entry is never hidden under the FAB
- **Legal Limit setting fix** — `parseFloat(0.80)` → `0.8` didn't match the `"0.80"` select option string; fixed with `.toFixed(2)` in `loadSettingsForm` so the saved value always round-trips correctly
- **Log page delete & edit** — History tab entries now show a ✏ edit button (opens the add-drink modal pre-filled with existing values; button label changes to "Save Changes") and a ✕ delete button (asks for confirmation); the `at:edit-drink` custom event bridges log→modal without cross-importing

Changes made in Build 2.4:
- **UK retail drinks library** — `src/drinks-library.json` contains 109 curated entries (lagers, ales, stouts, ciders, RTDs, small-format wines) with accurate ABV and standard UK retail volumes; a one-off Node.js scraper (`scripts/fetch-off-drinks.mjs`) queries Open Food Facts to expand and back-fill EAN barcodes
- **Library search in add-drink modal** — a search box at the top of the modal filters the library as the user types; up to 8 matching results appear as tappable rows (name + volume + ABV); tapping pre-fills the form and restores the normal preset view; zero-state UI is unchanged

Changes made in Build 2.5:
- **BAC pool-model fix** — replaced per-drink independent metabolism with a running-pool model in `src/bac.js`; the old approach applied the 0.15‰/h elimination rate to each drink individually, causing it to under-report BAC significantly when multiple drinks were consumed close together (e.g. three pints spread over ~90 min showed ~20% low at peak, dropping to zero ~1.5 h earlier than correct); both `calcBACPermille` and `calcBACAtTime` now use the same `_poolBAC` helper so the Now tab and the BAC chart are both corrected

Changes made in Build 2.6:
- **BAC bar spacing fix** — increased `.bac-status` `margin-top` from 12 px to 28 px so the amber "LIMIT" label on the bar doesn't collide with the "Below Legal Limit" status text
- **Bottom nav alignment fix** — changed `align-items: flex-start` → `align-items: center` on `#bottom-nav`; icons now sit vertically centred in the 72 px bar with the safe-area inset correctly reserved below, eliminating dead space
- **Per-entry emoji picker** — the add/edit modal now shows a row of 12 drink emoji buttons; the chosen emoji is stored as an `icon` field on each log entry and displayed in the Now tab and History tab; preset/saved/library selections auto-pick a matching emoji; requires `supabase/003_drink_icon.sql` (`ALTER TABLE drink_log ADD COLUMN IF NOT EXISTS icon TEXT`) to sync icons cross-device

Changes made in Build 2.7:
- **Retrospective drink logging** — the add-drink modal now has a Date field alongside the existing Time field; new drinks default to today, edits default to the drink's original date; the `_addDrink()` timestamp is built from both fields using local time (not UTC) so historical entries are logged accurately; date picker is capped at today to prevent future entries
- **Bottom nav dead-space fix** — `#bottom-nav` now uses `align-items: flex-start` with `.nav-btn` explicitly sized to `height: 72px` and `justify-content: center`; icons are centred in the 72 px content zone only, and the safe-area inset below is truly empty (no longer pulling icons down into it)

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
├── scripts/
│   └── fetch-off-drinks.mjs ← one-off Node 18+ script: queries Open Food Facts for UK alcohol products and merges into drinks-library.json
├── supabase/
│   ├── 001_initial.sql     ← drink_log + user_settings tables + RLS
│   └── 002_user_customs.sql ← user_customs table + RLS (run after 001)
└── src/
    ├── main.js             ← entry point; boots app, handles auth state
    ├── style.css           ← all CSS (design tokens, layout, every component)
    ├── bac.js              ← pure BAC calculation functions (Widmark formula)
    ├── auth.js             ← Supabase client + auth helpers
    ├── storage.js          ← state manager: localStorage + Supabase sync layer
    ├── charts.js           ← canvas charts: now BAC, daily BAC, weekly/monthly bars
    ├── presets.js          ← PRESETS array + getPresetIcon() helper
    ├── drinks-library.json ← 109-entry curated UK retail drinks (name, volumeMl, abv, category, ean)
    └── ui/
        ├── today.js        ← renders Now tab (BAC hero, live chart, quick-add, drink log)
        ├── log.js          ← renders History tab (grouped by day)
        ├── stats.js        ← renders Stats tab (DAILY/WEEKLY/MONTHLY chart tabs)
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

**Supabase tables:** `drink_log`, `user_settings`, and `user_customs` — see `supabase/001_initial.sql` and `supabase/002_user_customs.sql`. All three have Row Level Security enforced; users can only see/write their own rows.

---

## Local development setup

```bash
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # http://localhost:5173
```

`.env` is gitignored — never commit it.

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
| `renderToday()` | `src/ui/today.js` | Re-render Now tab (BAC, live chart, quick-add, drink list) |
| `drawNowBACChart(canvas, drinks, settings, panOffsetMs)` | `src/charts.js` | Live BAC chart for Now tab; panOffsetMs shifts window back in time (0–3 days); returns msPerPx for touch handler |
| `drawDailyBACChart(canvas, drinks, settings)` | `src/charts.js` | BAC trend chart for Stats DAILY tab |
| `drawWeeklyChart(canvas, log)` | `src/charts.js` | 7-day bar chart + rolling avg for Stats WEEKLY tab |
| `drawMonthlyChart(canvas, log)` | `src/charts.js` | 30-day bar chart + rolling avg for Stats MONTHLY tab |
| `renderLog()` | `src/ui/log.js` | Re-render History tab |
| `renderStats()` | `src/ui/stats.js` | Re-render Stats tab + redraw active chart tab |
| `loadSettingsForm()` | `src/ui/settings.js` | Populate settings form from current state |
| `getCustomDrinks()` | `src/storage.js` | Return array of user-saved custom drink presets |
| `saveCustomDrink(drink)` | `src/storage.js` | Save a custom drink (deduplicates by name+vol+abv) |
| `deleteCustomDrink(id)` | `src/storage.js` | Remove a custom drink by id |
| `openModal()` | `src/ui/modal.js` | Open the add-drink bottom sheet (new drink) |
| `openEditModal(drink)` | `src/ui/modal.js` | Open the add-drink modal pre-filled for editing an existing entry |
| `_onLibrarySearch()` | `src/ui/modal.js` | Filters `DRINKS_LIBRARY` on input, renders result rows, hides preset section |
| `_selectLibraryEntry(drink)` | `src/ui/modal.js` | Pre-fills form from a library entry, resets search |
| `showAuthScreen()` | `src/ui/auth-screen.js` | Show auth overlay, hide app |
| `hideAuthScreen()` | `src/ui/auth-screen.js` | Hide auth overlay, show app |

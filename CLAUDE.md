# AlcoTrack — Claude Code Project Brief

## What this project is

AlcoTrack is a personal alcohol tracking Progressive Web App (PWA) targeting iPhone via Safari "Add to Home Screen". It reproduces the core functionality of the Android app AlcoDroid. The primary user is the repo owner (davideuantrott@googlemail.com).

---

## Current state — Build 3.4 (live)

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
- **Bottom nav dead-space fix (final)** — `#bottom-nav` is now a flat `72px` with no safe-area component; the body background (`#0D1B3E`) fills the home-indicator zone below it naturally (same colour, seamless); previous attempts kept `height: calc(72px + safe-area)` which painted the navy background over the full height, creating visible dead space regardless of icon alignment

Changes made in Build 2.8:
- **Previously Logged section in add-drink modal** — a "Previously Logged" chip grid appears below the Saved section in the modal; shows every unique drink from the full log (deduped by name+vol+abv, most-recent-first); tapping a chip pre-fills the form and sets `_presetSelected = true` so the drink is not auto-saved as a custom; section is hidden when the log is empty; implemented in `src/ui/modal.js` (`_buildRecentGrid`) following the same pattern as the existing Saved/Presets sections

Changes made in Build 2.9:
- **PWA icons** — added `public/icons/android/` (192, 512 px) and `public/icons/ios/` (180 px) copied from the `icons/` folder; `vite.config.js` manifest now declares all three icon sizes (512 also flagged `any maskable`); `index.html` adds `<link rel="apple-touch-icon" href="/icons/ios/180.png">` for iOS home-screen quality
- **Chart x-axis label overlap fixed** — `drawNowBACChart` now computes step size from available canvas width (`cW / 42 px per label`) instead of hardcoded thresholds, ensuring labels never crowd regardless of window size
- **Chart scroll direction fixed** — swipe right now pans back in time, swipe left returns toward present (changed sign in `_panAtStart + dx * _msPerPx`)
- **Auto-update for all users** — `src/main.js` listens for the service worker `controllerchange` event and reloads the page; combined with `registerType: 'autoUpdate'` in vite-plugin-pwa this means every Vercel deploy automatically propagates to all open clients within one page lifecycle

Changes made in Build 3.0:
- **Y-axis labels on all charts** — all canvas charts (Now BAC, Daily BAC, Weekly bars, Monthly bars, Cals bars) now show numeric Y-axis labels on the left; PL increased from 4–6 px to 28 px to create a proper label column; gridlines labelled at 5 evenly-spaced positions; BAC charts label in ‰, bar charts label in units (1 dp) or kcal (integer)
- **Calories in Stats** — `_buildDays` in `charts.js` now computes `cals` alongside `units` using `approxCalories`; Stats tab shows two new stat-card boxes (Week kcal, Month kcal); a new **CALS** chart tab shows 30-day calorie bars with rolling average; exported as `drawCalsChart`
- **Edit button on Today tab** — drink entries on the Now tab now have an ✏ edit button (dispatches `at:edit-drink`) matching the existing History tab behaviour
- **Duplicate button on History tab** — each History entry now has a ⎘ duplicate button; dispatches `at:duplicate-drink`; `openDuplicateModal(drink)` in `modal.js` opens the modal pre-filled with the drink's values at current time with `_editId = null` so it saves as a new entry
- **Unified search in add-drink modal** — the library-only search is replaced with a single search bar ("Search drinks, history & library…") that queries log history, Quick Select presets, and the 109-entry library simultaneously; results are grouped by source ("From your history", "Quick select", "From library"); all results use the same list-row format (icon + name + vol/ABV)
- **Modal sections renamed and clarified** — "Saved" → **My Presets** (subtitle: "your saved drinks"); "Previously Logged" → **Recent** (subtitle: "everything you've logged before")
- **Recent section converted to list** — previously a chip grid, Recent drinks now appear as full-width list rows showing emoji, name, volume, and ABV — consistent with unified search results
- **Vol + ABV on all chips** — Quick Select and My Presets chips now show a third line of metadata (e.g. "568ml · 4.5%") below the name so users can distinguish similar drinks at a glance

Changes made in Build 3.1:
- **Form moved to top of add-drink modal** — form fields (name, icon, vol/ABV, cost, date/time) and the Log Drink / Cancel buttons are now positioned above the preset/history sections in `index.html`; the form is visible immediately on open without any scrolling
- **Recent list capped at 10** — `_buildRecentList()` in `src/ui/modal.js` breaks after collecting 10 unique entries (deduped by name+vol+abv); the unified search bar at the top already searches full history so longer history is still accessible via search
- **Recent list scroll-contained** — `#recent-list` in `src/style.css` gets `max-height: 220px; overflow-y: auto` so the list scrolls within its own box (~3–4 visible rows) rather than extending the page
- **"or choose from saved" divider** — a `.modal-section-divider` element with flanking hairlines separates the form from the Quick Select / My Presets / Recent sections; hidden automatically when unified search is active

Changes made in Build 3.2:
- **BAC chart / readout discrepancy fixed** — the Now chart could draw the curve below the legal-limit line while the hero readout above it said "Over legal limit". Three causes, all fixed:
  - **Exact curve knots instead of fixed sampling** — both BAC charts sampled 120 evenly-spaced points across their window. On the Now chart that window stretched back to the oldest drink in the 4-day pan buffer, so each sample covered ~50 min and every peak was clipped by up to 50 min × 0.15‰/h (~0.13‰). `bacCurvePoints(drinks, tStart, tEnd, settings)` in `src/bac.js` now returns the exact knots of the piecewise-linear pool model (a vertical step at each drink, constant decay in between, plus zero-crossings), so the drawn value at the now-marker equals `calcBACPermille` exactly
  - **Default window is now the last 12 h** — `drawNowBACChart` no longer stretches `tStart` back to the first drink in the buffer; older drinking is reached by panning (still up to 3 days), which is what the pan gesture was for
  - **Chart labels follow the BAC unit setting** — Y-axis gridline labels and the LIMIT line ran through `toFixed(2)` (raw permille) while the hero showed `% BAC`; both charts now format via `formatBAC(v, settings.bacUnit)`, the limit line is labelled with its value ("LIMIT 0.080"), and the left gutter is measured from the widest label instead of a fixed 28 px that clipped `%` labels
- **Hero and chart share one drink set** — `renderToday()` computed the hero BAC from a 24 h lookback but drew the chart from a 4-day one; both now use the same 4-day list, so the number and the curve can never diverge

Changes made in Build 3.3:
- **BAC model is now deliberately conservative** — every parameter in `src/bac.js` moved to the cautious end of its published range, so the displayed number is a high estimate rather than a central one:
  - **Widmark `r` at one SD below the mean** — 0.68 → 0.595 (male), 0.55 → 0.495 (female). Widmark's own SDs are ±0.085 / ±0.055; a lower `r` means a smaller volume of distribution and so a higher BAC. Covers roughly 84% of people rather than 50%
  - **Blood-density conversion added** — Widmark's `r` was derived with BAC expressed per unit *mass* of blood (g/kg) while legal limits are per unit *volume* (mg/100 ml), so the dose is multiplied by 1.055 (the high end of the quoted specific-gravity range). Adds ~5%
  - **Elimination at 0.10‰/h** (was 0.15) — the slow end of the ~0.10–0.20 population range. Holds BAC higher through a session and pushes the sober estimate later. Note this compounds with elapsed time: a morning-after reading is several times higher than a 0.15‰/h model would give
  - **30-minute absorption ramp** — a drink no longer lands as an instant vertical step; each dose absorbs linearly over 30 min from its timestamp (drinks are logged at the last sip, so some absorption has already happened, but not all)
- **One curve, one model** — `_curve()` builds the exact piecewise-linear knots (absorption ramps in, elimination drains whenever anything is left) and `calcBACPermille`, `calcBACAtTime`, `bacCurvePoints`, `peakAhead`, `soberAt` and `belowLimitAt` all read off it. This removed the duplicated model that the old `_poolBAC` / `bacCurvePoints` pair carried
- **Pending peak surfaced on the Now tab** — with absorption modelled, a drink logged two minutes ago shows a near-zero current BAC while a much higher peak is 30 min away. The hero now shows an amber "↑ Still absorbing — peaks at X in ~Nm" line, and the status verdict uses `max(current, peak)` so it reads "Heading over legal limit" rather than "Below legal limit"
- **Time-to-legal alongside time-to-sober** — `belowLimitAt()` finds the last downward crossing of the configured limit (so a pending peak pushes it out), shown as "Under 0.080 in ~1h 29m · sober in ~9h 29m"
- **Legal-limit picker labelled by jurisdiction** — "0.50 ‰ — Scotland", "0.80 ‰ — England/Wales/NI"
- **Standing disclaimer under the hero** — "Conservative estimate — never a fitness-to-drive decision"

Changes made in Build 3.4:
- **Rounded chart lines** - all polyline paths in `src/charts.js` (both BAC curves and the rolling-average line on the Weekly/Monthly/Cals bar charts) now run through a shared `_roundedPath()` helper that replaces each interior vertex with a short quadratic arc, so the lines read as curves rather than straight runs meeting at sharp angles. The arc leaves and rejoins the legs `CURVE_R` (9) px out from the corner, capped at 40% of the shorter leg so closely-spaced knots are never swallowed. The fill under each BAC curve traces the same rounded path so it stays flush with the stroke
- **Why corner-cutting and not a spline** - a Catmull-Rom or through-points bezier overshoots between knots, inventing peaks the BAC model never produced; that would undo the Build 3.2 fix which made the charts draw exact curve knots. Corner-cutting only ever pulls *inside* the polyline, so the drawn curve stays within the true envelope. Measured worst case on a sharp peak: the apex sits ~1.9 px lower than the exact knot, purely cosmetic - the hero readout is still the authoritative number

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
│   ├── 002_user_customs.sql ← user_customs table + RLS (run after 001)
│   └── 003_drink_icon.sql  ← adds drink_log.icon so emoji sync cross-device (run after 002)
├── public/
│   └── icons/              ← PWA icons (android/192, android/512, ios/180)
└── src/
    ├── main.js             ← entry point; boots app, handles auth state
    ├── style.css           ← all CSS (design tokens, layout, every component)
    ├── bac.js              ← the whole BAC model: one curve, read by everything (see BAC model reference)
    ├── auth.js             ← Supabase client + auth helpers
    ├── storage.js          ← state manager: localStorage + Supabase sync layer
    ├── charts.js           ← canvas charts: now BAC, daily BAC, weekly/monthly/cals bars
    ├── presets.js          ← PRESETS array + getPresetIcon() helper
    ├── drinks-library.json ← 109-entry curated UK retail drinks (name, volumeMl, abv, category, ean)
    └── ui/
        ├── today.js        ← renders Now tab (BAC hero, live chart, quick-add, drink log)
        ├── log.js          ← renders History tab (grouped by day)
        ├── stats.js        ← renders Stats tab (DAILY/WEEKLY/MONTHLY/CALS chart tabs)
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
  cost: 5.00,               // 0 if not entered
  icon: "🍺"                // per-entry emoji (Build 2.6); needs supabase/003 to sync
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

**Supabase tables:** `drink_log`, `user_settings`, and `user_customs` — see `supabase/001_initial.sql`, `supabase/002_user_customs.sql`, and `supabase/003_drink_icon.sql`. All three have Row Level Security enforced; users can only see/write their own rows.

---

## BAC model reference

All of this lives in `src/bac.js`. Read this before changing any constant — each
one was chosen deliberately, and they compound.

### The equation

For each drink, the dose in permille is

```
dose‰ = (volumeMl × abv/100) × 0.789 × 1.055 / (weightKg × r)
```

That dose is absorbed **linearly over 30 minutes** from the drink's timestamp,
and the body eliminates at a flat **0.10‰/h** whenever anything is left in the
pool. `_curve()` walks the breakpoints (every ramp start and end) and emits the
exact piecewise-linear knots; everything else — current BAC, chart curves, peak,
sober time, time-to-legal — reads off that one curve.

### Constants and why they are where they are

| Constant | Value | Rationale |
|---|---|---|
| `r` male | **0.595** | Widmark mean 0.68 − 1 SD (0.085). Lower `r` = smaller volume of distribution = higher BAC. Covers ~84% of people |
| `r` female | **0.495** | Widmark mean 0.55 − 1 SD (0.055) |
| blood density | **1.055** | Widmark's `r` was derived with BAC per unit *mass* of blood (g/kg); legal limits are per unit *volume* (mg/100 ml). Quoted specific gravity runs ~1.03–1.055; we take the high end. Adds ~5% |
| elimination | **0.10‰/h** | Population range ~0.10–0.20‰/h. Slow end holds BAC higher through a session *and* pushes sober later |
| absorption | **30 min linear** | Drinks are logged at the last sip, so some absorption has already happened — but not all |
| ethanol density | 0.789 g/ml | Physical constant, not a choice |

Together these read roughly **20% above** a textbook Widmark calculation, and
clear roughly **50% slower**. That is the intent: the number is a high estimate,
not a central one.

**The elimination rate compounds with elapsed time and the other constants do
not.** Peak readings sit ~20% above a standard model; a morning-after reading
after a heavy night can be 3× higher, because 0.10 vs 0.15‰/h diverges every
hour that passes. If the morning-after numbers ever become noise the user learns
to ignore, **0.12‰/h** is the obvious dial to turn — still cautious, far less
divergent over long gaps. Considered and deliberately not taken in Build 3.3.

### Reference values (75 kg male, 0.80‰ limit)

Useful as a regression check after touching the model:

| Drink | Peak | Under 0.80‰ after | Sober after |
|---|---|---|---|
| 1 pint 4.5% (2.6 units) | 0.427‰ | never over | 4h 46m |
| 175 ml wine 13% (2.3 units) | 0.374‰ | never over | 4h 15m |
| 750 ml cider 6.8% (5.1 units) | 0.901‰ | 1h 31m | 9h 31m |
| 4 pints over 3 h (10.2 units) | 1.557‰ | 8h 4m | 16h 4m |

Times are measured from the last sip.

### Rules that fall out of the model

- **The verdict must use `max(current, peakAhead)`.** Modelling absorption means
  a drink logged two minutes ago reads near zero while a much higher peak is
  half an hour out — a naive "current BAC vs limit" check would say "Below legal
  limit" at the single most misleading moment. `renderToday()` shows the amber
  "still absorbing" line and takes the peak into the status text.
- **Charts must read `bacCurvePoints`, never their own sampling.** Fixed
  sampling clips peaks (see Build 3.2).
- **Units and calories are unaffected** by any of this — they are objective
  figures from volume and ABV, so they stay comparable with any other tracker.

### Not modelled

Food, drinking speed, gastric emptying, medication, illness, tolerance, and any
individual variation beyond sex and weight. UK limits for reference: **80 mg per
100 ml** in England/Wales/NI, **50 mg** in Scotland (both selectable in Profile).


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

## What's planned for Build 4

From `alcotrack-claude-code-handoff.md`:

### AlcoDroid data import
- UI in Profile tab → Data section: "Import from AlcoDroid"
- Accepts `.backup` / `.db` (SQLite via sql.js WebAssembly) or `.csv`
- Shows preview card ("Found 347 drinks from Jun 2019 – Apr 2026")
- Options: Merge with existing / Replace all data
- Deduplication on `(timestamp, volumeMl, abv)` after import
- After import, sync to Supabase via the existing sync layer

### Personalised Widmark factor via Watson TBW — evaluated, deferred (Aug 2026)

Replace the flat sex-based `r` with one derived from the user's own body water.
[Watson (1980)](https://www.semanticscholar.org/paper/Total-body-water-volumes-for-adult-males-and-from-Watson-Watson/098d4cd37a32284694c80751c112d6f00ca23ce0)
estimates total body water from anthropometry:

```
male:    TBW = 2.447 − 0.09156 × age + 0.1074 × height_cm + 0.3362 × weight_kg
female:  TBW = −2.097            + 0.1069 × height_cm + 0.2466 × weight_kg
r = TBW / (0.8 × weight_kg)          // blood is ~80% water by mass
```

**Inputs needed:** height and age — nothing else; sex and weight are already in
Profile. Age should be stored as year of birth so it does not go stale. The
female equation does not use age at all.

**Why it was deferred:** Watson-derived `r` comes out *higher* than Widmark's
constants for most builds, and a higher `r` means a lower BAC. Worked examples
against the current fixed values:

| Body | Watson `r` | current `r` | cider peak (Watson / current) |
|---|---|---|---|
| M, 40, 178 cm, 75 kg | 0.719 | 0.595 | 0.79‰ / 0.95‰ |
| M, 25, 190 cm, 80 kg | 0.742 | 0.595 | 0.72‰ / 0.89‰ |
| M, 60, 170 cm, 80 kg | 0.658 | 0.595 | 0.81‰ / 0.89‰ |
| F, 40, 165 cm, 65 kg | 0.607 | 0.495 | 1.08‰ / 1.32‰ |

For an average-build man that is a ~17% drop — the 5.1-unit cider goes back
under the limit. That is not Watson being wrong; personalising removes the
uncertainty the one-SD margin was insuring against, so a better model *earns* a
narrower margin. Adopting it means either accepting ~10% lower readings (margin
re-derived from the Watson residual rather than the population SD of `r`), or
applying a flat haircut sized to preserve today's numbers — which makes the
personalisation largely cosmetic. Build 3.3 chose caution over precision.

**Two traps if it is ever picked up:**
- Watson **over-estimates TBW in obesity** (fat is ~10% water), inflating `r`
  and under-stating BAC — the failure mode points the wrong way for the group
  most at risk. Fall back to the fixed constant above ~30 BMI.
- **Body-fat % beats height.** `lean = W × (1 − bodyfat)`, `TBW ≈ 0.72 × lean`,
  `r = TBW / (0.8 × W)` is more direct and has no obesity failure mode. One
  optional field, better answer than two — but only worth it if the user
  actually tracks body fat.

Suggested shape if built: height and year of birth as **optional** fields, Watson
used only when both are filled, fixed constants otherwise, and an optional
body-fat field that overrides Watson when present. Nothing regresses for a fresh
install.

### Magic link / passwordless auth
- Third auth option in the auth screen alongside Google and email/password
- Supabase supports this out of the box: `supabase.auth.signInWithOtp({ email })`

### Known tech debt
| Item | Notes |
|---|---|
| BAC charts use raw canvas | Works fine; could move to Chart.js for maintainability |
| No data validation on import | Add min/max sanity checks on `volumeMl` and `abv` |
| Calories are approximate | Labelled "~" in UI; consider a tooltip explaining the Widmark-based estimate |
| BAC constants are a deliberate upper bound | Conservative `r`, blood density, elimination and absorption stack multiplicatively; readings run ~20% above a textbook Widmark calculation and clear ~50% slower. Intentional, but it means numbers will not match AlcoDroid or online calculators |
| `r` is still sex-based, not body-composition-based | A height + age (Watson TBW) or body-fat input would personalise it — evaluated and deferred, see Build 4 notes above for formulas and the accuracy/caution trade-off |
| Elimination rate is not user-adjustable | 0.10‰/h is hardcoded; 0.12 is the obvious fallback if morning-after readings prove too alarmist. See the BAC model reference |

---

## Key function reference

| Function | File | What it does |
|---|---|---|
| `calcBACPermille(drinks, settings)` | `src/bac.js` | Current BAC in permille, read off the conservative curve |
| `calcBACAtTime(drinks, t, settings)` | `src/bac.js` | BAC at a specific timestamp |
| `bacCurvePoints(drinks, tStart, tEnd, settings)` | `src/bac.js` | Exact knots of the BAC curve clipped to a window — used by both BAC charts, so peaks are never clipped by sampling |
| `peakAhead(drinks, settings, fromT)` | `src/bac.js` | Highest BAC still to come `{t, v}` — non-zero while a drink is still absorbing |
| `soberAt(drinks, settings, fromT)` | `src/bac.js` | Timestamp the curve reaches zero, or null if already there |
| `belowLimitAt(drinks, settings, limit, fromT)` | `src/bac.js` | Timestamp the curve drops below `limit` for good (accounts for a pending peak) |
| `formatDuration(ms)` | `src/bac.js` | "1h 29m" / "45m" for the sober/legal countdowns |
| `calcUnits(volumeMl, abv)` | `src/bac.js` | UK units = `(vol × abv) / 1000` |
| `initStorage()` | `src/storage.js` | Load from localStorage, migrate old IDs to UUIDs |
| `addLogEntry(entry)` | `src/storage.js` | Write to localStorage + queue Supabase upsert |
| `deleteLogEntry(id)` | `src/storage.js` | Remove from localStorage + queue Supabase delete |
| `saveSettings(s)` | `src/storage.js` | Persist settings locally + sync to Supabase |
| `pullFromSupabase()` | `src/storage.js` | Fetch cloud data on login, merge with local |
| `migrateLocalToCloud()` | `src/storage.js` | Push all local entries to Supabase (first-login migration) |
| `processQueue()` | `src/storage.js` | Flush pending offline sync operations |
| `renderToday()` | `src/ui/today.js` | Re-render Now tab (BAC, live chart, quick-add, drink list) |
| `drawNowBACChart(canvas, drinks, settings, panOffsetMs)` | `src/charts.js` | Live BAC chart for Now tab; shows the last 12 h by default, panOffsetMs shifts that window back in time (0–3 days); returns msPerPx for touch handler |
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
| `openDuplicateModal(drink)` | `src/ui/modal.js` | Open the add-drink modal pre-filled from an existing entry but saves as new (current time) |
| `_onUnifiedSearch()` | `src/ui/modal.js` | Searches log history + presets + library on input; renders grouped results; hides preset sections |
| `_buildRecentList()` | `src/ui/modal.js` | Builds the "Recent" list of unique previously-logged drinks as full-width rows |
| `drawCalsChart(canvas, log)` | `src/charts.js` | 30-day calorie bar chart + rolling avg for Stats CALS tab |
| `showAuthScreen()` | `src/ui/auth-screen.js` | Show auth overlay, hide app |
| `hideAuthScreen()` | `src/ui/auth-screen.js` | Hide auth overlay, show app |

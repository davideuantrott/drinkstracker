# AlcoTrack PWA - Claude Code Handoff

## Project Overview

AlcoTrack is a personal alcohol tracking Progressive Web App (PWA) built as a single HTML file, designed to reproduce the core functionality of the Android app AlcoDroid. The primary target platform is iPhone via Safari "Add to Home Screen". The app runs entirely client-side with no backend - all data is stored in `localStorage`.

---

## Current State (v0.1 - Build 1)

### File

- `alcotracker.html` - single self-contained file, ~1,600 lines
- No build system, no dependencies, no npm packages
- Fonts loaded from Google Fonts CDN (DM Mono + Syne)
- A minimal inline service worker is registered at runtime via a Blob URL (basic cache-first strategy)

### Tech Stack

- Vanilla HTML/CSS/JS - no framework
- `localStorage` for all persistence
- Canvas API for BAC and weekly unit charts
- CSS custom properties for theming
- `100dvh` + `env(safe-area-inset-bottom)` for iPhone viewport handling

### Design System

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0d0d14` | App background |
| `--surface` | `#14141f` | Cards |
| `--surface2` | `#1c1c2e` | Inputs, chips |
| `--accent` | `#7c6af7` | Primary purple |
| `--accent2` | `#c084fc` | Highlights, values |
| `--green` | `#34d399` | Safe/sober state |
| `--amber` | `#fbbf24` | Caution/approaching limit |
| `--red` | `#f87171` | Over limit |
| `--muted` | `#6b6b8a` | Labels, secondary text |

Fonts: `Syne` (headings/UI, 400-800) + `DM Mono` (numeric values, 300-500)

---

## Data Model

### Drink Log Entry

```js
{
  id: "1713876000000",       // Date.now().toString()
  timestamp: 1713876000000,  // Unix ms
  name: "Pint Lager",        // string
  volumeMl: 568,             // number
  abv: 4.5,                  // number (percentage, e.g. 4.5 = 4.5%)
  cost: 5.00                 // number, optional (0 if not entered)
}
```

Stored as: `localStorage.setItem('at-log', JSON.stringify(array))`

### Settings Object

```js
{
  gender: 'male' | 'female',
  weightKg: 75,              // always stored in kg, converted for display
  weightUnit: 'kg' | 'lb',
  bacUnit: 'permille' | 'percent' | 'mg100ml',
  volUnit: 'ml' | 'oz',
  currency: '£' | '€' | '$',
  weeklyGoal: 14,            // units
  legalLimit: 0.80           // permille
}
```

Stored as: `localStorage.setItem('at-settings', JSON.stringify(object))`

### localStorage Keys

| Key | Contents |
|---|---|
| `at-log` | JSON array of drink entries |
| `at-settings` | JSON settings object |

---

## BAC Calculation

Uses the **Widmark formula**:

```
BAC (‰) = (alcohol_grams / (weight_kg × r × 10)) - (0.15 × hours_elapsed)
```

Where:
- `r` = 0.68 (male) or 0.55 (female) - body water distribution constant
- Metabolism rate = 0.15 ‰ per hour (standard approximation)
- Alcohol grams = `volumeMl × (abv/100) × 0.789` (ethanol density)
- Each drink's BAC contribution is calculated independently then summed
- Result is clamped to a minimum of 0

BAC display units are converted from permille at render time:
- Permille: raw value, e.g. `0.82`
- Percent: divide by 10, e.g. `0.082`
- mg/100ml: multiply by 100, e.g. `82`

---

## Features Implemented

### Now (Today) Tab
- Live BAC display with unit conversion
- Coloured progress bar vs legal limit
- Status text (Sober / Below limit / Approaching / Over)
- "Sober in ~Xh Ym" countdown
- Today's drink count, unit total, approximate calorie count
- Scrollable drink log for today with delete buttons

### Add Drink Modal
- 9 quick-select drink presets (pint, wine, spirit, half pint, WKD, prosecco, cocktail, bottle beer, double)
- Custom name, volume, ABV, cost, time fields
- Auto-calculated units display
- Time defaults to current time

### History Tab
- All drinks grouped by day
- Day header shows date + unit total

### Stats Tab
- BAC-over-time canvas chart (last 12 hours)
- Weekly units bar chart (last 7 days, today highlighted)
- Weekly goal progress bar (over-limit turns red)
- Stats grid: week units, month units, avg per day, sober days (last 7)

### Profile/Settings Tab
- Gender, weight (kg/lb)
- BAC unit preference
- Volume unit preference
- Currency
- Weekly unit goal
- Legal limit selector (0.50 / 0.80 / 1.00 ‰)
- CSV export
- Clear all data

### PWA
- `apple-mobile-web-app-capable` meta tags for iPhone home screen
- Inline service worker registered via Blob URL (cache-first, caches `/`)
- Safe area insets applied throughout

---

## Build 2 - Planned Features

### 1. User Accounts & Authentication

The app currently stores data in `localStorage` (device-only, no login). The next build should introduce accounts to allow:

- Secure login from any device
- Data locked behind authentication
- (Future) multi-device sync

**Recommended approach:**

- **Backend**: Supabase (free tier, hosted Postgres, built-in Auth)
  - Provides email/password auth out of the box
  - Row-level security (RLS) ensures users can only access their own data
  - REST and JS client available, no server code required
- **Auth flow**: Email + password to start; add "magic link" (passwordless) as a nice-to-have
- **Data migration**: On first login after account creation, offer to migrate existing `localStorage` data to the cloud account
- **Offline-first consideration**: Keep `localStorage` as a write-ahead cache, sync to Supabase on connectivity. This preserves the feel of the app when offline (e.g. no signal in a pub)

**Schema (Supabase / Postgres):**

```sql
-- Users handled by Supabase Auth (auth.users table)

create table drink_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  logged_at    timestamptz not null,
  name         text not null,
  volume_ml    numeric not null,
  abv          numeric not null,
  cost         numeric default 0,
  created_at   timestamptz default now()
);

alter table drink_log enable row level security;

create policy "Users can only access own drinks"
  on drink_log for all
  using (auth.uid() = user_id);

create table user_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  gender       text default 'male',
  weight_kg    numeric default 75,
  weight_unit  text default 'kg',
  bac_unit     text default 'permille',
  vol_unit     text default 'ml',
  currency     text default '£',
  weekly_goal  numeric default 14,
  legal_limit  numeric default 0.80
);

alter table user_settings enable row level security;

create policy "Users can only access own settings"
  on user_settings for all
  using (auth.uid() = user_id);
```

**UI additions needed:**
- Login / signup screen (shown before app if not authenticated)
- "Sign out" option in Profile tab
- Sync status indicator (e.g. small dot: green = synced, amber = pending)

---

### 2. AlcoDroid Data Import

AlcoDroid exports data in a **SQLite database file** format (`.backup` extension, sometimes `.db`). The file is a standard SQLite3 binary.

**If you have the export file**, it will contain a table called `DrinkLog` (or similar) with columns including:

| AlcoDroid column | Maps to AlcoTrack field |
|---|---|
| `_id` | generate new `id` |
| `DrinkName` | `name` |
| `DrinkVolumeMl` | `volumeMl` |
| `DrinkAbvPercent` | `abv` |
| `DrinkFinishedTime` | `timestamp` (Unix ms) |
| `DrinkCost` | `cost` |

AlcoDroid also exports as **CSV** from its "Export" menu. If you have a CSV export, the column names above are the likely headers.

**Import feature plan:**

The import UI should live in the Profile tab, in the Data section, as a new row: "Import from AlcoDroid".

**Implementation approach - SQLite file:**

```js
// Use sql.js (WebAssembly SQLite) to read the binary file in-browser
// https://github.com/sql-js/sql.js
// CDN: https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js

async function importSQLite(file) {
  const SQL = await initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` });
  const buf = await file.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buf));

  // AlcoDroid table - try both known table names
  let result;
  try {
    result = db.exec("SELECT DrinkName, DrinkVolumeMl, DrinkAbvPercent, DrinkFinishedTime, DrinkCost FROM DrinkLog");
  } catch {
    result = db.exec("SELECT * FROM drink_log"); // fallback
  }

  const rows = result[0]?.values || [];
  return rows.map(([name, vol, abv, ts, cost]) => ({
    id: crypto.randomUUID(),
    timestamp: ts,         // already Unix ms in AlcoDroid
    name: name || 'Drink',
    volumeMl: parseFloat(vol),
    abv: parseFloat(abv),
    cost: parseFloat(cost) || 0
  }));
}
```

**Implementation approach - CSV file:**

```js
function importCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
    const row = Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
    return {
      id: crypto.randomUUID(),
      timestamp: parseInt(row['DrinkFinishedTime']) || Date.now(),
      name: row['DrinkName'] || 'Drink',
      volumeMl: parseFloat(row['DrinkVolumeMl']) || 0,
      abv: parseFloat(row['DrinkAbvPercent']) || 0,
      cost: parseFloat(row['DrinkCost']) || 0
    };
  }).filter(d => d.volumeMl > 0 && d.abv > 0);
}
```

**Import UX flow:**

1. User taps "Import from AlcoDroid" in Profile → Data
2. File picker opens (accept `.backup`, `.db`, `.csv`)
3. App detects file type from extension
4. Parse and preview: show a summary card ("Found 347 drinks from Jun 2019 - Apr 2026")
5. Show options:
   - "Merge with existing" (keep current data, add imported)
   - "Replace all data" (wipe current, use imported)
6. Confirm → import → show success toast with count

**Duplicate prevention:** After import, deduplicate on `(timestamp, volumeMl, abv)` - exact match on all three is almost certainly the same drink.

---

## Refactoring Recommendations for Build 2

Given the move to accounts + sync, the single-file architecture should be split into a proper project structure. Suggested approach:

```
alcotrack/
├── index.html
├── manifest.json          # proper PWA manifest (not inline)
├── sw.js                  # service worker (not Blob URL)
├── src/
│   ├── main.js
│   ├── bac.js             # Widmark formula, pure functions
│   ├── storage.js         # localStorage + Supabase sync layer
│   ├── auth.js            # Supabase auth wrapper
│   ├── import.js          # AlcoDroid import logic
│   ├── charts.js          # Canvas chart functions
│   ├── ui/
│   │   ├── today.js
│   │   ├── log.js
│   │   ├── stats.js
│   │   └── settings.js
│   └── style.css
└── package.json
```

A lightweight bundler like **Vite** would work well here - fast dev server, good PWA plugin (`vite-plugin-pwa`), and produces a single optimised output that can be deployed to Vercel as-is.

---

## Deployment

Currently: single HTML file, host anywhere static (Vercel, GitHub Pages, Netlify).

With Supabase auth: still fully static front-end. Supabase keys can be included in the client (they are designed to be public - RLS enforces security, not key secrecy). Deploy to Vercel as before.

---

## Known Limitations / Tech Debt

| Item | Notes |
|---|---|
| Service worker registered via Blob URL | Works but won't cache properly on all browsers; replace with `sw.js` file |
| No PWA manifest file | `apple-mobile-web-app-*` meta tags work for iOS but a `manifest.json` is needed for Android and for Lighthouse PWA score |
| BAC chart uses raw canvas | Consider Chart.js or a lightweight SVG approach for maintainability |
| No drink edit | Can only delete and re-add; edit flow needed |
| Presets are hardcoded | Should be user-editable in a future build |
| No data validation on import | Add min/max sanity checks on volumeMl and abv |
| Calories are approximate | Formula is a rough estimate; label clearly in UI |

---

## Quick Reference - Key Function Names

| Function | What it does |
|---|---|
| `calcBACPermille(drinks)` | Returns current BAC in permille for an array of drink entries |
| `calcBACAtTime(drinks, timestamp)` | BAC at a specific point in time (used for chart) |
| `calcUnits(volumeMl, abv)` | Returns UK units: `(vol × abv) / 1000` |
| `formatBAC(permille)` | Converts permille to display string in current unit |
| `renderToday()` | Re-renders the Now tab |
| `renderLog()` | Re-renders the History tab |
| `renderStats()` | Re-renders the Stats tab + redraws charts |
| `drawBACChart()` | Draws BAC-over-time canvas chart |
| `drawWeekChart(drinks)` | Draws weekly bar chart |
| `addDrink()` | Reads modal form, creates entry, saves, re-renders |
| `exportCSV()` | Generates and downloads CSV of full log |
| `openModal()` | Opens add drink sheet |
| `saveLog()` | Persists log array to localStorage |
| `saveSettings()` | Persists settings object to localStorage |

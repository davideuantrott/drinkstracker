#!/usr/bin/env node
/**
 * Queries Open Food Facts for UK alcohol products and merges results into
 * src/drinks-library.json.
 *
 * Run with: node scripts/fetch-off-drinks.mjs
 * Requires Node 18+ (uses built-in fetch).
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_PATH = join(__dirname, '../src/drinks-library.json');

const OFF_CATEGORIES = ['beers', 'ciders', 'wines'];
const PAGES_PER_CATEGORY = 5;
const PAGE_SIZE = 100;
const DELAY_MS = 600;

// Open Food Facts asks for a contact in the User-Agent
const USER_AGENT = 'AlcoTrack-LibraryScraper/1.0 (github.com/davideuantrott/drinkstracker)';

function parseVolumeMl(quantityStr) {
  if (!quantityStr) return null;
  const s = quantityStr.toLowerCase().replace(/\s+/g, '');
  // Multi-pack first: "4x440ml", "6x33cl"
  const multi = s.match(/\d+x(\d+(?:\.\d+)?)(ml|cl|l)/);
  if (multi) return toMl(parseFloat(multi[1]), multi[2]);
  // Single value: "440ml", "33cl", "0.5l"
  const single = s.match(/^(\d+(?:\.\d+)?)(ml|cl|l)/);
  if (single) return toMl(parseFloat(single[1]), single[2]);
  return null;
}

function toMl(value, unit) {
  if (unit === 'ml') return Math.round(value);
  if (unit === 'cl') return Math.round(value * 10);
  if (unit === 'l') return Math.round(value * 1000);
  return null;
}

function offCategoryToAppCategory(offCategory) {
  if (offCategory === 'ciders') return 'cider';
  if (offCategory === 'wines') return 'wine';
  return 'lager'; // beers — will often be wrong for ales/stouts, but good enough for dedup
}

function normaliseName(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchPage(category, page) {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('action', 'process');
  url.searchParams.set('tagtype_0', 'categories');
  url.searchParams.set('tag_contains_0', 'contains');
  url.searchParams.set('tag_0', category);
  url.searchParams.set('tagtype_1', 'countries');
  url.searchParams.set('tag_contains_1', 'contains');
  url.searchParams.set('tag_1', 'united-kingdom');
  url.searchParams.set('fields', 'product_name,code,nutriments,quantity,brands');
  url.searchParams.set('json', 'true');
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));

  const res = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const library = JSON.parse(readFileSync(LIBRARY_PATH, 'utf-8'));
  console.log(`Loaded ${library.length} existing entries from library.\n`);

  const fetched = [];

  for (const category of OFF_CATEGORIES) {
    console.log(`Fetching ${category}...`);
    for (let page = 1; page <= PAGES_PER_CATEGORY; page++) {
      process.stdout.write(`  page ${page}/${PAGES_PER_CATEGORY} ... `);
      try {
        const data = await fetchPage(category, page);
        const products = data.products ?? [];
        let kept = 0;

        for (const p of products) {
          const name = (p.product_name ?? '').trim();
          const ean = p.code ?? null;
          const abv = p.nutriments?.alcohol_100g;
          const volumeMl = parseVolumeMl(p.quantity);

          // Require all three key fields; sanity-check ranges
          if (!name || !abv || abv <= 0 || abv > 70) continue;
          if (!volumeMl || volumeMl < 50 || volumeMl > 3000) continue;

          fetched.push({
            name,
            volumeMl,
            abv: Math.round(abv * 10) / 10,
            category: offCategoryToAppCategory(category),
            ean: ean || null,
          });
          kept++;
        }

        console.log(`${kept} valid`);
        if (products.length < PAGE_SIZE) break; // last page
      } catch (err) {
        console.error(`  error: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nFetched ${fetched.length} valid OFF entries total.`);

  let added = 0;
  let eansFilled = 0;

  for (const entry of fetched) {
    // 1. EAN match — already in library, just backfill EAN if missing
    if (entry.ean) {
      const byEan = library.find(e => e.ean === entry.ean);
      if (byEan) continue;
    }

    // 2. Name + volume match — update EAN if we now have one
    const normEntry = normaliseName(entry.name);
    const byName = library.find(
      e => normaliseName(e.name) === normEntry && e.volumeMl === entry.volumeMl
    );
    if (byName) {
      if (!byName.ean && entry.ean) {
        byName.ean = entry.ean;
        eansFilled++;
      }
      continue;
    }

    // 3. Genuinely new — add it
    library.push(entry);
    added++;
  }

  console.log(`Added ${added} new entries, filled ${eansFilled} missing EANs.`);
  writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2) + '\n');
  console.log(`Saved. Library now has ${library.length} entries.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

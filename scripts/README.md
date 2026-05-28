# Scripts

Data-fetching scripts that populate the static files the app reads at runtime.

## Overview

| Script             | Output                                              | Description                                                                                    |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `fetch-huts.mjs`   | `data/huettendata.js`, `data/huts.json`             | Fetches the raw hut list from the Alpenverein website and parses it into our format            |
| `scrape-huts.mjs`  | `data/graph.json`, `data/huts-scraped.json`         | Scrapes each hut's Alpenverein page for neighbor links/walking times and website URL           |
| `merge-huts.mjs`   | `data/huts-combined.json`                           | Merges `huts.json` and `huts-scraped.json` into a single file keyed by hut id                 |
| `scrape.mjs`       | all of the above                                    | Runs all three scripts in sequence (recommended)                                               |

All output files are written to `data/`.

## Usage

### Run everything (recommended)

```bash
npm run scrape
```

### Run steps individually

```bash
# Fetch hut list only
node scripts/fetch-huts.mjs

# Scrape hut pages only (requires data/huettendata.js to exist)
node scripts/scrape-huts.mjs

# Merge huts.json + huts-scraped.json (requires both to exist)
node scripts/merge-huts.mjs

# Scrape neighbor graph only
node scripts/scrape-huts.mjs --neighbors

# Scrape per-hut data only (e.g. website URL)
node scripts/scrape-huts.mjs --data
```

## Notes

- `scrape-huts.mjs` makes one HTTP request per hut with a 150 ms delay between requests — expect it to take a while on a full run.
- `graph.json` and `huts-scraped.json` are both written in one shot after all huts have been scraped, so the app never reads a half-finished file.
- `huts.json` contains data sourced from `huettendata.js` (name, coordinates, elevation, etc.); `huts-scraped.json` contains per-hut data scraped from the Alpenverein site (currently: website URL); `huts-combined.json` merges both and is what the API should read.
- Both scripts can be run independently, so you can refresh just the hut list without re-scraping (or vice versa).

# Screenshots

The main README embeds four images from this folder. They aren't committed (so
the repo stays light and free of any personal data) — generate your own from a
demo database in a couple of minutes:

```bash
# 1. Point at a throwaway DB so your real data is untouched
export MONEY_TRACKER_DB_PATH=/tmp/demo.db

# 2. Build a populated demo install
npm run db:migrate
APP_USERNAME=demo APP_PASSWORD=demo12345 npm run db:seed   # also creates the login
npm run db:seed-demo                                       # a few months of sample txns

# 3. Run it
npm run dev        # http://localhost:3000  (log in as demo / demo12345)
```

Then capture these pages (a ~390×840 mobile viewport looks best — the UI is
phone-first) and save them here with these exact names:

| File | Page | What it shows |
| --- | --- | --- |
| `dashboard.png` | `/` | Month hero card, budget ring, daily log |
| `stats.png` | `/stats` | Category breakdown + trend charts |
| `balances.png` | `/balances` | Net worth, accounts, credit-card cycles |
| `more.png` | `/more` | Settings incl. the Main Currency switcher |

Tips:
- In Chrome DevTools, toggle the device toolbar (`⌘⇧M`) and pick a phone preset
  for clean mobile-width shots, or use "Capture full size screenshot".
- Try switching **More → Main Currency** to a different currency before the
  `more.png` shot to show the feature off.

Commit the four PNGs (`git add docs/screenshots/*.png`) so they render in the
README on GitHub. Remove the `MONEY_TRACKER_DB_PATH` export (and `/tmp/demo.db`)
when you're done — none of the demo data touches your real `data/money.db`.

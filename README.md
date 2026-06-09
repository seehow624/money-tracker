# Money Tracker

[![CI](https://github.com/seehow624/money-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/seehow624/money-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)

A self-hosted, single-user personal finance tracker. Log income, expenses and
transfers across multiple accounts and currencies; track credit-card statement
cycles; set monthly budgets; and review trends — all backed by a single local
SQLite file you own.

Built with **Next.js 16 (App Router) · React 19 · SQLite (better-sqlite3) ·
Drizzle ORM · Tailwind CSS · Recharts**.

> Personal project, shared as-is. It assumes one user and minimal UI auth — put
> it behind your own VPN/reverse proxy. Not a multi-tenant SaaS.

## Screenshots

| Dashboard | Stats & charts |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Stats](docs/screenshots/stats.png) |
| **Balances** | **Settings** |
| ![Balances](docs/screenshots/balances.png) | ![More](docs/screenshots/more.png) |

## Features

- Multi-account, multi-currency tracking with automatic FX conversion to a
  configurable base currency — pick it in the UI (More → Main Currency) any
  time; rates from the free [Frankfurter](https://frankfurter.dev) API.
- Credit-card aware balances using per-card statement/payment cycles.
- Monthly budgets with category/subcategory breakdowns and trend charts.
- Recurring/scheduled transactions and bill/budget reminders.
- Optional JSON API for an external client (e.g. a Telegram bot) secured by a
  bearer token.
- Optional in-app AI assistant: natural-language entry against any
  OpenAI-compatible endpoint (Ollama, OpenAI, OpenRouter, …). Provider keys live
  in your local database, never in the repo.

## Requirements

- **[Node.js](https://nodejs.org) 20 or newer** (includes `npm`) and **[git](https://git-scm.com)**.
  Check with `node -v` — if it prints `v20.x` or higher you're good.
- That's it. The database is a local SQLite file; there's nothing else to install
  or provision. It runs on macOS, Linux, and Windows.

This is a web app you run yourself (not a packaged desktop installer) — you'll
use a terminal for the steps below.

## Quick start

Copy-paste this whole block into your terminal:

```bash
git clone https://github.com/seehow624/money-tracker.git
cd money-tracker
npm install
npm run setup
npm run dev
```

`npm run setup` does everything for you: it generates `.env.local` (with a random
admin password and session secret), creates the database, your login, and a set
of example accounts + categories. **It prints the generated login** — for
example `Login: admin / HpNTuuvTLl9y9hXR` — so copy that.

When `npm run dev` is running, open **http://localhost:3000** and sign in with
that login. You can change the password in the app under **More → Change
password**. (Re-running `setup` is safe: it never overwrites an existing
`.env.local`, and seeding is idempotent.)

Optional extras:

```bash
npm run db:seed-demo   # add a few months of sample transactions to explore
```

> Prefer to configure things by hand? Copy `.env.example` to `.env.local`, set
> `APP_USERNAME` / `APP_PASSWORD` / `APP_SESSION_SECRET`, then run `npm run
> db:migrate`, `npm run db:seed-admin`, `npm run db:seed` yourself. If you ever
> see "Invalid username or password", the admin row wasn't created — run
> `npm run db:seed-admin` (or `npm run setup`).

`npm run setup` seeds **example** accounts and categories. Edit `scripts/seed.ts`
before running it to start from your own, or just add/edit them in the UI later.
`npm run db:seed-demo` adds a few months of fake transactions so the dashboard
and charts aren't empty — delete those rows (they have `source = 'demo'`) once
you start entering real data.

## Updating to a newer version

```bash
git pull
npm install        # in case dependencies changed
npm run db:migrate # apply any new database migrations
```

Your data lives in `data/money.db`, which is never touched by `git pull` — back
it up by copying that file (the bundled `npm run db:daily-backup` does this too).

## Configuration

All config is environment variables in `.env.local` — see
[`.env.example`](.env.example) for the full list. The essentials:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BASE_CURRENCY` | Initial base currency for a fresh install (default `USD`). Changeable later in the UI. |
| `APP_USERNAME` / `APP_PASSWORD` | Bootstrap login for the web UI |
| `APP_SESSION_SECRET` | Signs the session cookie (use a long random string) |
| `MONEY_TRACKER_API_TOKEN` | Bearer token for `/api/*` (external clients) |
| `MONEY_TRACKER_DB_PATH` | Optional DB path override (default `./data/money.db`) |

Every account has its own currency; balances and cross-account totals are
converted into the base currency for display. Change the base currency any time
at **More → Main Currency** — it re-fetches FX rates and recomputes stored
conversions, so it's safe to switch even after you have data.

AI provider API keys are **not** environment variables — add them in the UI at
`/more/ai`; they are stored in the `ai_profiles` table inside your gitignored
`data/money.db`.

## Scripts

```bash
npm run dev / dev:lan       # dev server (lan = bind 0.0.0.0 for phone testing)
npm run build && npm start  # production
npm run typecheck           # tsc --noEmit (the only check)

npm run db:generate         # drizzle-kit generate after editing src/db/schema.ts
npm run db:migrate          # apply migrations
npm run db:seed             # seed example accounts + categories (idempotent)
npm run db:seed-demo        # sample transactions for demos/screenshots (idempotent)
npm run db:studio           # drizzle-kit studio

npm run db:run-scheduled    # post due recurring transactions   (cron: daily)
npm run db:daily-backup     # backup money.db, prune > 30 days   (cron: daily)
npm run db:fetch-fx         # refresh FX rates                   (cron: daily)
```

Wire the three scheduled jobs into cron, launchd, systemd or your process
manager of choice.

`scripts/parse-tng.mjs` is an example statement parser (Touch 'n Go eWallet PDF →
JSON) — adapt it for your own statement formats.

## Deployment

Run `npm run build && npm start` (or `start:lan` to bind `0.0.0.0`) under a
process manager and put it behind your own reverse proxy / VPN. SQLite means no
external database to provision — just back up `data/money.db` (the daily-backup
script does this for you).

## License

[MIT](LICENSE) © Jerome Teng

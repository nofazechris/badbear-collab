# Badbear Colab

Internal tool for tracking Solana NFT collaboration outreach. No login —
anyone with the link can view and update status. Data lives in Neon
(Postgres), deployed on Vercel.

## 1. Create a Neon database (free)

1. Go to https://vercel.com/dashboard, open (or create) your project for
   this repo.
2. In the project, go to the **Storage** tab → **Create Database** →
   choose **Neon (Postgres)** → follow the prompts (pick the free plan).
3. Vercel automatically adds a `DATABASE_URL` environment variable to your
   project. You don't need to copy/paste anything manually.

   If you'd rather create the Neon project yourself at https://neon.tech
   first, that also works — just copy the connection string it gives you
   (starts with `postgresql://...?sslmode=require`) into Vercel's
   project settings under **Settings → Environment Variables** as
   `DATABASE_URL`.

## 2. Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. Go to https://vercel.com/new, import that repo.
3. Vercel detects Next.js automatically — no config needed.
4. Make sure `DATABASE_URL` is set (see step 1) before the first deploy,
   or redeploy after adding it.
5. Click Deploy. You'll get a URL like `vaultz-collab-tracker.vercel.app`
   — that's the link to share with your COO/VA.

## 3. Load the first batch of data

The table starts empty. Seed it one of two ways:

**Option A — run locally (recommended, one-time):**
```bash
npm install
DATABASE_URL="<paste your Neon connection string>" node scripts/seed.mjs
```
This reads `scripts/snapshot.json` (today's cleaned Magic Eden pull,
junk/spam already filtered out) and inserts it.

**Option B — POST to the live API:**
```bash
curl -X POST https://your-app.vercel.app/api/seed \
  -H "Content-Type: application/json" \
  -d @scripts/snapshot.json
```
Note: the seed endpoint expects `{"projects": [...]}` — `snapshot.json`
is currently shaped as `{"collections": [...]}`, so if using curl,
rename that key first or ask Claude to adjust the payload.

## 4. Adding more projects later

There's no built-in "pull from Magic Eden" button in the app itself —
Magic Eden's public API doesn't support real pagination, so refreshing
is a manual step:

1. Ask Claude (in a chat) to pull a fresh Magic Eden snapshot and clean
   out spam/placeholder entries.
2. Save that as a new `scripts/snapshot.json`.
3. Re-run the seed script (Option A above) — it upserts by `symbol`, so
   existing rows update in place and new ones get added; nobody's CRM
   status gets wiped.

## Local development

```bash
npm install
cp .env.example .env.local
# paste your Neon connection string into .env.local
npm run dev
```

Visit http://localhost:3000.

## Project structure

```
src/app/page.tsx           — the dashboard UI
src/app/api/collections/   — GET (list) and PATCH (update status)
src/app/api/seed/          — POST to bulk insert/update projects
src/lib/db.ts              — Neon client + schema
scripts/seed.mjs           — one-time/repeatable local seed script
scripts/snapshot.json      — the data to seed
```

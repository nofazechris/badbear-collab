# Badbear Colab

Internal tracker for Solana NFT collab outreach. No login — anyone with
the link can view and update status. Data lives in Neon (Postgres),
hosted on Vercel.

**Live URL:** add your `*.vercel.app` link here once deployed.

## Local development

```bash
npm install
cp .env.example .env.local   # paste your Neon DATABASE_URL into this file
npm run dev
```

Visit http://localhost:3000.

## Adding more projects

Magic Eden's API doesn't support real pagination or filtering, so
pulling new data is a manual step — ask Claude for a fresh, cleaned
snapshot (junk/spam already filtered out), then:

1. Save it as `scripts/snapshot.json` (same shape as the existing file)
2. Run, from this folder:
   ```bash
   set DATABASE_URL=your-neon-connection-string
   node scripts/seed.mjs
   ```
   *(PowerShell: use `$env:DATABASE_URL="..."` instead of `set`)*

This upserts by project symbol — existing CRM statuses (DM sent /
closed / failed) are never overwritten, only new/changed fields update.

## Deploying changes

Push to GitHub → Vercel auto-deploys. Make sure `DATABASE_URL` is set
in Vercel under **Settings → Environment Variables** (same value as
your local `.env.local`).

## Project structure

```
src/app/page.tsx           — the dashboard UI
src/app/api/collections/   — GET (list) and PATCH (update status)
src/app/api/seed/          — POST to bulk insert/update projects
src/lib/db.ts              — Neon client + schema
scripts/seed.mjs           — seed/update script, run locally
scripts/snapshot.json      — current data set
```

## Security note

If you ever paste your Neon connection string somewhere public (chat,
terminal history, screenshots), reset it: Neon dashboard → project →
Settings → reset password. Update `.env.local` and Vercel's env var
afterward, then redeploy.

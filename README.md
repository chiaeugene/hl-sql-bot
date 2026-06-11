# Hock Lee · Invoice → SQL (v1.0)

Web app for Hock Lee's accounting team: upload a scanned supplier invoice → AI reads
it → the system detects the supplier → pairs each fish to its Hock Lee item code →
shows an **editable** table → exports a **SQL-Account-ready** Excel / copy-paste.

## What it does

1. **Upload / paste / drag** a scanned invoice (JPG, PNG, or PDF) on the dashboard.
2. **Claude vision** transcribes every line (fish names in Malay + Chinese, qty, price).
3. The system **identifies the supplier** from the letterhead.
4. Each line is **paired to a Hock Lee code** — learned alias → fuzzy match → flagged
   for review if uncertain.
5. The team **edits** anything wrong in a spreadsheet-like grid (codes, qty, price).
6. **Save & learn** stores corrections so the same wording auto-matches next time.
7. **Export**: "Copy for SQL" (tab-separated, pastes straight into SQL Account) or
   "Download .xlsx" (matches the FISHCO template; numbers unformatted per SQL import rules).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · Prisma + SQLite (local) ·
Anthropic Claude vision · SheetJS.

## Setup

```bash
npm install
npx prisma migrate dev      # creates dev.db
npm run db:seed             # imports data/HL SUPPLIER MASTER.xlsx (8 suppliers, 75 items)
```

Set secrets in `.env`:

```
APP_PASSWORD="..."          # shared team login
SESSION_SECRET="..."        # long random string
ANTHROPIC_API_KEY="..."     # required for AI invoice reading
ANTHROPIC_MODEL="claude-opus-4-8"   # best vision; "claude-sonnet-4-6" is cheaper
```

Run:

```bash
npm run dev                 # http://localhost:3000
```

Log in with `APP_PASSWORD`.

## Pages

- `/` — dashboard: upload + recent invoices.
- `/invoice/[id]` — review grid (supplier confirm, editable lines, export).
- `/master` — manage suppliers / codes; "Re-import from Excel".

## Useful scripts

- `npm run db:seed` — (re)import the supplier master from `data/`.
- `npm run db:reset` — drop + recreate the local DB, then re-seed.
- `npx tsx scripts/test-match.ts` — sanity-check the code-matching engine.

## Deploying to Vercel (next step)

For production, switch the datasource to Postgres and uploads to Vercel Blob:

1. `prisma/schema.prisma` → `provider = "postgresql"`; set `DATABASE_URL` to a Neon /
   Vercel Postgres connection string; run `prisma migrate deploy` + `db:seed`.
2. Replace the local disk write in `src/app/api/parse/route.ts` with `@vercel/blob`
   (`put()`), storing the returned URL in `Invoice.fileUrl`.
3. Set `APP_PASSWORD`, `SESSION_SECRET`, `ANTHROPIC_API_KEY` as Vercel env vars.

## Notes

- Item codes preserve leading zeros (e.g. `0028`) — stored as text.
- Matching is scoped to the detected supplier, which narrows candidates and boosts
  accuracy. Changing the supplier in the UI re-pairs all codes.
- v1.0 targets **printed/scanned** invoices. Handwritten invoices are stage 2.

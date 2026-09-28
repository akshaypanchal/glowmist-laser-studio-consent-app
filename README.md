# GlowMist Laser Studio consent app

Clients receive a personal signing link, fill in the GlowMist treatment consent
form, and sign it on screen. The server creates a signed PDF, stores it with the
form answers, keeps a tamper-evident audit trail, and emails the PDF to the
client and the studio. Staff manage everything from a login-protected dashboard.

This is an electronic-signature workflow (evidence of who signed what, when,
and with what intent). It is not a certificate-based PDF digital signature, and
the consent wording and retention rules should be reviewed for the studio's
own legal requirements.

## Stack

- Next.js (App Router) for the pages and the server (route handlers and server actions)
- Turso (libSQL) with Drizzle ORM
- pdf-lib for the signed PDF
- Resend for email
- Cloudflare R2 for files, or the database on the free setup (`STORAGE_DRIVER`)
- Hosted on Vercel

## Getting started

```bash
npm install
cp .env.example .env.local        # TURSO_DATABASE_URL=file:local.db works locally
npm run db:migrate
SEED_OWNER_EMAIL=you@example.com SEED_OWNER_PASSWORD='a-long-password' npm run db:seed
npm run dev
```

The seed creates the studio, an owner login and the Treatment Consent template
with the wording from the studio's paper form.

## Environment variables

See [`.env.example`](.env.example) for the full list. The ones that matter in production:

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Turso database |
| `APP_URL` | Public URL used in signing links |
| `EMAIL_DRIVER=resend`, `RESEND_API_KEY` | Sending email |
| `EMAIL_FROM` | Sender on a domain verified in Resend |
| `STUDIO_RECORDS_EMAIL` | Studio inbox that receives each signed form |
| `STORAGE_DRIVER` and `R2_*` | Where PDFs and signatures are stored |
| `CRON_SECRET` | Protects the daily email-retry job |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run db:generate` | Create a migration after editing `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `TURSO_DATABASE_URL` |
| `npm run db:seed` | Create the studio, owner login and consent template |
| `npm test` | Unit tests (Vitest) |
| `npm run lint`, `npm run typecheck` | Static checks |

## Layout

```
src/
  app/              pages and API routes
  components/       React components (ui/ holds the basic building blocks)
  lib/              shared helpers: hashing, tokens, the consent template format
  server/           server-only code
    db/             Drizzle schema and connection
    audit/          audit trail with SHA-256 hash chain
    documents/      document status rules
    storage/        R2 and database file storage behind one interface
    templates/      immutable consent template versions
```

## How the data is protected

- Signing links contain a random 256-bit token; only its SHA-256 hash is stored.
- Template versions are never edited. A signed document always points at the exact wording signed.
- Every audit event stores the hash of the previous one, so editing or deleting history is detectable.
- Document status only moves along allowed transitions (for example `SENT → VIEWED → IN_PROGRESS → SIGNED`).
- Secrets are read only on the server; nothing uses the `NEXT_PUBLIC_` prefix.

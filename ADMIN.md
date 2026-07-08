# Farah — Admin Dashboard

A password-protected dashboard for writing and managing essays & weblog entries,
with a full WYSIWYG editor (headings, quotes, **bold**/*italic*/links, images
placed inline, and duo/triptych image groups). Arabic RTL + English aware.

## Running

```bash
npm install
npm run dev        # http://localhost:3000
```

The site and dashboard share one Nuxt app:

- Public site: `/`
- Dashboard:   `/admin`  (redirects to `/admin/login` until you sign in)

On first run the database is created at `.data/farah.db` and **seeded from the
existing `data/essays.ts` / `data/weblog.ts`** — nothing is lost.

## Logging in

Default password: **`farah-admin-2026`** — change it before going live.

### Changing the password

Generate a new bcrypt hash and put it in `.env`:

```bash
node -e "console.log(require('bcryptjs').hashSync('YOUR-NEW-PASSWORD', 10))"
```

Then set in `.env`:

```
NUXT_ADMIN_PASSWORD_HASH=<the hash you just generated>
```

Rotating `NUXT_SESSION_PASSWORD` logs everyone out.

## What the dashboard can do

- Create / edit / delete essays and weblog entries
- Draft vs. Published (drafts never appear on the public site)
- Cover image + inline images (uploaded to `public/uploads/`)
- Rich body editor: paragraphs (with bold/italic/links + drop-cap), H2/H3
  headings, quotes with attribution, single images (inset/full), image groups
  (duo/triptych)
- Live preview panel that renders exactly like the public article
- Tags, authors, sources, display date + sort date, custom slug

## Data model

Everything is stored in one `posts` table (SQLite via libSQL). Bodies are the
same `Block[]` shape the public site already renders, so the editor output drops
straight into the existing article components.

## Deploying (Node host / VPS)

```bash
npm run build
node .output/server/index.mjs
```

Provide the same `.env` values in production. Keep `.data/` (the database) and
`public/uploads/` (images) on persistent storage.

**Serverless (Vercel/Netlify):** the local SQLite file and `public/uploads`
are not persistent. Point `NUXT_DB_URL` at a Turso database
(`libsql://…` + `NUXT_DB_AUTH_TOKEN`) and switch uploads to object storage
(S3/R2). The DB code already supports Turso with no changes.

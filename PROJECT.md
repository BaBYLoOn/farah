# FARAH — Project Handbook

Everything needed to understand, run, and safely edit this website. Read this
first when returning to the project. (Operational quick-start also in `ADMIN.md`.)

---

## 1. What this is

A personal writing website for **Farah Ali** — dark, ornate, gothic aesthetic.
Publishes **essays** and **weblog entries** (mostly Arabic, RTL). It has a
**password-protected admin dashboard** with a WYSIWYG editor for writing and
managing all content, plus a settings screen for editing the home-page text and
the hero/footer social links.

- **Framework:** Nuxt 3 (Vue 3, Nitro server, Vite).
- **Location:** `/home/hal/coding/farah-nuxt` — **NOT a git repo** (shipped as
  `farah-nuxt.zip`). If you want history, `git init` first.
- **Language of content:** Arabic (RTL). UI chrome mixes Cinzel (Latin display),
  Thmanyah serif (Arabic), Cormorant/EB Garamond (body).

---

## 2. Running it

> ⚠️ **This machine has no Node on PATH.** `node`/`npm` are not installed
> system-wide. A working Node v22 binary was borrowed from another session at
> `/tmp/claude-1000/-home-hal-coding/*/scratchpad/node-install/bin` — a `/tmp`
> path that may not survive. If it's gone, install Node fresh (nvm or a tarball).

```bash
export PATH="/tmp/.../node-install/bin:$PATH"   # borrowed node, if still present
cd /home/hal/coding/farah-nuxt
npm install        # if deps missing
# The vendored node_modules/.bin/nuxt is a BROKEN copy (zip flattened the symlink,
# so its ../dist/index.mjs path resolves wrong). Run the real bin instead:
node node_modules/nuxt/bin/nuxt.mjs dev --host 0.0.0.0
```

**Launch gotcha:** fully-detached launches (`setsid`/`disown`) get killed
(exit 144 / SIGSTKFLT) when the launching shell command exits. What works:
`nohup node node_modules/nuxt/bin/nuxt.mjs dev --host 0.0.0.0 > log 2>&1 &`
**followed by an in-command poll loop** (curl localhost:3000 until 200) so the
process is fully detached before the command returns. Add `NUXT_IGNORE_LOCK=1`
if it complains about an existing dev lock.

- **Local:** http://localhost:3000
- **Public:** the server was reachable at **http://157.173.123.91:3000** —
  requires `--host 0.0.0.0` (without it Nuxt binds localhost only) AND the cloud
  firewall/security-group must allow inbound TCP 3000.

---

## 3. Environment / secrets (`.env`, gitignored)

```
NUXT_ADMIN_PASSWORD_HASH=<bcrypt hash>     # default password: farah-admin-2026
NUXT_SESSION_PASSWORD=<32-byte hex>        # seals the session cookie
NUXT_DB_URL=file:.data/farah.db            # libSQL; or libsql://... for Turso
NUXT_DB_AUTH_TOKEN=                         # only for Turso
```

Change the password: `node -e "console.log(require('bcryptjs').hashSync('NEW','',10))"`
(use salt rounds 10) → put the hash in `NUXT_ADMIN_PASSWORD_HASH`.
Rotating `NUXT_SESSION_PASSWORD` logs everyone out.

`runtimeConfig` in `nuxt.config.ts` maps these: `adminPasswordHash`, `dbUrl`,
`dbAuthToken`, and `session` (cookie name `farah-admin`).

---

## 4. Tech stack / dependencies

- **nuxt-auth-utils** — sessions (`setUserSession`, `requireUserSession`,
  `useUserSession()`), cookie sealed with `NUXT_SESSION_PASSWORD`.
- **@libsql/client** — the database (local SQLite file, or Turso in prod).
  NOTE: `drizzle-orm` is in package.json but **not used** — all DB access is raw
  libSQL SQL in `server/utils/`. (Safe to remove drizzle later.)
- **bcryptjs** — password hashing/verify.
- **nanoid** — post IDs.
- **@tiptap/vue-3 + starter-kit + extension-link + extension-placeholder** —
  the rich-text editors. (`extension-image` / `extension-text-align` are
  installed but currently unused; images are their own blocks.)
- **vuedraggable + sortablejs** — drag-to-reorder posts in the dashboard.
- **swiper** — pre-existing (carousels); not central.

---

## 5. Data model

### Content blocks — `data/content.ts`
Every post body is a `Block[]`. Block types:
- `paragraph` — `{ text, html?, dropCap? }`
- `heading` — `{ text, html?, level?: 2|3 }`
- `quote` — `{ text, html?, attribution? }`
- `image` — `{ src, alt?, caption?, layout?: 'inset'|'full' }`
- `imageGroup` — `{ images: {src,alt?,caption?}[], layout?: 'duo'|'triptych' }`

**Text blocks carry both `text` (plain) and `html` (inline formatting only:
`<strong> <em> <a> <br>`).** The renderer prefers `html`; falls back to escaped
`text`. `text` is also what reading-time counts. Seed content had only `text`;
the editor backfills `html` from it on load.

### Post — `server/utils/db.ts`
One `posts` table holds **both** essays and weblog entries, distinguished by
`kind: 'essay'|'weblog'`. Fields: `id, kind, slug, title, excerpt, date
(display, Arabic), iso (sort/`<time>`), image, authors[], tags[], sources[],
body: Block[], status: 'draft'|'published', position (manual order),
created_at, updated_at`. JSON columns stored as TEXT.

### Site content — `data/site.ts` (client-safe) + `server/utils/site.ts` (DB)
`SiteContent`: `hero{eyebrow,name,tagline,quote,quoteAccent}`,
`essays{eyebrow,title,sub}`, `weblog{eyebrow,title,sub}`, `footer{name}`,
`socials: {key,label,handle,href,icon?}[]`. Stored as one JSON row in a
`settings` table (id=1). `DEFAULT_SITE` holds the original hardcoded copy;
saved values are deep-merged over defaults.
**⚠ `data/site.ts` must NOT import server/db code** — it's imported by browser
components. Server-only logic lives in `server/utils/site.ts`.

---

## 6. Database behavior (`server/utils/db.ts`, `posts.ts`, `site.ts`)

- `ensureDb()` (idempotent) creates the `posts` table + unique index on
  `(kind, slug)`, adds the `position` column via ALTER (for older DBs), backfills
  positions, and **seeds from `data/essays.ts` + `data/weblog.ts` on first run**
  (only when the table is empty).
- Ordering: `listPosts()` orders by `position ASC` — the manual drag order.
  **New posts get `position = min-1` → appear at the top.** Reorder writes
  positions = array index.
- `getPost/getPostById/createPost/updatePost/deletePost/reorderPosts/slugify/
  uniqueSlug` live in `posts.ts`. `slugify` keeps Arabic letters, hyphenates
  spaces.
- On save, `cleanBlocks()` sanitizes each text block's `html`
  (`server/utils/sanitize.ts`, allow-list: b/strong/i/em/u/br/a, href validated)
  and mirrors plain `text` from it.
- To wipe/reseed: delete `.data/farah.db` and restart (⚠ destroys edits).

---

## 7. Auth

- `POST /api/admin/login` — bcrypt-compares password to `adminPasswordHash`,
  sets session `{ user: { admin: true } }`.
- `POST /api/admin/logout` — clears session.
- `server/utils/auth.ts → requireAdmin(event)` guards every admin API route
  (401 if not admin).
- `middleware/admin.ts` (client) redirects to `/admin/login` when not logged in;
  applied via `definePageMeta({ middleware: 'admin' })` on admin pages.
- **⚠ HTTPS caveat:** the session cookie is set with **`secure: false`** in
  `nuxt.config.ts` because the site runs over plain **HTTP** on the bare IP
  (browsers drop `Secure` cookies on non-HTTPS → login silently fails). **Once
  behind HTTPS, set `session.cookie.secure` back to `true`.** Until then the
  password + cookie travel unencrypted.

---

## 8. API routes (`server/api/`)

Public:
- `GET /api/posts?kind=essay|weblog` — published posts, in admin order.
- `GET /api/posts/:kind/:slug` — one published post.
- `GET /api/site` — merged site content (defaults + saved).

Admin (all require session):
- `GET /api/admin/posts?kind=` — all posts incl. drafts.
- `POST /api/admin/posts` — create.
- `GET|PUT|DELETE /api/admin/posts/:id` — read/update/delete one.
- `POST /api/admin/posts/reorder` — body `{ kind, ids[] }`, persists order.
- `POST /api/admin/upload` — multipart `file`; saves to `public/uploads/`,
  returns `{ url }`. Accepts jpg/png/webp/gif/avif/svg, max 8 MB.
- `PUT /api/admin/site` — save site content (sanitizes socials; custom `icon`
  kept only if it's a `/uploads/...` path).

---

## 9. Pages

- `pages/index.vue` — home: `HeroSection`, `EssaysSection`, `WeblogSection`,
  `FooterSection`.
- `pages/essays/[slug].vue`, `pages/weblog/[slug].vue` — article pages. Fetch the
  published list, find current + prev/next, render header/hero/body/sources/
  siblings. Arabic RTL (`lang="ar" dir="rtl"`). Include `ReadingProgress` +
  `BackToTop`.
- `pages/admin/login.vue` — password login.
- `pages/admin/index.vue` — dashboard: two lists (essays / weblog), **drag to
  reorder** (⠿ handle), cover thumbnail, edit/view buttons, status badge. New
  post buttons. Links to `/admin/site`. Delete is NOT here (it's in the editor).
- `pages/admin/post/[id].vue` — the post editor (`new` = create). Metadata,
  cover uploader, `BlockEditor` body, sources, live preview, save-draft/publish,
  delete (🗑 icon), and an **unsaved-changes guard** (see §11).
- `pages/admin/site.vue` — edit home text (hero/essays/weblog/footer) + social
  links, incl. **custom icon upload** per link.

App shell: `app.vue` renders `<Navbar>` **only when not on `/admin`** +
`<NuxtPage>`. Scroll behavior in `app/router.options.ts`: route changes jump to
top instantly (no smooth animation — CSS `scroll-behavior:smooth` was removed);
same-page hash links (navbar Essays/Weblog) still scroll smoothly.

---

## 10. The editor (how the WYSIWYG works)

The body editor is a **segment model** so you write in one flowing box but can
drop images/quotes between text.

- `components/admin/BlockEditor.vue` — owns an array of **segments**:
  - `text` segment → rendered by `RichBody` (flowing paragraphs + headings).
  - `quote` / `image` / `imageGroup` segments → their own block editors.
  - On **load** (`fromModel`): consecutive paragraph/heading blocks are merged
    into one `text` segment; quote/image/imageGroup become their own segments.
  - On **save** (`toModel`): text segments explode back into paragraph/heading
    `Block[]`; others map 1:1. So the DB always stores flat `Block[]`.
  - Each segment has ↑/↓/✕ and an "insert below" bar (نص / اقتباس / صورة /
    مجموعة صور).
- `components/admin/RichBody.vue` — a TipTap editor (StarterKit with only
  paragraph + H2/H3 + bold/italic + Link + Placeholder). Toolbar: **B, I, 🔗,
  عنوان (H2), فرعي (H3), undo/redo, word count.** Converts to/from `Block[]` via
  the browser DOMParser (top-level `<h2>/<h3>/<p>` → heading/paragraph blocks;
  innerHTML → block.html).
- `components/admin/RichText.vue` — a smaller inline TipTap editor (bold/italic/
  link only), used for quote text. Emits inline HTML (paragraphs → `<br>`).
- `components/admin/ImageUploader.vue` — drop/upload widget → `/api/admin/upload`.
- `components/admin/Mark.vue` — the visible crimson admin logo (the site's
  `BlackOrchid` is near-black and invisible on dark admin panels).

**Dates:** the editor has one calendar (`<input type=date>`) → sets `iso` and
auto-formats the Arabic display `date` via `Intl.DateTimeFormat('ar-EG-u-nu-arab',
{day,month,year})`. Ordering is by drag position, NOT date.

---

## 11. Notable behaviors & fixes (so you don't re-break them)

- **Unsaved-changes guard** (`pages/admin/post/[id].vue`): snapshots the form on
  load + after each save; `dirty` = changed since snapshot. `onBeforeRouteLeave`
  shows a modal (save-draft-and-exit / leave / cancel) on in-app navigation;
  `beforeunload` triggers the browser's native warning on tab-close/refresh.
- **Client/server boundary:** never value-import `server/utils/*` into browser
  code — it drags `node:fs` into the client bundle (Vite error "Module node:fs
  externalized… mkdirSync"). Shared constants/types go in `data/*` (e.g.
  `data/site.ts`), server-only logic in `server/utils/*`.
- **Reading time** (`composables/useReadingTime.ts`): counts words in
  paragraph/heading/quote `text`, `minutes = max(1, round(words / 180))`
  (180 wpm Arabic), formatted with Arabic grammar + Arabic-Indic digits.
- **Images are full-color** — the old site-wide `grayscale(1)` filter was removed
  from article figures, covers, and cards.
- **Aspect ratio 16:9** — cover, article hero, essay cards, weblog thumbs, admin
  thumbnails, and prev/next thumbnails.
- **Byline** (`بقلم …`) uses flex + `gap` so parts never overlap on mobile.
- **Section separators** — the home page uses a simple hairline
  (`.section-sep`) between Essays↔Weblog and Weblog↔Footer, with reduced section
  padding around them.
- **Footer** fades gently from the black section above (`.site-foot-veil`).
  NOTE: there are two `.site-foot` blocks in `main.css`; the **later** one
  (near the bottom) wins for padding.
- **Custom social icons:** if a link has `icon` (an `/uploads/...` URL) it renders
  as `<img>` in hero + footer (overriding the built-in SVG). Uploaded icons don't
  recolor on hover and should be light/transparent (dark bg).

---

## 12. CSS

- **One file:** `assets/css/main.css` (~3200 lines). Sections are commented
  banners (HERO, ESSAYS, WEBLOG, ARTICLE PAGES, NAVBAR, FOOTER, ADMIN DASHBOARD…).
- Design tokens (`:root`): `--bg*`, `--crimson*`, `--bone*`, `--ivory`, `--ink`.
  Article reading ink `--read-ink`. Admin has its own scoped tokens under
  `.admin { --a-bg, --a-panel, --a-text, --a-crimson … }`.
- Arabic overrides are grouped as `[lang="ar"] …` rules (Thmanyah fonts, RTL
  alignment, larger line-height for reading comfort).

---

## 13. Deployment (production)

```bash
npm run build
node .output/server/index.mjs      # serve; provide the same .env
```
- Keep `.data/` (database) and `public/uploads/` (images) on **persistent**
  storage. On a VPS this "just works."
- **Serverless (Vercel/Netlify):** local SQLite + local uploads are ephemeral —
  point `NUXT_DB_URL` at a **Turso** libSQL URL (+ `NUXT_DB_AUTH_TOKEN`, code
  already supports it) and move uploads to object storage (S3/R2).
- **Recommended:** a real domain + **nginx + Let's Encrypt** in front (443 →
  proxy to the app), then flip the session cookie back to `secure: true`. This
  also gives you a proper keep-alive service (systemd/pm2) instead of a dev
  server.

---

## 14. Known limitations / possible next steps

- Runs on a **dev server** over **HTTP** — needs a production build + HTTPS +
  keep-alive service for real use.
- A **draft's** public URL shows the "article not found" panel (HTTP 200), not a
  hard 404. Drafts are correctly hidden from listings.
- No image cropping/resizing on upload (stored as-is). Cover/figures rely on CSS
  `object-fit`.
- Uploaded SVG icons are trusted (single admin author); served from `/uploads/`.
- The weblog is labeled inconsistently across the UI: dashboard header
  "المفكرة", editor type toggle "مذكرة", article kicker "مفكّرة", section title
  "WEBLOG". Unify if desired.
- No search, pagination, tags pages, RSS, or analytics yet.

---

## 15. Default credentials (change before real launch)

- Admin password: **`farah-admin-2026`** → dashboard at `/admin`.

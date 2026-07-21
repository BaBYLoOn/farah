# Cinema feature → Farah's site — build handoff

> ## ✅ Progress — BACKEND BUILT & VERIFIED (2026-07-21)
> Working end-to-end against her real Letterboxd (`orchidee26_`):
> - **Config**: `.env` (shared TMDB key, her RSS, empty Trakt placeholders) + `nuxt.config`
>   runtimeConfig (`letterboxdRss`, `tmdbApiKey`, `traktClientId/Secret`) + 1-year session.
> - **DB** (`server/utils/db.ts`): `titles`, `watches`, `reviews` (DATED, many/title, guid-deduped),
>   `sync_log`, `cinema_settings` (kv) added to `ensureDb()`; helpers `getSetting/putSetting/
>   syncWatchCache/getAdminHash/rowToTitle/rowToWatch/rowToReview` + `requireAdmin` re-export.
> - **Utils**: `csv`, `imdb`, `pipeline` (copied); `enrich` (posters → Farah `./uploads`);
>   `letterboxd` (diary pass THEN review pass from RSS, per requirement); `trakt` (UA=farahali);
>   **`reviews.ts`** (RSS extraction — strips CDATA/poster/"Watched on…" boilerplate, skips lists;
>   + `reviews.csv` importer).
> - **APIs**: admin `titles*/sync/process/import-csv/import-reviews/lb-match/enrich/imdb-ratings/
>   tmdb-*/trakt-*/fav-*/settings` under `server/api/admin/`; public `server/api/cinema/{content,
>   diary,favorites}.get`. Boot + 6h auto-sync in `server/plugins/cinema.ts`.
> - **Verified**: synced 50 films (all posters, 49 runtime, 45 IMDb ratings), **8 dated reviews**
>   attached; Trakt status = needs-keys (correct). UAT DB now holds her latest-50 data.
>
> ### ▶ NEXT — the UI (not built yet)
> 1. `components/CinemaArchive.vue` — port; **"Notes" filter → "Review"**; show a title's dated
>    reviews in Watched; a **review icon on diary rows whose title has reviews → jumps to that
>    title's reviews in Watched**. Theme via a `.cinema-scope` wrapper that redefines the source's
>    CSS vars (`--ink` is LIGHT text in the source but DARK in Farah — must scope, not global).
> 2. `pages/cinema/index.vue` + `pages/cinema/favorites.vue` (public) — themed, RTL-aware.
> 3. Admin cinema page in Farah's admin (sources w/ **two uploads** diary.csv + reviews.csv, add-title,
>    favourites, titles archive + edit modal) + admin nav link + a Trakt "Connect" card.
> 4. Port the source's cinema CSS into a `.cinema-scope` block (token remap: gold→bone, red→crimson,
>    ink→ivory, mute→bone-dim, mono→Cinzel); add `poster`/`reveal` client plugins (Farah has none).
> 5. Nav link in `components/Navbar.vue`; verify with the screenshot harness.
> Minor: a benign "Duplicated imports requireAdmin" dev warning (db.ts re-exports auth.ts's) — can be
> silenced by dropping the re-export and letting the endpoints auto-import it.

---



Port the **entire Cinema feature** from `husseinkhalid.com` into Farah's website,
restyled in **her theme**, wired to **her** Letterboxd + Trakt, with a **new
Reviews** capability. Bring the **structure only — none of Hussein's data**; Farah
uploads her own films.

Read this with the source project's `handoff.md`
(`/home/hal/UAT/husseinkhalid.com/handoff.md`) open — it documents every quirk of
the feature being ported. This doc is the adaptation plan.

---

## 0. TL;DR of what changes vs. the source

| Aspect | husseinkhalid (source) | Farah (target) |
|---|---|---|
| Letterboxd | `hussein3301` | **`orchidee26_`** — RSS `https://letterboxd.com/orchidee26_/rss/`, diary `…/orchidee26_/diary/` |
| Trakt | Hussein's app keys | **Farah's own** Trakt app (she creates it; new client id/secret) |
| Data | 620 films + 212 series | **empty** — she uploads her `diary.csv`; tables ship empty |
| "Notes" | title/watch notes + "Notes" filter | **"Review"** everywhere (label + filter); fed by a **reviews.csv** |
| Reviews | — (new) | **`reviews.csv` upload** → matched to each film as a **global review** |
| Theme | black / blood-red / subtitle-gold, Cinzel+Newsreader | **Farah's** crimson/bone/ivory gothic, Cinzel + Cormorant/EB Garamond, **RTL-aware** |
| Auth/DB | its own | **reuse Farah's** `nuxt-auth-utils` + `@libsql/client` (`farah.db`) |

---

## 1. Target project facts (Farah)

- **Edit in UAT:** `/home/hal/UAT/farah-nuxt` (dev, port **:3001** per memory — verify
  in `deploy/`); **live:** `/home/hal/coding/farah-nuxt` (prod **:3000**). Release =
  the standard convention (edit UAT → push → pull in live → `deploy/update.sh`).
  ✅ Confirmed: UAT **is** a git repo, `origin git@github.com:BaBYLoOn/farah.git`
  (`PROJECT.md`'s "not a git repo" note is stale). Live is systemd `farah` + nginx.
- **Stack:** Nuxt 3 · `@libsql/client` (raw SQL in `server/utils/db.ts`, `db()`
  client + `ensureDb()`) · `nuxt-auth-utils` (cookie `farah-admin`,
  `server/utils/auth.ts` → `requireAdmin(event)`) · `bcryptjs` · `nanoid`.
- **DB:** `NUXT_DB_URL=file:.data/farah.db`. Schema created in `ensureDb()` — add the
  cinema tables there (additive `CREATE TABLE IF NOT EXISTS` + `ALTER` in try/catch,
  same pattern as the source).
- **Content model today:** `posts` (essays + weblog) + site settings via
  `server/utils/site.ts`; public APIs `server/api/site.get.ts`,
  `server/api/posts/*`; admin `server/api/admin/*`; pages `/admin`, `/admin/site`,
  `/admin/post/[id]`, `/admin/login`. Uploads via
  `server/routes/uploads/[...path].get.ts` → `.data/uploads` (**reuse this route**,
  don't add the source's).
- **Theme tokens** (`assets/css/main.css :root`): `--bg #050404`, `--bg2 #0a0707`,
  `--bg3 #100a0a`, `--crimson #6b0000`, `--crimson2 #8b0a0a`,
  `--crimson-bright #b81c1c`, `--crimson-dim #4a0808`, `--bone #d8d2c4`,
  `--bone2 #b6ad9d`, `--bone-dim #7a7268`, `--ivory #ede7d9`, `--ink #050404`.
  Fonts: **Cinzel** (Latin display), **Thmanyah** (Arabic), **Cormorant Garamond /
  EB Garamond** (body). Content is **Arabic / RTL**.
- **Nav:** `components/Navbar.vue` — add a **Cinema** link. Atmosphere components
  already exist in spirit (`BlackOrchid`, `RefMotif`, `PaintingFrame`) — reuse rather
  than porting `CinemaDust` if they fit.

---

## 2. What to port (source file inventory)

From `/home/hal/UAT/husseinkhalid.com`. Copy → adapt (imports, theme, RTL, auth).

**Pages**
- `pages/cinema/index.vue` — public cinema page: favourite carousels + `<CinemaArchive>`.
- `pages/cinema/favorites.vue` — "See all" favourites grid.
- `pages/admin/cinema.vue` — admin CMS (sources, music, add-title, favourites,
  titles archive w/ edit modal). **Fold into Farah's admin** (add an admin-nav link;
  match Farah's `.acard`/form styling — Farah has its own admin CSS).

**Components**
- `components/CinemaArchive.vue` — the shared Watched/Diary archive (list + grid,
  filters, sort, sticky deck + nav-merge, edit pencils in admin). The heart of the UI.
- `components/CinemaDust.vue` — optional atmosphere (or reuse Farah's motifs).

**Public API**
- `server/api/content.get.ts` → **merge into Farah's `site.get.ts`** or add
  `server/api/cinema.get.ts` returning `{ cinemaSettings, films: titles[] }` (never
  private notes). Keep the source's perf lessons (don't ship the full watch log; send
  cheap COUNTs; lazy-load the diary).
- `server/api/diary.get.ts` — flat watch records for the Diary tab (lazy-loaded).
- `server/api/favorites.get.ts` — favourites-only payload for the See-all page.

**Admin API** (all guarded by Farah's `requireAdmin`)
- `titles.get.ts`, `titles.post.ts`, `titles/[id].put.ts`, `titles/[id].delete.ts`
- `import-csv.post.ts` (diary) · **NEW `import-reviews.post.ts`** (see §4)
- `lb-match.post.ts` (exact TMDB via Letterboxd page), `sync.post.ts` (RSS),
  `process.post.ts` (pipeline trigger), `enrich.post.ts`, `imdb-ratings.post.ts`,
  `tmdb-search/-details/-refresh`
- `trakt-connect/-poll/-status/-sync.post.ts`
- `fav-toggle.post.ts`, `fav-order.post.ts`, `settings.put.ts`, `upload.post.ts`
  (use Farah's existing upload instead), `import-imdb.post.ts` (optional/dormant)
- **Skip** `login/logout` — Farah already has auth. But she does **NOT** have the
  source's **change-password endpoint** nor the **1-year session `maxAge`** (checked:
  no `change-password.post.ts`, no `maxAge` in her `nuxt.config`). Port both while
  you're in here — small, high-value: `getAdminHash()` (DB hash overrides env) +
  `/api/admin/change-password` + a "Change password" card, and add
  `session.maxAge = 60*60*24*365` so she stays logged in.

**Server utils**
- `db.ts` — port only the **cinema** tables/helpers into Farah's `db.ts`
  (`titles`, `watches`, `sync_log`, `settings`; `syncWatchCache`, `getSetting`,
  `putSetting`). Farah may already have a settings mechanism — reconcile.
- `csv.ts` (`parseCsv`), `letterboxd.ts` (RSS + `resolveLetterboxdTmdb`),
  `enrich.ts` (TMDB), `imdb.ts` (official ratings dataset — **no key, no OMDb**),
  `trakt.ts` (device auth + reconcile sync), `pipeline.ts` (match→enrich→ratings).

**Routes / plugins**
- `server/plugins/init.ts` — the 6h auto-sync cron (Letterboxd RSS + Trakt when
  connected, respecting `autosync.paused`). Port, but point at **Farah's** feed.
- Client plugins: `plugins/poster.ts` (shimmer directive), `plugins/reveal.ts`
  (v-reveal) — port if Farah doesn't have equivalents. `plugins/site-content.ts`
  (fetch-once state) → adapt to Farah's `useSite()`.

---

## 3. DB schema to add (fresh, empty)

Add to Farah's `ensureDb()` (SQLite/libSQL). Ship **empty** — no seed rows.

```sql
CREATE TABLE IF NOT EXISTS titles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tmdb_id INTEGER, imdb_id TEXT, slug TEXT,
  title TEXT NOT NULL, year INTEGER,
  type TEXT DEFAULT 'film', by TEXT DEFAULT '', runtime TEXT DEFAULT '',
  my_rating REAL, imdb REAL,
  watched TEXT, watches INTEGER DEFAULT 1,
  poster TEXT, poster_local TEXT,
  review TEXT DEFAULT '',           -- was `note` (global public REVIEW)
  note_private TEXT DEFAULT '',      -- optional private note (admin only)
  favorite INTEGER DEFAULT 0, fav_sort INTEGER DEFAULT 0,
  lb_uri TEXT DEFAULT '',            -- Letterboxd film URL → exact TMDB id
  end_year INTEGER, ended INTEGER,   -- series run: "2016–" vs "2016–2019"
  edited INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_id INTEGER NOT NULL, watched TEXT NOT NULL,
  season INTEGER, episode INTEGER,
  note TEXT DEFAULT '', note_private TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_watches_title ON watches (title_id);
CREATE TABLE IF NOT EXISTS sync_log (guid TEXT PRIMARY KEY);
-- settings: reuse Farah's if present, else key/value TEXT (JSON)
```

Notes:
- The source calls the global field `note`; **rename to `review`** here so the code
  reads naturally (or keep `note` in SQL and just relabel in the UI — pick one and be
  consistent). The **per-watch** `watches.note` stays as-is (a diary-entry note),
  optional.
- Keep the source's caches contract: `titles.watched`/`watches` are caches kept in
  step by `syncWatchCache()`; the diary reads the log itself.

---

## 4. NEW — Reviews (the main net-new feature)

Farah writes reviews (`https://letterboxd.com/orchidee26_/reviews/`). Her Letterboxd
**data export ZIP** (Settings → Import & Export → *Export Your Data*) contains both
`diary.csv` **and** `reviews.csv`.

**`reviews.csv` header:** `Date, Name, Year, Letterboxd URI, Rating, Rewatch, Review, Tags, Watched Date`
— the `Review` column holds the text (plain text with newlines).

**Two uploads in admin (Sources card):**
1. **Diary CSV** (`import-csv`) — creates the titles + watch records (existing flow).
2. **Reviews CSV** (`import-reviews` — NEW) — matches each review to a film and sets
   its **global review** (`titles.review`).

**`import-reviews.post.ts` spec:**
- `requireAdmin`; read multipart file; `parseCsv`.
- For each row: match a title by **`Letterboxd URI` → `titles.lb_uri`** (exact),
  else by **Name + Year**.
  - If found → set `titles.review = Review` (and only overwrite when the row's
    review is non-empty).
  - If **not found** → create a minimal `film` title from `Name/Year/Letterboxd URI`
    so no review is lost, then let the pipeline enrich it (poster/runtime/TMDB id).
- **Multiple reviews per film** (rewatches each reviewed): keep the **most recent**
  (max `Watched Date`, fall back to `Date`) as the global review. (Decision to confirm
  with Farah — alternative: concatenate with a separator.)
- Return `{ matched, created, skipped }`. Recommend order: **Diary → Reviews →
  (auto-pipeline runs match/enrich/ratings)**.
- Text safety: render the review as **plain text** (`white-space: pre-line`), like the
  source's notes. If you ever render HTML, run it through Farah's
  `server/utils/sanitize.ts`.

**Rename "Notes" → "Review" (UI):**
- `CinemaArchive.vue` filter chip **`Notes` → `Review`** (a title "has a review" if
  `review` is non-empty; the internal filter key can stay or become `review`).
- Public page: the review shows under each title (same slot the source used for the
  note), labelled/styled as a review — likely an expandable block since reviews are
  longer than one-line notes.
- Admin title editor: **"Public note" field → "Review"**; keep the optional private
  note.

---

## 5. Config / secrets Farah needs (`.env` + `runtimeConfig`)

Add to Farah's `nuxt.config.ts` `runtimeConfig` (filled from `NUXT_*`):

```
letterboxdRss   = 'https://letterboxd.com/orchidee26_/rss/'   # HER feed
tmdbApiKey      = ''    # NUXT_TMDB_API_KEY  (posters, runtime, exact ids)
traktClientId   = ''    # NUXT_TRAKT_CLIENT_ID      — HER Trakt app
traktClientSecret = ''  # NUXT_TRAKT_CLIENT_SECRET  — HER Trakt app
# omdbApiKey NOT needed — IMDb ratings come from the free official dataset (imdb.ts)
```

- **Trakt:** Farah must create her own app at `trakt.tv/oauth/applications`
  (redirect can be the device-flow default); put the client id/secret in `.env`.
  Then admin → **Connect Trakt** (device code → `auth.trakt.tv/activate`) → **Sync**.
  Trakt is behind Cloudflare — `trakt.ts` must send a `User-Agent` header (already
  handled in the source; keep it, e.g. `farahali.com/1.0`).
- **TMDB:** one key (free). **IMDb ratings** need no key (`imdb.ts` downloads
  `datasets.imdbws.com/title.ratings.tsv.gz`).
- Data ships empty; Farah uploads `diary.csv` + `reviews.csv` from her export.

---

## 6. Theme adaptation (source tokens → Farah)

The source's cinema CSS lives in its single `assets/css/main.css`. Port the cinema
sections into Farah's `main.css` and remap tokens:

| Source | Farah |
|---|---|
| `--bg` / `--bg-raised` / `--black` | `--bg` / `--bg2` / `--bg3` / `--ink` |
| `--gold` / subtitle-yellow (IMDb star, favourites accent, marquee) | `--bone` / `--ivory` (or `--crimson-bright` for a hot accent) |
| `--red` / `--red-bright` / `--red-text` (my-rating star, hearts, rules) | `--crimson` / `--crimson-bright` / `--crimson2` |
| `--ink` / `--ink-dim` / `--mute` (text) | `--ivory` / `--bone` / `--bone-dim` / `--bone-faint` |
| `--line` / `--line-soft` (hairlines) | derive from `--bone-faint` at low alpha |
| Display face **Oswald/Cinzel** (marquee, headings) | **Cinzel** (Farah already uses it) |
| Body **Newsreader** (film titles) | **Cormorant Garamond / EB Garamond** |

- **RTL:** Farah's site is `dir="rtl"`. Film titles/years are Latin; wrap the cinema
  UI so numbers, `S02 E05`, ratings, and the sticky deck lay out correctly. Simplest:
  render the cinema page/section **`dir="ltr"`** for the archive/list while keeping
  Arabic chrome (labels) RTL — decide per component. Mirror paddings that assume LTR.
- Reuse Farah's ornaments (`CrimsonRule`, `RefMotif`, `BlackOrchid`, `PaintingFrame`)
  in place of the source's gold marquee/beam where they fit her identity.
- Carry over the **already-fixed** source gotchas: favourites carousel **caps at 10**;
  admin favourites **collapsed by default**; the **iOS `.vignette`** fix (top-anchor +
  `100lvh`, not `inset:0`); the **iOS audio mute** fix (counter-driven fade + `.muted`,
  not `.volume`) — only relevant if you port the ambience.

---

## 7. Carry-over "solved problems" (don't rediscover)

From the source `handoff.md` — all still apply on this server/IP:
- **IMDb pages can't be scraped** from the datacenter IP (empty 202) → use the ratings
  **dataset** (`imdb.ts`). OMDb's free tier caps at 1000/day — not used.
- **Letterboxd RSS = latest 50 only**, no pagination → full history via the CSV export.
- **RSS carries the exact `tmdb:movieId`; diary.csv does NOT** → `lb-match` resolves the
  exact TMDB id from each film's Letterboxd page (`data-tmdb-id`). Order after an
  upload: **Match → Fetch details → Refresh posters** (or just "Fetch missing data" —
  the pipeline chains them).
- **Trakt behind Cloudflare** blocks no-User-Agent requests → send one.
- **Posters** = remote TMDB url primary + downloaded local fallback; uploads route
  flattens paths (keep flat). Blank the img `alt` so a loading poster shows the shimmer,
  not text.
- **Prod-only "insertBefore" blank page**: never put a `v-if`-toggled fixed sibling next
  to `<NuxtPage>` — teleport fixed overlays to `<body>`.
- **Perf**: don't ship the full watch log in the public payload; send cheap COUNTs;
  lazy-load the diary; load site content once into shared state.

---

## 8. Suggested build order

1. **DB + config** — add cinema tables to `ensureDb()`; add runtimeConfig keys; put
   TMDB key + Farah's Trakt keys + her RSS in UAT `.env`. Confirm git/deploy path.
2. **Server utils** — port `csv`, `letterboxd`, `enrich`, `imdb`, `trakt`, `pipeline`;
   port cinema helpers into Farah's `db.ts`.
3. **Admin API** — titles CRUD, `import-csv`, **`import-reviews`**, `lb-match`, `sync`,
   `process`, tmdb-*, trakt-*, fav-*, settings. Guard with Farah's `requireAdmin`.
4. **Public API** — `cinema.get`/merge into `site.get`, `diary.get`, `favorites.get`.
5. **Admin UI** — a Cinema screen in Farah's admin (sources incl. **two uploads**,
   music optional, add-title, favourites, titles archive + edit modal). "Notes"→
   "Review".
6. **Public UI** — `/cinema` (favourite carousels + `CinemaArchive`) +
   `/cinema/favorites`; nav link; **restyle to Farah's theme + RTL**.
7. **init cron** — 6h auto-sync against her feed (pausable).
8. **Verify** — Farah connects Trakt, uploads `diary.csv` then `reviews.csv`; confirm
   titles fill (posters/runtime/ratings), reviews attach as global reviews, favourites
   + diary + Review filter work. Screenshot mobile (the harness recipe is in the
   `headless-screenshots-server` memory).

---

## 9. Open decisions for Farah / the user

- **Multiple reviews per film:** newest wins (default) vs. concatenate all.
- **Reviewed-but-not-in-diary film:** auto-create the title (default) vs. skip.
- **RTL treatment** of the cinema list (full `dir=ltr` island vs. RTL chrome + LTR data).
- **Ambience/music:** port the mute + uploaded-track player, or leave the cinema silent?
- **Series (Trakt):** include TV like the source, or films-only for her v1?

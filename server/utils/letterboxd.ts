import { db, syncWatchCache } from './db'
import { extractReviewText, upsertReview } from './reviews'
import { downloadPoster } from './enrich'

const UA = 'farahali.com/1.0'

// Letterboxd serves its film-page markup (poster JSON-LD, data-tmdb-id) only to
// a browser-shaped UA — the plain one above gets a stripped page.
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : null
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
}

// Does this id actually resolve on TMDB, and under which endpoint? Letterboxd's
// declared type is a hint, not the truth (it calls Serial Experiments Lain a
// movie), so try the declared kind first and then the other. Returns null when
// the id resolves under neither — Letterboxd carries plenty of stale ids
// pointing at TMDB entries that have since been deleted or merged.
async function tmdbKindFor(id: number, declared: 'movie' | 'tv'): Promise<'movie' | 'tv' | null> {
  const key = useRuntimeConfig().tmdbApiKey as string
  if (!key) return declared // can't verify without a key; trust Letterboxd
  for (const kind of [declared, declared === 'movie' ? 'tv' : 'movie'] as const) {
    try {
      const r = await $fetch<any>(`https://api.themoviedb.org/3/${kind}/${id}?api_key=${key}`, { timeout: 15_000 })
      if (r?.id) return kind
    } catch { /* 404 — try the other endpoint */ }
  }
  return null
}

// Resolve the EXACT TMDB id/type for titles carrying a Letterboxd URL (from the
// diary/ratings CSV). Each Letterboxd FILM page exposes data-tmdb-id +
// data-tmdb-type, which beats the fuzzy title+year guess — that guess is what
// put Kubrick's "2001: A Space Odyssey" behind Makoto Tezuka's "2001", "Horse
// Girl" behind "Girl", and "The Call of the Wild" behind "The Call".
//
// `recheck` re-verifies titles that ALREADY have a tmdb_id instead of only
// filling blanks. A wrong id is invisible to a blanks-only pass, so correcting
// the fuzzy-matched back catalogue needs this. Hand-edited titles are never
// touched either way.
export async function resolveLetterboxdTmdb(limit = 40, afterId = 0, opts: { recheck?: boolean } = {}) {
  const d = db()
  const rows = await d.execute({
    sql: `SELECT id, tmdb_id, lb_uri FROM titles
          WHERE lb_uri IS NOT NULL AND lb_uri != ''
            ${opts.recheck ? '' : 'AND tmdb_id IS NULL'}
            AND id > ? AND edited = 0
          ORDER BY id ASC LIMIT ?`,
    args: [afterId, limit],
  })

  let matched = 0, corrected = 0, failed = 0, skipped = 0, cursor = afterId
  const changes: Array<{ id: number; from: number | null; to: number }> = []

  for (const row of rows.rows as any[]) {
    cursor = Number(row.id)
    try {
      const get = (u: string) =>
        $fetch<string>(u, { responseType: 'text', headers: { 'User-Agent': BROWSER_UA }, timeout: 20_000 })

      let html = String(await get(String(row.lb_uri).replace(/\/$/, '') + '/'))
      let idM = html.match(/data-tmdb-id="(\d+)"/)

      // A stored lb_uri is often a DIARY ENTRY page, which carries no tmdb id —
      // follow it through to the film page it links to.
      if (!idM) {
        const slug = html.match(/\/film\/[a-z0-9][a-z0-9-]*\//)?.[0]
        if (slug) {
          html = String(await get(`https://letterboxd.com${slug}`))
          idM = html.match(/data-tmdb-id="(\d+)"/)
        }
      }

      const typeM = html.match(/data-tmdb-type="(movie|tv)"/)
      const tmdbId = idM ? Number(idM[1]) : null
      if (!tmdbId) { failed++; continue }

      const had = row.tmdb_id == null ? null : Number(row.tmdb_id)

      // Letterboxd is authoritative about WHICH film this is, but not about the
      // id still being live — some of its ids point at TMDB entries that were
      // deleted or merged. Never trade a working id for one that resolves
      // nowhere: that is what turned Serial Experiments Lain from the real TV
      // series into a dead movie id.
      const kind = await tmdbKindFor(tmdbId, typeM?.[1] === 'tv' ? 'tv' : 'movie')
      if (!kind) {
        if (had != null) { skipped++; continue }  // keep what we have
        failed++; continue                        // nothing to keep — leave blank
      }

      const isTv = kind === 'tv'
      const wrong = had != null && had !== tmdbId
      if (wrong) { corrected++; changes.push({ id: Number(row.id), from: had, to: tmdbId }) }

      // When the id was wrong, everything derived from it is wrong too — blank it
      // so the enrich pass refetches against the right film. Her OWN data (title,
      // year, rating, reviews, watch dates, favourite) is never touched.
      const reset = wrong
        ? `, imdb_id = NULL, imdb = NULL, poster = NULL, poster_local = NULL,
             by = '', runtime = '', end_year = NULL, ended = NULL`
        : ''
      await d.execute({
        sql: `UPDATE titles SET tmdb_id = ?, type = ?, tmdb_kind = ?${reset} WHERE id = ?`,
        args: [tmdbId, isTv ? 'series' : 'film', isTv ? 'tv' : 'movie', row.id],
      })
      matched++
    } catch {
      failed++
    }
    await new Promise((r) => setTimeout(r, 1200))
  }

  return { matched, corrected, failed, skipped, cursor, changes, done: rows.rows.length < limit }
}

// Pull the poster Letterboxd shows for a film. Its JSON-LD carries the artwork
// URL; the size is encoded in the filename, so ask for 600x900 rather than the
// 230x345 thumbnail some pages embed.
function posterFromHtml(html: string): string | null {
  const m = html.match(/"image":"(https:\/\/a\.ltrbxd\.com\/resized\/film-poster\/[^"]+)"/)
  if (!m) return null
  return m[1].replace(/-0-\d+-0-\d+-crop\./, '-0-600-0-900-crop.')
}

// Last-resort poster source for titles TMDB simply has no artwork for — mostly
// experimental shorts, which is a real slice of Farah's diary. Only ever fills a
// gap: titles that already have a poster are never touched.
export async function letterboxdPosters(limit = 40, afterId = 0) {
  const d = db()
  const rows = await d.execute({
    sql: `SELECT id, lb_uri FROM titles
          WHERE lb_uri IS NOT NULL AND lb_uri != ''
            AND poster IS NULL AND poster_local IS NULL
            AND id > ?
          ORDER BY id ASC LIMIT ?`,
    args: [afterId, limit],
  })

  let filled = 0, failed = 0, cursor = afterId

  for (const row of rows.rows as any[]) {
    cursor = Number(row.id)
    try {
      const get = (u: string) =>
        $fetch<string>(u, { responseType: 'text', headers: { 'User-Agent': BROWSER_UA }, timeout: 20_000 })

      const html = String(await get(String(row.lb_uri).replace(/\/$/, '') + '/'))
      let poster = posterFromHtml(html)

      // A stored lb_uri is often a diary-entry page, which carries a backdrop
      // rather than the poster — follow it through to the film page.
      if (!poster) {
        const slug = html.match(/\/film\/[a-z0-9][a-z0-9-]*\//)?.[0]
        if (slug) poster = posterFromHtml(String(await get(`https://letterboxd.com${slug}`)))
      }
      if (!poster) { failed++; continue }

      const local = await downloadPoster(poster, Number(row.id))
      await d.execute({
        sql: 'UPDATE titles SET poster = COALESCE(poster, ?), poster_local = COALESCE(poster_local, ?) WHERE id = ?',
        args: [poster, local, row.id],
      })
      filled++
    } catch {
      failed++
    }
    await new Promise((r) => setTimeout(r, 900)) // be polite to Letterboxd
  }

  return { filled, failed, cursor, done: rows.rows.length < limit }
}

// Sync Farah's Letterboxd RSS (latest ~50). Per the requirement, DIARIES are
// pulled first (create titles + watch records), THEN reviews are attached to
// those titles from the same feed's descriptions.
export async function syncLetterboxd() {
  const url = useRuntimeConfig().letterboxdRss as string
  if (!url) return { imported: 0, updated: 0, skipped: 0, reviews: 0, error: 'no RSS url configured' }

  const xml = await $fetch<string>(url, { responseType: 'text', headers: { 'User-Agent': UA }, timeout: 20_000 })
  const items = String(xml).split('<item>').slice(1)
  const d = db()
  let imported = 0, updated = 0, skipped = 0, reviews = 0

  // ── pass 1: diaries ──────────────────────────────────────────────
  for (const item of items) {
    const guid = tag(item, 'guid')
    const filmTitle = tag(item, 'letterboxd:filmTitle')
    const watchedDate = tag(item, 'letterboxd:watchedDate')
    if (!guid || !filmTitle || !watchedDate) { skipped++; continue }

    const seen = await d.execute({ sql: 'SELECT 1 FROM sync_log WHERE guid = ?', args: [guid] })
    if (seen.rows.length) { skipped++; continue }

    const title = decode(filmTitle)
    const year = Number(tag(item, 'letterboxd:filmYear') ?? 0) || null
    const memberRating = tag(item, 'letterboxd:memberRating')
    const myRating = memberRating != null ? Number(memberRating) * 2 : null
    const tmdbId = Number(tag(item, 'tmdb:movieId') ?? 0) || null
    // NB: we deliberately do NOT store the Letterboxd poster — the poster comes
    // from TMDB via enrichment (higher quality, and a downloaded local fallback)

    const existing = await d.execute({
      sql: `SELECT id, edited FROM titles
            WHERE (tmdb_id IS NOT NULL AND tmdb_id = ?)
               OR (lower(title) = lower(?) AND (year = ? OR ? IS NULL))
            LIMIT 1`,
      args: [tmdbId, title, year, year],
    })

    let titleId: number
    if (existing.rows.length) {
      const rowr = existing.rows[0] as any
      titleId = Number(rowr.id)
      const edited = Number(rowr.edited) === 1
      await d.execute({
        sql: `UPDATE titles SET
                tmdb_id = COALESCE(tmdb_id, ?),
                my_rating = CASE WHEN ? AND ? IS NOT NULL THEN ? ELSE my_rating END
              WHERE id = ?`,
        args: [tmdbId, edited ? 0 : 1, myRating, myRating, titleId],
      })
      updated++
    } else {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const ins = await d.execute({
        sql: `INSERT INTO titles (tmdb_id, slug, title, year, type, by, runtime, my_rating, imdb, watched, watches)
              VALUES (?,?,?,?,'film','','',?,NULL,?,1)`,
        args: [tmdbId, slug, title, year, myRating, watchedDate],
      })
      titleId = Number(ins.lastInsertRowid)
      imported++
    }

    await d.execute({ sql: 'INSERT INTO watches (title_id, watched) VALUES (?, ?)', args: [titleId, watchedDate] })
    await syncWatchCache(titleId)
    await d.execute({ sql: 'INSERT INTO sync_log (guid) VALUES (?)', args: [guid] })
  }

  // ── pass 2: reviews (titles now exist from pass 1) ───────────────
  for (const item of items) {
    const guid = tag(item, 'guid')
    const filmTitle = tag(item, 'letterboxd:filmTitle')
    const watchedDate = tag(item, 'letterboxd:watchedDate')
    const description = tag(item, 'description')
    if (!guid || !filmTitle || !description) continue
    const text = extractReviewText(description)
    if (!text) continue
    const memberRating = tag(item, 'letterboxd:memberRating')
    const res = await upsertReview({
      guid: `lb-${guid}`,
      tmdbId: Number(tag(item, 'tmdb:movieId') ?? 0) || null,
      title: decode(filmTitle),
      year: Number(tag(item, 'letterboxd:filmYear') ?? 0) || null,
      reviewed: watchedDate,
      rating: memberRating != null ? Number(memberRating) * 2 : null,
      text,
    })
    if (res === 'added') reviews++
  }

  return { imported, updated, skipped, reviews }
}

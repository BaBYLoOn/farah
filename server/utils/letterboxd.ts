import { db, syncWatchCache } from './db'
import { extractReviewText, upsertReview } from './reviews'

const UA = 'farahali.com/1.0'

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : null
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
}

// Resolve the EXACT TMDB id/type for titles carrying a Letterboxd URL (from the
// diary.csv). Each Letterboxd film page exposes data-tmdb-id + data-tmdb-type,
// replacing the fuzzy title+year guess. Incremental (only tmdb_id IS NULL), so
// it's safe to auto-run after every sync. Leaves hand-edited titles alone.
export async function resolveLetterboxdTmdb(limit = 40, afterId = 0) {
  const d = db()
  const rows = await d.execute({
    sql: `SELECT id, lb_uri FROM titles
          WHERE lb_uri IS NOT NULL AND lb_uri != '' AND tmdb_id IS NULL AND id > ? AND edited = 0
          ORDER BY id ASC LIMIT ?`,
    args: [afterId, limit],
  })

  let matched = 0, corrected = 0, failed = 0, cursor = afterId

  for (const row of rows.rows as any[]) {
    cursor = Number(row.id)
    try {
      const url = String(row.lb_uri).replace(/\/$/, '') + '/'
      const html = await $fetch<string>(url, { responseType: 'text', headers: { 'User-Agent': UA }, timeout: 20_000 })
      const idM = String(html).match(/data-tmdb-id="(\d+)"/)
      const typeM = String(html).match(/data-tmdb-type="(movie|tv)"/)
      const tmdbId = idM ? Number(idM[1]) : null
      if (!tmdbId) { failed++; continue }
      const type = typeM?.[1] === 'tv' ? 'series' : 'film'

      const cur = await d.execute({ sql: 'SELECT tmdb_id FROM titles WHERE id = ?', args: [row.id] })
      const had = (cur.rows[0] as any)?.tmdb_id
      const wrong = had != null && Number(had) !== tmdbId
      if (wrong) corrected++
      await d.execute({
        sql: `UPDATE titles SET tmdb_id = ?, type = ?,
                imdb_id = CASE WHEN ? THEN NULL ELSE imdb_id END,
                poster = CASE WHEN ? THEN NULL ELSE poster END
              WHERE id = ?`,
        args: [tmdbId, type, wrong ? 1 : 0, wrong ? 1 : 0, row.id],
      })
      matched++
    } catch {
      failed++
    }
    await new Promise((r) => setTimeout(r, 1200))
  }

  return { matched, corrected, failed, cursor, done: rows.rows.length < limit }
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

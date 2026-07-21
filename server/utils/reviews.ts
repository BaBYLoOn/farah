import { db } from './db'
import { parseCsv } from './csv'

// Reviews are DATED and there can be MANY per title (one per reviewed diary
// entry). They're matched to a film that must already exist in the diary. Two
// sources: the Letterboxd RSS description (primary, latest ~50) and the full
// reviews.csv export (backfill). Dedup is by `guid`.

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
}

// A Letterboxd RSS <description> is CDATA-wrapped: `<![CDATA[ <p><img poster></p>
// <p>Watched on <date>.</p> ]]>` for a plain watch, or the poster plus the
// review paragraph(s) when there's a review. Strip the CDATA, poster and the
// "Watched/Rewatched on <date>." boilerplate → the review text ('' if none).
export function extractReviewText(description: string): string {
  const text = decode(
    description
      .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '') // unwrap CDATA
      .replace(/<p>\s*<img[^>]*>\s*<\/p>/gi, '')          // poster paragraph
      .replace(/<img[^>]*>/gi, '')                        // any stray poster
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    // Letterboxd's non-review boilerplate line(s)
    .replace(/(?:Watched|Rewatched|Added) on \w+ \w+ \d+,? \d+\.?/gi, '')
    .trim()
  return text
}

async function findTitleId(opts: { tmdbId?: number | null; title: string; year?: number | null; lbUri?: string | null }): Promise<number | null> {
  const d = db()
  if (opts.lbUri) {
    const byUri = await d.execute({ sql: `SELECT id FROM titles WHERE lb_uri = ? LIMIT 1`, args: [opts.lbUri.replace(/\/$/, '') + '/'] })
    if (byUri.rows.length) return Number((byUri.rows[0] as any).id)
  }
  const r = await d.execute({
    sql: `SELECT id FROM titles
          WHERE (tmdb_id IS NOT NULL AND tmdb_id = ?)
             OR (lower(title) = lower(?) AND (year = ? OR ? IS NULL))
          ORDER BY (tmdb_id = ?) DESC LIMIT 1`,
    args: [opts.tmdbId ?? null, opts.title, opts.year ?? null, opts.year ?? null, opts.tmdbId ?? null],
  })
  return r.rows.length ? Number((r.rows[0] as any).id) : null
}

// upsert one review; returns 'added' when it attached to a title, 'nomatch'
// when the film isn't in the diary yet (so: sync diaries FIRST), 'skip' if empty
export async function upsertReview(item: {
  guid: string
  tmdbId?: number | null
  title: string
  year?: number | null
  lbUri?: string | null
  reviewed: string | null
  rating: number | null
  text: string
}): Promise<'added' | 'nomatch' | 'skip'> {
  if (!item.text || !item.text.trim()) return 'skip'
  const titleId = await findTitleId(item)
  if (!titleId) return 'nomatch'
  await db().execute({
    sql: `INSERT INTO reviews (title_id, reviewed, text, rating, guid) VALUES (?,?,?,?,?)
          ON CONFLICT(guid) DO UPDATE SET
            title_id = excluded.title_id, reviewed = excluded.reviewed,
            text = excluded.text, rating = excluded.rating`,
    args: [titleId, item.reviewed, item.text.trim(), item.rating, item.guid],
  })
  return 'added'
}

// Full-history backfill from the Letterboxd `reviews.csv`
// (columns: Date, Name, Year, Letterboxd URI, Rating, Rewatch, Review, Tags, Watched Date).
export async function importReviewsCsv(text: string) {
  const rows = parseCsv(text)
  if (!rows.length) throw createError({ statusCode: 400, statusMessage: 'Empty CSV' })
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (n: string) => header.indexOf(n)
  const iName = col('name'), iYear = col('year'), iUri = col('letterboxd uri')
  const iRating = col('rating'), iReview = col('review')
  const iWatched = col('watched date') !== -1 ? col('watched date') : col('date')
  if (iName === -1 || iReview === -1) {
    throw createError({ statusCode: 400, statusMessage: 'Not a Letterboxd reviews.csv (need Name + Review columns)' })
  }

  let added = 0, nomatch = 0, skipped = 0
  for (const r of rows.slice(1)) {
    const title = (r[iName] ?? '').trim()
    const reviewText = (r[iReview] ?? '').trim()
    if (!title || !reviewText) { skipped++; continue }
    const year = iYear !== -1 ? Number(r[iYear]) || null : null
    const uri = iUri !== -1 ? (r[iUri] ?? '').trim() : ''
    const watched = iWatched !== -1 ? (r[iWatched] ?? '').trim() : ''
    const stars = iRating !== -1 ? Number(r[iRating]) : NaN
    const rating = Number.isNaN(stars) ? null : stars * 2
    const guid = `rev-csv-${uri || `${title}-${year}`}-${watched}`
    const res = await upsertReview({ guid, title, year, lbUri: uri || null, reviewed: watched || null, rating, text: reviewText })
    if (res === 'added') added++
    else if (res === 'nomatch') nomatch++
    else skipped++
  }
  return { added, nomatch, skipped }
}

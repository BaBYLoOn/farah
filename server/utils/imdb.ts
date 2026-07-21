import { gunzipSync } from 'node:zlib'
import { db } from './db'

// IMDb ratings, the reliable way. OMDb's free tier caps at 1000 lookups/day,
// so it can't cover a whole library. IMDb instead publishes the FULL ratings
// table daily as a gzipped TSV (tconst, averageRating, numVotes) with no key
// and no rate limit — one download sets the rating for every title we have an
// IMDb id for. https://datasets.imdbws.com/title.ratings.tsv.gz
export async function importImdbRatings() {
  const d = db()
  const rows = await d.execute("SELECT imdb_id FROM titles WHERE imdb_id IS NOT NULL AND imdb_id != ''")
  const want = new Set(rows.rows.map((r: any) => String(r.imdb_id)))
  if (!want.size) return { updated: 0, total: 0 }

  const gz = await $fetch<ArrayBuffer>('https://datasets.imdbws.com/title.ratings.tsv.gz', {
    responseType: 'arrayBuffer',
    timeout: 90_000,
  })
  const text = gunzipSync(Buffer.from(gz)).toString('utf-8')

  let updated = 0
  const lines = text.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const t1 = line.indexOf('\t')
    if (t1 < 0) continue
    const tconst = line.slice(0, t1)
    if (!want.has(tconst)) continue
    const rest = line.slice(t1 + 1)
    const t2 = rest.indexOf('\t')
    const rating = Number.parseFloat(t2 < 0 ? rest : rest.slice(0, t2))
    if (!Number.isNaN(rating)) {
      // the IMDb rating is an objective figure — safe to overwrite everywhere
      await d.execute({ sql: 'UPDATE titles SET imdb = ? WHERE imdb_id = ?', args: [rating, tconst] })
      updated++
    }
  }
  return { updated, total: want.size }
}

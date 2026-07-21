import { db, rowToTitle } from '../../utils/db'

// Small, fast payload for the /cinema/favorites page — just the favourite
// posters (or top-rated fallback), no watch logs, no reviews.
export default defineEventHandler(async () => {
  const d = db()

  async function forKind(kind: 'film' | 'series') {
    const hasPoster = '(poster IS NOT NULL OR poster_local IS NOT NULL)'
    let res = await d.execute({
      sql: `SELECT * FROM titles WHERE type = ? AND favorite = 1 AND ${hasPoster} ORDER BY fav_sort ASC`,
      args: [kind],
    })
    if (!res.rows.length) {
      res = await d.execute({
        sql: `SELECT * FROM titles WHERE type = ? AND ${hasPoster} ORDER BY my_rating DESC, imdb DESC LIMIT 12`,
        args: [kind],
      })
    }
    return res.rows.map((r: any) => {
      const t = rowToTitle(r)
      return { id: t.id, title: t.title, year: t.year, poster: t.poster, posterLocal: t.posterLocal, imdbId: t.imdbId }
    })
  }

  return { films: await forKind('film'), series: await forKind('series') }
})

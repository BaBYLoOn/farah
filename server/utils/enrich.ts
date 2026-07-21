import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from './db'

// Fills in runtime, director/creator, poster, IMDb rating and IMDb id for
// titles that lack them. Uses TMDB (details/credits/external_ids). Needs a free
// TMDB key (NUXT_TMDB_API_KEY). IMDb ratings come from the official dataset
// (imdb.ts), not OMDb. Posters are downloaded into ./uploads so the site never
// depends on TMDB's CDN staying up.

export function fmtRuntime(min: number | null | undefined): string {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

// a series' run from TMDB: the last-aired year, and whether it has ended.
export function seriesRun(det: any): { endYear: number | null; ended: 0 | 1 } {
  const endYear = Number(String(det.last_air_date ?? '').slice(0, 4)) || null
  const status = String(det.status ?? '')
  const ended = (status === 'Ended' || status === 'Canceled') ? 1 : 0
  return { endYear, ended }
}

// series runtime = a typical episode, not the whole run
export function seriesRuntime(det: any): string {
  const declared: number[] = Array.isArray(det.episode_run_time) ? det.episode_run_time.filter((n: any) => Number(n) > 0) : []
  if (declared.length) {
    return fmtRuntime(Math.round(declared.reduce((a, b) => a + b, 0) / declared.length))
  }
  return fmtRuntime(det.last_episode_to_air?.runtime ?? det.next_episode_to_air?.runtime ?? null)
}

// Who a series is "by". TMDB's created_by is empty for most anime, so fall back
// to the crew credit that actually names the author. Never falls back to a
// director — a series is credited to its creator, not whoever directed it.
export function seriesCreator(det: any): string {
  const named = det.created_by?.[0]?.name
  if (named) return String(named)

  const crew: any[] = det.aggregate_credits?.crew ?? []
  const jobsOf = (c: any): string[] =>
    Array.isArray(c.jobs) ? c.jobs.map((j: any) => String(j.job ?? '')) : [String(c.job ?? '')]

  for (const want of ['Original Series Creator', 'Original Story', 'Comic Book', 'Novel', 'Series Composition']) {
    const hit = crew.find((c) => jobsOf(c).includes(want))
    if (hit?.name) return String(hit.name)
  }
  return ''
}

// pull a remote poster down to ./uploads/poster-<titleId>.<ext> (Farah serves
// /uploads from that dir); returns the local /uploads url, or null on failure
export async function downloadPoster(url: string, titleId: number): Promise<string | null> {
  try {
    const buf = await $fetch<ArrayBuffer>(url, { responseType: 'arrayBuffer', timeout: 20_000 })
    if (!buf || (buf as ArrayBuffer).byteLength < 1000) return null
    const ext = url.split('.').pop()?.split('?')[0].toLowerCase()
    const safeExt = ext && ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext) ? ext : 'jpg'
    const name = `poster-${titleId}.${safeExt}`
    const dir = join(process.cwd(), 'uploads')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, name), Buffer.from(buf as ArrayBuffer))
    return `/uploads/${name}`
  } catch {
    return null
  }
}

export async function enrichTitles(limit = 60) {
  const cfg = useRuntimeConfig()
  const tmdbKey = cfg.tmdbApiKey as string
  if (!tmdbKey) return { enriched: 0, failed: 0, remaining: 0, error: 'No TMDB API key set (NUXT_TMDB_API_KEY)' }

  const NEEDY = `(runtime = '' OR imdb_id IS NULL OR tmdb_id IS NULL
                 OR (poster IS NULL AND poster_local IS NULL)
                 OR (type = 'series' AND ended IS NULL))`

  const d = db()
  const rows = await d.execute({
    sql: `SELECT id, tmdb_id, tmdb_kind, title, year, type, poster, poster_local, imdb_id FROM titles
          WHERE ${NEEDY}
          ORDER BY watched DESC LIMIT ?`,
    args: [limit],
  })

  let enriched = 0
  let failed = 0

  for (const row of rows.rows as any[]) {
    try {
      const isTv = String(row.type) === 'series'
      let tmdbId = row.tmdb_id ? Number(row.tmdb_id) : null

      // Letterboxd logs anime/TV series as ordinary "films", so a title typed
      // as a film can still only exist on TMDB's /tv side. Search the expected
      // endpoint first, then fall back to the other one before giving up —
      // otherwise those titles never get a tmdb_id, and so never get a poster.
      let resolvedTv = row.tmdb_kind ? String(row.tmdb_kind) === 'tv' : isTv
      if (!tmdbId) {
        const search = async (kind: 'movie' | 'tv') => {
          const q = new URLSearchParams({ api_key: tmdbKey, query: String(row.title) })
          if (row.year) q.set(kind === 'tv' ? 'first_air_date_year' : 'year', String(row.year))
          const res = await $fetch<any>(`https://api.themoviedb.org/3/search/${kind}?${q}`, { timeout: 15_000 })
          return res?.results?.[0]?.id ?? null
        }
        const primary = resolvedTv ? 'tv' : 'movie'
        const secondary = resolvedTv ? 'movie' : 'tv'
        tmdbId = await search(primary)
        if (!tmdbId) {
          tmdbId = await search(secondary)
          if (tmdbId) resolvedTv = secondary === 'tv'
        }
        if (!tmdbId) { failed++; continue }
      }

      const kind = resolvedTv ? 'tv' : 'movie'
      const extra = resolvedTv ? 'credits,external_ids,aggregate_credits' : 'credits,external_ids'
      const det = await $fetch<any>(
        `https://api.themoviedb.org/3/${kind}/${tmdbId}?api_key=${tmdbKey}&append_to_response=${extra}`,
        { timeout: 15_000 },
      )

      const runtime = resolvedTv ? seriesRuntime(det) : fmtRuntime(det.runtime)
      const director = resolvedTv ? seriesCreator(det) : (det.credits?.crew?.find((c: any) => c.job === 'Director')?.name ?? '')
      const imdbId = det.external_ids?.imdb_id ?? det.imdb_id ?? null

      const remote = det.poster_path ? `https://image.tmdb.org/t/p/w500${det.poster_path}` : null
      let posterLocal: string | null = row.poster_local == null ? null : String(row.poster_local)
      if (remote && !posterLocal) {
        posterLocal = await downloadPoster(remote, Number(row.id))
      }

      const run = resolvedTv ? seriesRun(det) : { endYear: null, ended: null }

      await d.execute({
        sql: `UPDATE titles SET
                tmdb_id = COALESCE(tmdb_id, ?),
                tmdb_kind = ?,
                type = ?,
                imdb_id = COALESCE(imdb_id, ?),
                runtime = CASE WHEN runtime = '' THEN ? ELSE runtime END,
                by = CASE WHEN by = '' THEN ? ELSE by END,
                poster = COALESCE(?, poster),
                poster_local = COALESCE(?, poster_local),
                end_year = ?,
                ended = ?
              WHERE id = ?`,
        // TMDB is the authority on what a title IS: something Letterboxd logged as
        // a "film" but that only exists under /tv is a series, and must be shown as
        // one (with its creator, not a director).
        args: [tmdbId, kind, resolvedTv ? 'series' : 'film', imdbId, runtime, director, remote, posterLocal, run.endYear, run.ended, row.id],
      })
      enriched++
    } catch {
      failed++
    }
  }

  const left = await d.execute(`SELECT COUNT(*) AS n FROM titles WHERE ${NEEDY}`)
  return { enriched, failed, remaining: Number((left.rows[0] as any).n) }
}

// Refreshes titles that already have a tmdb_id: latest poster (TV art changes
// per season) + current IMDb rating, force-overwriting both. Skips hand-edited
// titles unless includeEdited. Cursor-based for batch walking.
export async function refreshTmdb(limit = 60, afterId = 0, includeEdited = false) {
  const cfg = useRuntimeConfig()
  const tmdbKey = cfg.tmdbApiKey as string
  if (!tmdbKey) return { refreshed: 0, failed: 0, cursor: 0, done: true, error: 'No TMDB API key set (NUXT_TMDB_API_KEY)' }

  const d = db()
  const rows = await d.execute({
    sql: `SELECT id, tmdb_id, tmdb_kind, type, imdb_id FROM titles
          WHERE tmdb_id IS NOT NULL AND id > ? ${includeEdited ? '' : 'AND edited = 0'}
          ORDER BY id ASC LIMIT ?`,
    args: [afterId, limit],
  })

  let refreshed = 0
  let failed = 0
  let cursor = afterId

  for (const row of rows.rows as any[]) {
    cursor = Number(row.id)
    try {
      // trust the recorded endpoint — a Letterboxd-logged series is type 'film'
      // but its id only resolves under /tv
      const isTv = row.tmdb_kind ? String(row.tmdb_kind) === 'tv' : String(row.type) === 'series'
      const kind = isTv ? 'tv' : 'movie'
      const det = await $fetch<any>(
        `https://api.themoviedb.org/3/${kind}/${row.tmdb_id}?api_key=${tmdbKey}&append_to_response=external_ids`,
        { timeout: 15_000 },
      )

      const remote = det.poster_path ? `https://image.tmdb.org/t/p/w500${det.poster_path}` : null
      const imdbId = row.imdb_id ?? det.external_ids?.imdb_id ?? det.imdb_id ?? null
      const posterLocal = remote ? await downloadPoster(remote, Number(row.id)) : null
      const run = isTv ? seriesRun(det) : { endYear: null, ended: null }

      await d.execute({
        sql: `UPDATE titles SET
                poster = COALESCE(?, poster),
                poster_local = COALESCE(?, poster_local),
                imdb_id = COALESCE(imdb_id, ?),
                end_year = ?,
                ended = ?
              WHERE id = ?`,
        args: [remote, posterLocal, imdbId, run.endYear, run.ended, row.id],
      })
      refreshed++
    } catch {
      failed++
    }
  }

  return { refreshed, failed, cursor, done: rows.rows.length < limit }
}

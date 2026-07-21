import { db, getSetting, putSetting, syncWatchCache } from './db'

// Trakt.tv — pulls the user's episode watch history and show ratings.
// Needs a (free) Trakt app: trakt.tv/oauth/applications → set
// NUXT_TRAKT_CLIENT_ID + NUXT_TRAKT_CLIENT_SECRET in .env, then use
// "Connect Trakt" in the admin (device-code flow, token kept in settings).

const API = 'https://api.trakt.tv'

// Trakt sits behind Cloudflare, which 403s requests with no User-Agent
// (ofetch/undici sends none) — every call must identify itself.
const UA = 'farahali.com/1.0'

type TraktToken = {
  access_token: string
  refresh_token: string
  created_at: number
  expires_in: number
}

function clientCfg() {
  const cfg = useRuntimeConfig()
  return { id: cfg.traktClientId as string, secret: cfg.traktClientSecret as string }
}

// headers for the OAuth endpoints (device code / token exchange)
function authHeaders() {
  return { 'Content-Type': 'application/json', 'User-Agent': UA }
}

function apiHeaders(token?: string) {
  const { id } = clientCfg()
  return {
    'Content-Type': 'application/json',
    'User-Agent': UA,
    'trakt-api-version': '2',
    'trakt-api-key': id,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// step 1 of connecting: get a code the user types at trakt.tv/activate
export async function deviceCode() {
  const { id } = clientCfg()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'No Trakt client id set (NUXT_TRAKT_CLIENT_ID)' })
  const r = await $fetch<any>(`${API}/oauth/device/code`, {
    method: 'POST',
    headers: authHeaders(),
    body: { client_id: id },
    timeout: 15_000,
  })
  await putSetting('trakt_device', r)
  return { userCode: r.user_code, url: r.verification_url, interval: r.interval }
}

// step 2: poll until the user has approved the code
export async function devicePoll() {
  const { id, secret } = clientCfg()
  const dev = await getSetting<any>('trakt_device')
  if (!dev?.device_code) throw createError({ statusCode: 400, statusMessage: 'Start the connect flow first' })
  try {
    const tok = await $fetch<TraktToken>(`${API}/oauth/device/token`, {
      method: 'POST',
      headers: authHeaders(),
      body: { code: dev.device_code, client_id: id, client_secret: secret },
      timeout: 15_000,
    })
    await putSetting('trakt_token', tok)
    return { connected: true }
  } catch (err: any) {
    if (err?.response?.status === 400) return { connected: false, pending: true } // user hasn't approved yet
    throw err
  }
}

async function accessToken(): Promise<string> {
  const tok = await getSetting<TraktToken>('trakt_token')
  if (!tok) throw createError({ statusCode: 400, statusMessage: 'Trakt is not connected' })
  const expiresAt = (tok.created_at + tok.expires_in) * 1000
  if (Date.now() < expiresAt - 86_400_000) return tok.access_token

  // refresh a token in its last day
  const { id, secret } = clientCfg()
  const fresh = await $fetch<TraktToken>(`${API}/oauth/token`, {
    method: 'POST',
    headers: authHeaders(),
    body: {
      refresh_token: tok.refresh_token,
      client_id: id,
      client_secret: secret,
      grant_type: 'refresh_token',
    },
    timeout: 15_000,
  })
  await putSetting('trakt_token', fresh)
  return fresh.access_token
}

// full sync as a RECONCILE: the site's Trakt-managed series (auto-created,
// edited = 0) are made to match Trakt exactly — so removing a show or episode
// on Trakt removes it here too. We fetch everything first, and only then
// delete/rewrite, so a mid-fetch API error can't wipe data.
export async function syncTrakt() {
  const token = await accessToken()
  const d = db()

  let shows = 0
  const showIds = new Map<number, number>() // trakt show tmdb id → titles.id

  async function titleForShow(show: any): Promise<number | null> {
    const tmdbId = show?.ids?.tmdb ?? null
    const imdbId = show?.ids?.imdb ?? null
    if (tmdbId && showIds.has(tmdbId)) return showIds.get(tmdbId)!

    const existing = await d.execute({
      sql: `SELECT id FROM titles
            WHERE (tmdb_id IS NOT NULL AND tmdb_id = ? AND type = 'series')
               OR (lower(title) = lower(?) AND (year = ? OR ? IS NULL) AND type = 'series')
            LIMIT 1`,
      args: [tmdbId, String(show?.title ?? ''), show?.year ?? null, show?.year ?? null],
    })

    let id: number
    if (existing.rows.length) {
      id = Number(existing.rows[0].id)
      await d.execute({
        sql: 'UPDATE titles SET tmdb_id = COALESCE(tmdb_id, ?), imdb_id = COALESCE(imdb_id, ?) WHERE id = ?',
        args: [tmdbId, imdbId, id],
      })
    } else if (show?.title) {
      const slug = String(show.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const ins = await d.execute({
        sql: `INSERT INTO titles (tmdb_id, imdb_id, slug, title, year, type, by, runtime, watched, watches)
              VALUES (?,?,?,?,?,'series','','', '', 1)`,
        args: [tmdbId, imdbId, slug, show.title, show.year ?? null],
      })
      id = Number(ins.lastInsertRowid)
      shows++
    } else {
      return null
    }
    if (tmdbId) showIds.set(tmdbId, id)
    return id
  }

  // 1) fetch the FULL episode history first (nothing is deleted yet)
  const episodes: Array<{ titleId: number; watched: string; season: number | null; episode: number | null }> = []
  for (let page = 1; page <= 100; page++) {
    const res: any[] = await $fetch<any[]>(
      `${API}/sync/history?type=episodes&limit=200&page=${page}`,
      { headers: apiHeaders(token), timeout: 30_000 },
    )
    if (!res?.length) break
    for (const item of res) {
      const titleId = await titleForShow(item.show)
      const watched = String(item.watched_at ?? '').slice(0, 10)
      if (titleId && watched) {
        episodes.push({ titleId, watched, season: item.episode?.season ?? null, episode: item.episode?.number ?? null })
      }
    }
    if (res.length < 200) break
  }

  // 2) fetch current show ratings (10-point already)
  const rated: any[] = await $fetch<any[]>(`${API}/sync/ratings/shows`, {
    headers: apiHeaders(token),
    timeout: 30_000,
  })
  const ratingByTitle = new Map<number, number>()
  for (const item of rated ?? []) {
    const titleId = await titleForShow(item.show)
    if (titleId && item.rating) ratingByTitle.set(titleId, item.rating)
  }

  // 3) reconcile — only now do we mutate. Trakt is the source of truth for a
  // SERIES' episode log (so its watches always match Trakt, no duplicates),
  // regardless of `edited` — but hand-edited RATINGS are preserved. We never
  // touch Letterboxd-matched titles (lb_uri set).
  const SERIES = "type='series' AND (lb_uri IS NULL OR lb_uri='')"
  await d.execute(`DELETE FROM watches WHERE title_id IN (SELECT id FROM titles WHERE ${SERIES})`)
  for (const e of episodes) {
    await d.execute({
      sql: 'INSERT INTO watches (title_id, watched, season, episode) VALUES (?,?,?,?)',
      args: [e.titleId, e.watched, e.season, e.episode],
    })
  }

  // rebuild the cache + reconcile ratings for every series. Trakt is the source
  // of truth for a show's rating too: set it from Trakt, and CLEAR it when it's
  // no longer rated there — so removing/changing a rating on Trakt always shows
  // here (a hand-edited series is no exception; the user rates shows on Trakt).
  const allSeries = await d.execute(`SELECT id FROM titles WHERE ${SERIES}`)
  let ratings = 0
  for (const row of allSeries.rows as any[]) {
    const id = Number(row.id)
    const r = ratingByTitle.get(id) ?? null
    await d.execute({ sql: 'UPDATE titles SET my_rating = ? WHERE id = ?', args: [r, id] })
    if (r != null) ratings++
    await syncWatchCache(id)
  }

  // drop auto-managed series Trakt no longer has (no episodes AND no rating);
  // never auto-delete a hand-edited series
  const del = await d.execute(`DELETE FROM titles
    WHERE ${SERIES} AND edited=0
      AND my_rating IS NULL
      AND id NOT IN (SELECT DISTINCT title_id FROM watches)`)
  const removed = Number((del as any).rowsAffected ?? 0)

  return { records: episodes.length, shows, ratings, removed }
}

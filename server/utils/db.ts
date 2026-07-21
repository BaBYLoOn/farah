import { createClient, type Client } from '@libsql/client'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { essays } from '~/data/essays'
import { weblog } from '~/data/weblog'
import type { Block, Source } from '~/data/content'

// ── Post model ─────────────────────────────────────────────────────
// One table holds both essays and weblog entries, distinguished by `kind`.
export type PostKind = 'essay' | 'weblog'
export type PostStatus = 'draft' | 'published'

export interface Post {
  id: string
  kind: PostKind
  slug: string
  title: string
  excerpt: string
  date: string          // display date (may be Arabic numerals)
  iso: string           // ISO date for sorting / <time datetime>
  image: string
  authors: string[]
  tags: string[]
  sources: Source[]
  body: Block[]
  status: PostStatus
  position: number
  createdAt: number
  updatedAt: number
}

let _client: Client | null = null
let _ready: Promise<void> | null = null

export function db(): Client {
  if (_client) return _client
  const config = useRuntimeConfig()
  const url = config.dbUrl || 'file:.data/farah.db'
  // For a local file DB, make sure its directory exists (libSQL won't create it).
  if (url.startsWith('file:')) {
    const path = url.slice('file:'.length).replace(/^\/\//, '')
    try { mkdirSync(dirname(path), { recursive: true }) } catch { /* ignore */ }
  }
  _client = createClient({
    url,
    authToken: config.dbAuthToken || undefined,
  })
  return _client
}

// Create the schema (idempotent) and seed from the static content on first run.
export async function ensureDb(): Promise<void> {
  if (_ready) return _ready
  _ready = (async () => {
    const client = db()
    await client.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        id         TEXT PRIMARY KEY,
        kind       TEXT NOT NULL,
        slug       TEXT NOT NULL,
        title      TEXT NOT NULL,
        excerpt    TEXT NOT NULL DEFAULT '',
        date       TEXT NOT NULL DEFAULT '',
        iso        TEXT NOT NULL DEFAULT '',
        image      TEXT NOT NULL DEFAULT '',
        authors    TEXT NOT NULL DEFAULT '[]',
        tags       TEXT NOT NULL DEFAULT '[]',
        sources    TEXT NOT NULL DEFAULT '[]',
        body       TEXT NOT NULL DEFAULT '[]',
        status     TEXT NOT NULL DEFAULT 'published',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS posts_kind_slug ON posts (kind, slug)`)

    // Manual drag-ordering column. Added via ALTER for DBs seeded before it existed.
    try { await client.execute(`ALTER TABLE posts ADD COLUMN position INTEGER NOT NULL DEFAULT 0`) }
    catch { /* column already exists */ }

    // Backfill positions if they're all still 0 (per kind, preserving iso order).
    const zero = await client.execute(`SELECT COUNT(*) AS n FROM posts WHERE position != 0`)
    if (Number(zero.rows[0]?.n ?? 0) === 0) {
      for (const kind of ['essay', 'weblog']) {
        const rows = await client.execute({ sql: `SELECT id FROM posts WHERE kind = ? ORDER BY iso DESC, created_at DESC`, args: [kind] })
        let pos = 0
        for (const r of rows.rows) {
          await client.execute({ sql: `UPDATE posts SET position = ? WHERE id = ?`, args: [pos++, String((r as any).id)] })
        }
      }
    }

    const existing = await client.execute(`SELECT COUNT(*) AS n FROM posts`)
    const count = Number(existing.rows[0]?.n ?? 0)
    if (count === 0) {
      const now = Date.now()
      const seed = [
        ...essays.map((e, i) => ({ ...e, kind: 'essay' as const, order: i })),
        ...weblog.map((w, i) => ({ ...w, kind: 'weblog' as const, order: i })),
      ]
      for (const p of seed) {
        await client.execute({
          sql: `INSERT INTO posts
            (id, kind, slug, title, excerpt, date, iso, image, authors, tags, sources, body, status, position, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            p.id,
            p.kind,
            p.slug,
            p.title,
            p.excerpt ?? '',
            p.date ?? '',
            p.iso ?? '',
            p.image ?? '',
            JSON.stringify(p.authors ?? []),
            JSON.stringify(p.tags ?? []),
            JSON.stringify(p.sources ?? []),
            JSON.stringify(p.body ?? []),
            'published',
            p.order,
            now,
            now,
          ],
        })
      }
    }

    // ── Cinema tables (films / TV) — self-contained, ship empty ──────────
    await client.execute(`
      CREATE TABLE IF NOT EXISTS titles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tmdb_id INTEGER, imdb_id TEXT, slug TEXT,
        title TEXT NOT NULL, year INTEGER,
        type TEXT DEFAULT 'film', by TEXT DEFAULT '', runtime TEXT DEFAULT '',
        my_rating REAL, imdb REAL,
        watched TEXT, watches INTEGER DEFAULT 1,
        poster TEXT, poster_local TEXT,
        note TEXT DEFAULT '', note_private TEXT DEFAULT '',
        favorite INTEGER DEFAULT 0, fav_sort INTEGER DEFAULT 0,
        lb_uri TEXT DEFAULT '',
        end_year INTEGER, ended INTEGER,
        edited INTEGER DEFAULT 0
      )
    `)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS watches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_id INTEGER NOT NULL, watched TEXT NOT NULL,
        season INTEGER, episode INTEGER,
        note TEXT DEFAULT '', note_private TEXT DEFAULT ''
      )
    `)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_watches_title ON watches (title_id)`)
    // dated reviews — MANY per title (one per reviewed diary entry). guid dedupes RSS/CSV.
    await client.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title_id INTEGER NOT NULL,
        reviewed TEXT,
        text TEXT NOT NULL,
        rating REAL,
        guid TEXT UNIQUE
      )
    `)
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_reviews_title ON reviews (title_id)`)
    await client.execute(`CREATE TABLE IF NOT EXISTS sync_log (guid TEXT PRIMARY KEY)`)
    // key/value store for cinema settings (musicUrl, autosync, Trakt tokens, admin hash)
    await client.execute(`CREATE TABLE IF NOT EXISTS cinema_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  })()
  return _ready
}

// ── Cinema helpers ──────────────────────────────────────────────────
// requireAdmin lives in auth.ts; re-export so the ported cinema code can import
// it (and db + settings) all from './db'.
export { requireAdmin } from './auth'

export async function getSetting<T>(key: string): Promise<T | null> {
  await ensureDb()
  const r = await db().execute({ sql: 'SELECT value FROM cinema_settings WHERE key = ?', args: [key] })
  return r.rows.length ? (JSON.parse(String((r.rows[0] as any).value)) as T) : null
}

export async function putSetting(key: string, value: unknown) {
  await ensureDb()
  await db().execute({
    sql: 'INSERT INTO cinema_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [key, JSON.stringify(value)],
  })
}

// titles.watched/watches are caches kept in step with the watch log
export async function syncWatchCache(titleId: number) {
  await db().execute({
    sql: `UPDATE titles SET
            watched = COALESCE((SELECT MAX(watched) FROM watches WHERE title_id = ?), watched),
            watches = MAX((SELECT COUNT(*) FROM watches WHERE title_id = ?), 1)
          WHERE id = ?`,
    args: [titleId, titleId, titleId],
  })
}

// effective admin password hash — a DB-stored one (change-password) wins over
// the env hash, so the password can change at runtime without a redeploy
export async function getAdminHash(): Promise<string> {
  const stored = await getSetting<string>('adminPasswordHash')
  if (stored) return stored
  return (useRuntimeConfig().adminPasswordHash as string) || ''
}

export function rowToTitle(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    tmdbId: r.tmdb_id == null ? null : Number(r.tmdb_id),
    imdbId: r.imdb_id == null || r.imdb_id === '' ? null : String(r.imdb_id),
    slug: String(r.slug ?? ''),
    title: String(r.title),
    year: r.year == null ? null : Number(r.year),
    type: String(r.type) as 'film' | 'series',
    by: String(r.by ?? ''),
    runtime: String(r.runtime ?? ''),
    myRating: r.my_rating == null ? null : Number(r.my_rating),
    imdb: r.imdb == null ? null : Number(r.imdb),
    watched: String(r.watched ?? ''),
    watches: Number(r.watches ?? 1),
    poster: r.poster == null || r.poster === '' ? null : String(r.poster),
    posterLocal: r.poster_local == null || r.poster_local === '' ? null : String(r.poster_local),
    endYear: r.end_year == null ? null : Number(r.end_year),
    ended: r.ended == null ? null : Number(r.ended) === 1,
    note: String(r.note ?? ''), // public note; the REVIEW list is attached separately
    favorite: Number(r.favorite ?? 0) === 1,
    favSort: Number(r.fav_sort ?? 0),
    edited: Number(r.edited ?? 0) === 1,
  }
}

export function rowToWatch(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    titleId: Number(r.title_id),
    watched: String(r.watched),
    season: r.season == null ? null : Number(r.season),
    episode: r.episode == null ? null : Number(r.episode),
    note: String(r.note ?? ''),
  }
}

export function rowToReview(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    titleId: Number(r.title_id),
    reviewed: r.reviewed == null ? '' : String(r.reviewed),
    text: String(r.text ?? ''),
    rating: r.rating == null ? null : Number(r.rating),
  }
}

// Map a raw DB row → Post
export function rowToPost(row: Record<string, any>): Post {
  const safe = <T>(raw: any, fallback: T): T => {
    try { return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? fallback) }
    catch { return fallback }
  }
  return {
    id: String(row.id),
    kind: row.kind as PostKind,
    slug: String(row.slug),
    title: String(row.title),
    excerpt: String(row.excerpt ?? ''),
    date: String(row.date ?? ''),
    iso: String(row.iso ?? ''),
    image: String(row.image ?? ''),
    authors: safe<string[]>(row.authors, []),
    tags: safe<string[]>(row.tags, []),
    sources: safe<Source[]>(row.sources, []),
    body: safe<Block[]>(row.body, []),
    status: (row.status as PostStatus) ?? 'published',
    position: Number(row.position ?? 0),
    createdAt: Number(row.created_at ?? 0),
    updatedAt: Number(row.updated_at ?? 0),
  }
}

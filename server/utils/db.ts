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
  })()
  return _ready
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

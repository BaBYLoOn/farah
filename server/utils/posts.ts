import { nanoid } from 'nanoid'
import { db, ensureDb, rowToPost, type Post, type PostKind, type PostStatus } from './db'
import { sanitizeInlineHtml, htmlToText } from './sanitize'
import type { Block, Source } from '~/data/content'

// Sanitize inline HTML on text blocks and keep a plain-text mirror in `text`.
function cleanBlocks(blocks: Block[]): Block[] {
  if (!Array.isArray(blocks)) return []
  const out: Block[] = []
  for (const b of blocks) {
    if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote') {
      const html = sanitizeInlineHtml(b.html || '')
      // never lose the text: derive from html, else fall back to the raw text field
      const text = htmlToText(html) || String((b as any).text ?? '').trim()
      // drop completely-empty text blocks so a stray empty heading/paragraph never renders
      if (!text && !html) continue
      // if we somehow have text but no html, keep the text as html too so it always renders
      const finalHtml = html || text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      out.push({ ...b, html: finalHtml, text })
    } else {
      out.push(b)
    }
  }
  return out
}

export interface PostInput {
  kind: PostKind
  slug?: string
  title: string
  excerpt?: string
  date?: string
  iso?: string
  image?: string
  authors?: string[]
  tags?: string[]
  sources?: Source[]
  body?: Block[]
  status?: PostStatus
}

export async function listPosts(opts: { kind?: PostKind; includeDrafts?: boolean } = {}): Promise<Post[]> {
  await ensureDb()
  const where: string[] = []
  const args: any[] = []
  if (opts.kind) { where.push('kind = ?'); args.push(opts.kind) }
  if (!opts.includeDrafts) { where.push(`status = 'published'`) }
  const sql = `SELECT * FROM posts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY position ASC, created_at DESC`
  const res = await db().execute({ sql, args })
  return res.rows.map(r => rowToPost(r as any))
}

export async function getPost(kind: PostKind, slug: string, includeDrafts = false): Promise<Post | null> {
  await ensureDb()
  const res = await db().execute({
    sql: `SELECT * FROM posts WHERE kind = ? AND slug = ?${includeDrafts ? '' : ` AND status = 'published'`} LIMIT 1`,
    args: [kind, slug],
  })
  return res.rows.length ? rowToPost(res.rows[0] as any) : null
}

export async function getPostById(id: string): Promise<Post | null> {
  await ensureDb()
  const res = await db().execute({ sql: `SELECT * FROM posts WHERE id = ? LIMIT 1`, args: [id] })
  return res.rows.length ? rowToPost(res.rows[0] as any) : null
}

export async function slugExists(kind: PostKind, slug: string, exceptId?: string): Promise<boolean> {
  await ensureDb()
  const res = await db().execute({
    sql: `SELECT id FROM posts WHERE kind = ? AND slug = ?${exceptId ? ' AND id != ?' : ''} LIMIT 1`,
    args: exceptId ? [kind, slug, exceptId] : [kind, slug],
  })
  return res.rows.length > 0
}

// Transliteration-free slug: keep Arabic letters, turn spaces/punct into hyphens.
export function slugify(input: string): string {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/['"“”‘’.,،؛:!?()\[\]{}]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'post'
}

export async function uniqueSlug(kind: PostKind, base: string, exceptId?: string): Promise<string> {
  let slug = slugify(base)
  let n = 2
  while (await slugExists(kind, slug, exceptId)) {
    slug = `${slugify(base)}-${n++}`
  }
  return slug
}

function coerce(input: PostInput) {
  const kind: PostKind = input.kind === 'weblog' ? 'weblog' : 'essay'
  return {
    kind,
    title: String(input.title ?? '').trim(),
    excerpt: String(input.excerpt ?? '').trim(),
    date: String(input.date ?? '').trim(),
    iso: String(input.iso ?? '').trim(),
    image: String(input.image ?? '').trim(),
    authors: Array.isArray(input.authors) ? input.authors.map(String) : [],
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
    sources: Array.isArray(input.sources) ? input.sources.filter(s => s && (s.text || s.url)) : [],
    body: cleanBlocks(Array.isArray(input.body) ? input.body : []),
    status: input.status === 'draft' ? 'draft' as const : 'published' as const,
  }
}

export async function createPost(input: PostInput): Promise<Post> {
  await ensureDb()
  const c = coerce(input)
  if (!c.title) throw createError({ statusCode: 400, statusMessage: 'العنوان مطلوب' })
  const id = nanoid(10)
  const slug = await uniqueSlug(c.kind, input.slug?.trim() || c.title)
  const iso = c.iso || new Date().toISOString().slice(0, 10)
  const now = Date.now()
  // New posts appear at the very top of their list.
  const minRes = await db().execute({ sql: `SELECT MIN(position) AS m FROM posts WHERE kind = ?`, args: [c.kind] })
  const position = (Number(minRes.rows[0]?.m ?? 0)) - 1
  await db().execute({
    sql: `INSERT INTO posts
      (id, kind, slug, title, excerpt, date, iso, image, authors, tags, sources, body, status, position, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, c.kind, slug, c.title, c.excerpt, c.date, iso, c.image,
      JSON.stringify(c.authors), JSON.stringify(c.tags), JSON.stringify(c.sources),
      JSON.stringify(c.body), c.status, position, now, now],
  })
  return (await getPostById(id))!
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  await ensureDb()
  const existing = await getPostById(id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const c = coerce({ ...input, kind: input.kind ?? existing.kind })
  if (!c.title) throw createError({ statusCode: 400, statusMessage: 'العنوان مطلوب' })
  const slug = await uniqueSlug(c.kind, input.slug?.trim() || c.title, id)
  const iso = c.iso || existing.iso || new Date().toISOString().slice(0, 10)
  await db().execute({
    sql: `UPDATE posts SET
      kind=?, slug=?, title=?, excerpt=?, date=?, iso=?, image=?,
      authors=?, tags=?, sources=?, body=?, status=?, updated_at=?
      WHERE id=?`,
    args: [c.kind, slug, c.title, c.excerpt, c.date, iso, c.image,
      JSON.stringify(c.authors), JSON.stringify(c.tags), JSON.stringify(c.sources),
      JSON.stringify(c.body), c.status, Date.now(), id],
  })
  return (await getPostById(id))!
}

export async function deletePost(id: string): Promise<void> {
  await ensureDb()
  await db().execute({ sql: `DELETE FROM posts WHERE id = ?`, args: [id] })
}

// Persist a drag-reordered list: positions become the array index (0 = top).
export async function reorderPosts(kind: PostKind, ids: string[]): Promise<void> {
  await ensureDb()
  const client = db()
  for (let i = 0; i < ids.length; i++) {
    await client.execute({
      sql: `UPDATE posts SET position = ?, updated_at = ? WHERE id = ? AND kind = ?`,
      args: [i, Date.now(), ids[i], kind],
    })
  }
}

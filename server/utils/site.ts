import { db, ensureDb } from './db'
import { DEFAULT_SITE, ICON_NAMES, deepMergeSite, type SiteContent } from '~/data/site'

export { DEFAULT_SITE, ICON_NAMES }
export type { SiteContent, SocialLink } from '~/data/site'

async function ensureSettings() {
  await ensureDb()
  await db().execute(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL)`)
}

export async function getSite(): Promise<SiteContent> {
  await ensureSettings()
  const res = await db().execute(`SELECT data FROM settings WHERE id = 1`)
  if (!res.rows.length) return DEFAULT_SITE
  try {
    const saved = JSON.parse(String((res.rows[0] as any).data))
    return deepMergeSite(DEFAULT_SITE, saved)
  } catch {
    return DEFAULT_SITE
  }
}

export async function saveSite(input: any): Promise<SiteContent> {
  await ensureSettings()
  const merged = deepMergeSite(DEFAULT_SITE, input)
  // sanitize socials: keep valid icon + safe href
  merged.socials = (Array.isArray(merged.socials) ? merged.socials : [])
    .filter((s: any) => s && s.href)
    .map((s: any) => ({
      key: ICON_NAMES.includes(s.key) ? s.key : 'link',
      label: String(s.label ?? '').slice(0, 40),
      handle: String(s.handle ?? '').slice(0, 60),
      href: /^(https?:|mailto:|\/)/i.test(String(s.href)) ? String(s.href) : '#',
      // only keep an uploaded icon that lives under our uploads dir
      icon: typeof s.icon === 'string' && s.icon.startsWith('/uploads/') ? s.icon : undefined,
    }))
  await db().execute({
    sql: `INSERT INTO settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    args: [JSON.stringify(merged)],
  })
  return merged
}

import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, normalize, extname, sep } from 'node:path'

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}

// Serve user-uploaded images from the persistent `uploads/` dir at project root.
// Works identically in dev and production, and survives rebuilds.
export default defineEventHandler((event) => {
  const rel = (getRouterParam(event, 'path') || '').replace(/\.\.(\/|\\|$)/g, '')
  const dir = join(process.cwd(), 'uploads')
  const file = normalize(join(dir, rel))
  if (!file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const ext = extname(file).toLowerCase()
  setResponseHeader(event, 'Content-Type', TYPES[ext] || 'application/octet-stream')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  // SVGs are user-uploaded — block any embedded scripts on direct navigation.
  if (ext === '.svg') setResponseHeader(event, 'Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
  return sendStream(event, createReadStream(file))
})

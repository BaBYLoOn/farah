import { mkdir, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { nanoid } from 'nanoid'
import { requireAdmin } from '~/server/utils/auth'

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg'])
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const form = await readMultipartFormData(event)
  const file = form?.find(f => f.name === 'file' && f.filename)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'لم يتم إرفاق ملف' })
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'الملف كبير جدًا (الحد ٨ ميغابايت)' })
  }

  let ext = extname(file.filename || '').toLowerCase()
  if (!ALLOWED.has(ext)) {
    // fall back on the content-type
    const t = file.type || ''
    if (t.includes('png')) ext = '.png'
    else if (t.includes('webp')) ext = '.webp'
    else if (t.includes('gif')) ext = '.gif'
    else if (t.includes('avif')) ext = '.avif'
    else if (t.includes('svg')) ext = '.svg'
    else if (t.includes('jpeg') || t.includes('jpg')) ext = '.jpg'
    else throw createError({ statusCode: 415, statusMessage: 'نوع الصورة غير مدعوم' })
  }

  const name = `${nanoid(12)}${ext}`
  // Persistent dir OUTSIDE the build output, served by server/routes/uploads/.
  // (Writing into public/ doesn't work in production — Nitro serves .output/public.)
  const dir = join(process.cwd(), 'uploads')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), file.data)

  return { url: `/uploads/${name}`, name }
})

import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const { password } = await readBody<{ password?: string }>(event)
  const hash = useRuntimeConfig().adminPasswordHash

  if (!hash) {
    throw createError({ statusCode: 500, statusMessage: 'Admin password not configured' })
  }
  if (!password || !(await bcrypt.compare(password, hash))) {
    // small delay to blunt brute-forcing
    await new Promise(r => setTimeout(r, 400))
    throw createError({ statusCode: 401, statusMessage: 'كلمة المرور غير صحيحة' })
  }

  await setUserSession(event, { user: { admin: true }, loggedInAt: Date.now() })
  return { ok: true }
})

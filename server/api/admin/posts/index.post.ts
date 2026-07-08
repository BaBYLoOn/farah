import { requireAdmin } from '~/server/utils/auth'
import { createPost, type PostInput } from '~/server/utils/posts'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<PostInput>(event)
  return await createPost(body)
})

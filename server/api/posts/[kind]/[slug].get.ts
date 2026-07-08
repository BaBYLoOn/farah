import { getPost } from '~/server/utils/posts'
import type { PostKind } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const kind = getRouterParam(event, 'kind') as PostKind
  const slug = getRouterParam(event, 'slug') as string
  if (kind !== 'essay' && kind !== 'weblog') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const post = await getPost(kind, decodeURIComponent(slug))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return post
})

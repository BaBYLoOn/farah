import { listPosts } from '~/server/utils/posts'
import type { PostKind } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const kind = (q.kind === 'essay' || q.kind === 'weblog') ? q.kind as PostKind : undefined
  return await listPosts({ kind })
})

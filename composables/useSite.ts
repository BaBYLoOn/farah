import type { SiteContent } from '~/data/site'

// Shared, deduped fetch of editable site content (hero/section/footer text + socials).
export function useSite() {
  return useFetch<SiteContent>('/api/site', { key: 'site-content' })
}

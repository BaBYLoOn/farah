import type { RouterConfig } from '@nuxt/schema'

// Custom scroll behaviour:
// – real page navigations open instantly at the top (no visible scroll-up,
//   the CSS `scroll-behavior: smooth` no longer animates route changes)
// – same-page hash links (navbar → /#essays) still glide smoothly
// – browser back/forward restores the previous position
export default <RouterConfig>{
  scrollBehavior(to, from, savedPosition) {
    // Same-page anchor: smooth scroll to the section
    if (to.path === from.path && to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }

    // Navigating to a brand-new page (e.g. an essay/weblog entry): jump to the
    // very top immediately. No CSS smooth-scroll is in play any more, so the
    // page simply opens at the top instead of sliding up from the old position.
    if (!to.hash && !savedPosition) {
      return { top: 0, left: 0 }
    }

    const nuxtApp = useNuxtApp()
    return new Promise((resolve) => {
      nuxtApp.hooks.hookOnce('page:finish', () => {
        setTimeout(() => {
          if (to.hash && document.querySelector(to.hash)) {
            return resolve({ el: to.hash, behavior: 'smooth' })
          }
          if (savedPosition) return resolve(savedPosition)
          resolve({ top: 0, left: 0 })
        }, 0)
      })
    })
  },
}

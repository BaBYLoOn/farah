// v-poster — a shimmer placeholder on an <img> that stops the moment the image
// paints (or falls back), so a loading poster looks like it's arriving instead
// of an empty box. Handles the already-cached case (el.complete) too.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('poster', {
    getSSRProps: () => ({}),
    mounted(el: HTMLImageElement) {
      const done = () => el.classList.add('is-ready')
      if (el.complete && el.naturalWidth > 0) { done(); return }
      el.addEventListener('load', done)   // fires on the remote or the local fallback
      el.addEventListener('error', done)  // stop the shimmer even if both fail
    },
  })
})

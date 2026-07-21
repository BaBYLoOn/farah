// v-reveal — fade elements up as they enter the viewport.
// Usage: v-reveal or v-reveal="150" (stagger delay in ms).
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    getSSRProps: () => ({}),
    mounted(el: HTMLElement, binding) {
      el.classList.add('reveal')
      if (typeof binding.value === 'number') {
        el.style.transitionDelay = `${binding.value}ms`
      }
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            el.classList.add('is-visible')
            io.disconnect()
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
      )
      io.observe(el)
    },
  })
})

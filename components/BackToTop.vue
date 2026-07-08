<template>
  <button
    class="back-to-top"
    :class="{ 'is-visible': shown }"
    type="button"
    :aria-label="label"
    :tabindex="shown ? 0 : -1"
    @click="toTop"
  >
    <span class="back-to-top-arrow" aria-hidden="true">↑</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), {
  label: 'Back to top',
})

const shown = ref(false)
let raf = 0

const update = () => {
  raf = 0
  // reveal once the reader is a screenful or so into the piece
  shown.value = window.scrollY > window.innerHeight * 0.8
}
const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }

const toTop = () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, left: 0, behavior: reduce ? 'auto' : 'smooth' })
}

onMounted(() => {
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  if (raf) cancelAnimationFrame(raf)
})
</script>

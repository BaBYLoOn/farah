<template>
  <div class="reading-progress" aria-hidden="true">
    <div class="reading-progress-fill" :style="{ transform: `scaleX(${progress})` }" />
  </div>
</template>

<script setup lang="ts">
const progress = ref(0)
let raf = 0

const update = () => {
  raf = 0
  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  progress.value = max > 0 ? Math.min(1, window.scrollY / max) : 0
}
const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }

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

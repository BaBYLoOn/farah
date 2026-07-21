<template>
  <nav class="site-nav" aria-label="Primary">
    <div class="site-nav-inner">
      <NuxtLink class="site-nav-mark" to="/" aria-label="FARAH — home">FARAH</NuxtLink>
      <span class="site-nav-divider" aria-hidden="true" />
      <NuxtLink class="site-nav-link" :class="{ 'is-active': active === 'essays' }" to="/#essays">Essays</NuxtLink>
      <NuxtLink class="site-nav-link" :class="{ 'is-active': active === 'weblog' }" to="/#weblog">Weblog</NuxtLink>
      <NuxtLink class="site-nav-link" to="/cinema">Cinema</NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
// Scroll-spy: underline the nav link for whichever home section is in view.
const active = ref('')
let io: IntersectionObserver | null = null

function observe() {
  io?.disconnect()
  const sections = ['essays', 'weblog']
    .map(id => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el)
  if (!sections.length) { active.value = ''; return }
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) active.value = e.target.id
      }
    },
    // a thin band across the upper-middle of the viewport
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  )
  sections.forEach(s => io!.observe(s))
}

const route = useRoute()
onMounted(() => nextTick(observe))
// re-observe when navigating back to the home page (sections re-appear)
watch(() => route.path, () => nextTick(observe))
onUnmounted(() => io?.disconnect())
</script>

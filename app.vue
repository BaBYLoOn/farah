<template>
  <!-- boot overlay: covers the very first paint (before CSS/fonts settle) with a
       clean background + spinner, then fades out — so no broken/unstyled flash.
       Its critical CSS is injected inline into <head> (below) so it's styled from
       the first frame regardless of when the main stylesheet loads. -->
  <div class="app-boot" :class="{ hide: booted }" aria-hidden="true">
    <span class="app-boot-spinner"></span>
  </div>

  <Navbar v-if="!isAdmin" />
  <NuxtPage />

  <!-- route-change loader (subsequent navigations) -->
  <ClientOnly>
    <Teleport to="body">
      <div class="route-loader" :class="{ show: routeLoading }" role="status" aria-label="Loading">
        <span class="route-spinner" aria-hidden="true"></span>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))

// critical, inline boot styles — present in <head> on first paint
useHead({
  style: [{
    key: 'app-boot',
    innerHTML:
      '.app-boot{position:fixed;inset:0;z-index:9999;background:#050404;display:flex;align-items:center;justify-content:center;opacity:1;transition:opacity .45s ease}' +
      '.app-boot.hide{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .45s ease,visibility 0s .45s}' +
      '.app-boot-spinner{width:34px;height:34px;border-radius:50%;border:2px solid rgba(216,210,196,.14);border-top-color:#8b0a0a;animation:appboot .8s linear infinite}' +
      '@keyframes appboot{to{transform:rotate(360deg)}}',
  }],
})

// reveal the page once fonts are ready (no FOUT) — with a safety timeout
const booted = ref(false)
onMounted(() => {
  let settled = false
  const finish = () => { if (!settled) { settled = true; requestAnimationFrame(() => { booted.value = true }) } }
  const fonts = (document as any).fonts
  if (fonts?.ready) fonts.ready.then(finish).catch(finish)
  else finish()
  setTimeout(finish, 1500) // never hang the boot overlay
})

// route-change loader (delayed so instant navs don't flash it)
const routeLoading = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
const nuxtApp = useNuxtApp()
nuxtApp.hook('page:start', () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { routeLoading.value = true }, 160) })
nuxtApp.hook('page:finish', () => { if (timer) clearTimeout(timer); routeLoading.value = false })
</script>

<style>
.route-loader {
  position: fixed; inset: 0; z-index: 300;
  display: grid; place-items: center;
  background: rgba(5, 4, 4, 0.55); backdrop-filter: blur(1px);
  opacity: 0; pointer-events: none; transition: opacity 0.25s ease;
}
.route-loader.show { opacity: 1; }
.route-spinner {
  width: 2rem; height: 2rem; border-radius: 50%;
  border: 2px solid rgba(216, 210, 196, 0.15);
  border-top-color: #8b0a0a;
  animation: route-spin 0.8s linear infinite;
}
@keyframes route-spin { to { transform: rotate(360deg); } }
</style>

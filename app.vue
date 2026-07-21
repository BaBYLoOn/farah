<template>
  <Navbar v-if="!isAdmin" />
  <NuxtPage />

  <!-- route-change loader (like husseinkhalid): a spinner while a page loads, so
       navigation never flashes a half-rendered page. Teleported to body. -->
  <ClientOnly>
    <Teleport to="body">
      <div class="route-loader" :class="{ show: routeLoading }" role="status" aria-label="Loading">
        <span class="route-spinner" aria-hidden="true"></span>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup lang="ts">
// The site navbar is fixed-position and must not sit over the admin dashboard.
const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))

// delayed so an instant navigation doesn't flash the spinner
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
  border-top-color: #b81c1c;
  animation: route-spin 0.8s linear infinite;
}
@keyframes route-spin { to { transform: rotate(360deg); } }
</style>

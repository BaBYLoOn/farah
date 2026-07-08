<template>
  <Navbar v-if="!isAdmin" />
  <NuxtPage />
</template>

<script setup lang="ts">
// The site navbar is fixed-position and must not sit over the admin dashboard.
const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))
</script>

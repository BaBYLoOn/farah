<template>
  <!-- Series: a TV icon + how many episodes have been logged (fills in from Trakt).
       Film watched more than once: a rewatch icon + the number of watches. -->
  <span v-if="isSeries" class="rewatch eps" :title="`${count} ${count === 1 ? 'episode' : 'episodes'} watched`">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>{{ count }}
  </span>
  <span v-else-if="count > 1" class="rewatch" :title="`Watched ${count} times`">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>{{ count }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ title: any }>()
const isSeries = computed(() => props.title?.type === 'series')
const count = computed(() => Number(props.title?.watches ?? 1))
</script>

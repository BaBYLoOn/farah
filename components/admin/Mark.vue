<template>
  <svg
    class="admin-mark-svg"
    :width="size" :height="size"
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true" focusable="false"
  >
    <g transform="translate(24 24)" fill="none" stroke="#d63a3a" stroke-width="2" stroke-linejoin="round">
      <g v-for="n in 6" :key="n" :transform="`rotate(${(n - 1) * 60})`">
        <path d="M0 -3 C6 -9 6 -17 0 -20 C-6 -17 -6 -9 0 -3 Z" fill="rgba(184,28,28,0.35)" />
      </g>
    </g>
    <circle cx="24" cy="24" r="4.4" fill="#e9b64a" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 28 })
</script>

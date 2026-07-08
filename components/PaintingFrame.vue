<template>
  <div class="painting-frame" :class="[`painting-frame--${variant}`]">
    <div class="painting-frame-inner">
      <slot />
    </div>
    <!-- Double-line beveled corners — restrained, classical, no ornament -->
    <span class="pf-corner pf-tl" aria-hidden="true"><svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="currentColor" stroke-linecap="square"><path d="M2 2 L58 2 M2 2 L2 58" stroke-width="1"/><path d="M7 7 L50 7 M7 7 L7 50" stroke-width="0.75" opacity="0.6"/></svg></span>
    <span class="pf-corner pf-tr" aria-hidden="true"><svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="currentColor" stroke-linecap="square"><path d="M2 2 L58 2 M2 2 L2 58" stroke-width="1"/><path d="M7 7 L50 7 M7 7 L7 50" stroke-width="0.75" opacity="0.6"/></svg></span>
    <span class="pf-corner pf-bl" aria-hidden="true"><svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="currentColor" stroke-linecap="square"><path d="M2 2 L58 2 M2 2 L2 58" stroke-width="1"/><path d="M7 7 L50 7 M7 7 L7 50" stroke-width="0.75" opacity="0.6"/></svg></span>
    <span class="pf-corner pf-br" aria-hidden="true"><svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="currentColor" stroke-linecap="square"><path d="M2 2 L58 2 M2 2 L2 58" stroke-width="1"/><path d="M7 7 L50 7 M7 7 L7 50" stroke-width="0.75" opacity="0.6"/></svg></span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'standard' | 'small' }>(), { variant: 'standard' })
</script>

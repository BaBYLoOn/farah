<template>
  <div class="crimson-rule" :style="maxWidth ? `max-width:${maxWidth};margin:0 auto` : ''">
    <span class="crimson-rule-gem"><slot><BlackOrchid :size="22" variant="divider" /></slot></span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ maxWidth?: string }>()
</script>

<style scoped>
.crimson-rule {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  max-width: 520px;
  margin: 0 auto;
}
.crimson-rule::before,
.crimson-rule::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(90, 10, 10, 0.55),
    rgba(140, 20, 20, 0.85),
    rgba(90, 10, 10, 0.55),
    transparent
  );
}
.crimson-rule-gem {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6a0e0e;
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  text-align: center;
  padding: 0 0.4rem;
}
</style>

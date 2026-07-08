<template>
  <article ref="cardEl" class="weblog-card animate-in">
    <NuxtLink
      class="weblog-card-link"
      :to="`/weblog/${entry.slug}`"
      :aria-label="`Read — ${entry.title}`"
      lang="ar"
      dir="rtl"
    >
      <div class="weblog-card-thumb-wrap">
        <img
          class="weblog-card-thumb"
          :src="entry.image"
          :alt="entry.title"
          loading="lazy"
          decoding="async"
        >
        <div class="weblog-card-thumb-veil" />
        <div class="weblog-card-thumb-grain" />
        <span class="weblog-card-read-cue" aria-hidden="true"><em>اقرأ المزيد</em></span>
      </div>

      <div class="weblog-card-body">
        <p class="weblog-card-meta">
          <time :datetime="entry.iso">{{ entry.date }}</time>
        </p>
        <h3 class="weblog-card-title">{{ entry.title }}</h3>
        <p class="weblog-card-excerpt">{{ entry.excerpt }}</p>
      </div>
    </NuxtLink>
  </article>
</template>

<script setup lang="ts">
import type { WeblogEntry } from '~/data/weblog'

const props = defineProps<{
  entry: WeblogEntry
  cardIdx: number
}>()

const cardEl = ref<HTMLElement>()

onMounted(() => {
  if (!cardEl.value) return
  const delay = (props.cardIdx % 4) * 140
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return
      setTimeout(() => cardEl.value?.classList.add('visible'), delay)
      io.disconnect()
    },
    { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
  )
  io.observe(cardEl.value)
  onUnmounted(() => io.disconnect())
})
</script>

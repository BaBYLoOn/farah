<template>
  <article ref="cardEl" class="essay-card animate-in" :class="{ 'essay-card--reverse': reverse }">
    <NuxtLink
      class="essay-card-link"
      :to="`/essays/${essay.slug}`"
      :aria-label="`Read — ${essay.title}`"
      lang="ar"
      dir="rtl"
    >
      <PaintingFrame variant="standard">
        <div class="essay-card-image-wrap">
          <img
            class="essay-card-image"
            :src="essay.image"
            :alt="essay.title"
            loading="lazy"
            decoding="async"
          >
          <div class="essay-card-image-veil" />
          <div class="essay-card-image-grain" />
        </div>
      </PaintingFrame>

      <div class="essay-card-body">
        <p class="essay-card-meta">
          <span class="essay-card-kicker">مقالة</span>
          <span class="essay-card-dot">·</span>
          <time :datetime="essay.iso">{{ essay.date }}</time>
        </p>

        <h3 class="essay-card-title">{{ essay.title }}</h3>

        <p class="essay-card-excerpt">{{ essay.excerpt }}</p>

        <span class="essay-card-flourish" aria-hidden="true">
          <span class="essay-card-flourish-rule" />
          <em>اقرأ المزيد</em>
          <span class="essay-card-flourish-rule" />
        </span>
      </div>
    </NuxtLink>
  </article>
</template>

<script setup lang="ts">
import type { Essay } from '~/data/essays'

const props = defineProps<{
  essay: Essay
  cardIdx: number
  reverse?: boolean
}>()

const cardEl = ref<HTMLElement>()

onMounted(() => {
  if (!cardEl.value) return
  const delay = (props.cardIdx % 3) * 160
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      setTimeout(() => cardEl.value?.classList.add('visible'), delay)
      io.disconnect()
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  )
  io.observe(cardEl.value)
  onUnmounted(() => io.disconnect())
})
</script>

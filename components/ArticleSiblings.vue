<template>
  <nav v-if="prev || next" class="article-siblings" :aria-label="ariaLabel">
    <NuxtLink v-if="next" class="article-sibling article-sibling--next" :to="next.to">
      <span v-if="next.image" class="article-sibling-thumb">
        <img :src="next.image" :alt="next.title" loading="lazy">
      </span>
      <span class="article-sibling-text">
        <span class="article-sibling-kicker">{{ nextLabel }}</span>
        <span class="article-sibling-title">{{ next.title }}</span>
      </span>
    </NuxtLink>
    <span v-else class="article-sibling article-sibling--empty" aria-hidden="true" />

    <NuxtLink v-if="prev" class="article-sibling article-sibling--prev" :to="prev.to">
      <span v-if="prev.image" class="article-sibling-thumb">
        <img :src="prev.image" :alt="prev.title" loading="lazy">
      </span>
      <span class="article-sibling-text">
        <span class="article-sibling-kicker">{{ prevLabel }}</span>
        <span class="article-sibling-title">{{ prev.title }}</span>
      </span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
export interface SiblingLink {
  title: string
  to: string
  image?: string
}

withDefaults(defineProps<{
  prev?: SiblingLink
  next?: SiblingLink
  prevLabel?: string
  nextLabel?: string
  ariaLabel?: string
}>(), {
  prevLabel: 'السابق',
  nextLabel: 'التالي',
  ariaLabel: 'تصفّح',
})
</script>

<template>
  <main class="article" lang="ar" dir="rtl">
    <ReadingProgress v-if="essay" />
    <BackToTop v-if="essay" label="إلى الأعلى" />
    <div class="article-atmosphere" aria-hidden="true">
      <div class="article-veil" />
      <div class="article-grain" />
    </div>

    <nav class="article-back-nav">
      <NuxtLink class="article-back" to="/">
        <span class="article-back-arrow" aria-hidden="true">→</span>
        <span class="article-back-label">العودة إلى الصفحة الرئيسية</span>
      </NuxtLink>
    </nav>

    <template v-if="essay">
      <header class="article-header">
        <p class="article-kicker"><span class="article-kicker-label">مقالة</span></p>

        <h1 class="article-title">{{ essay.title }}</h1>

        <p class="article-byline">
          <em class="article-byline-prep">بقلم</em>
          <span class="article-byline-author">{{ essay.authors?.[0] ?? 'فَـرَح علي' }}</span>
          <span class="article-byline-sep" aria-hidden="true">·</span>
          <time :datetime="essay.iso">{{ essay.date }}</time>
          <span class="article-byline-sep" aria-hidden="true">·</span>
          <span class="article-byline-time">{{ readTime }}</span>
        </p>

        <div class="article-rule-wrap">
          <CrimsonRule max-width="320px">
            <BlackOrchid :size="16" variant="divider" />
          </CrimsonRule>
        </div>

        <p class="article-lede"><em>{{ essay.excerpt }}</em></p>

        <ul v-if="essay.tags?.length" class="article-tags" aria-label="وسوم">
          <li v-for="tag in essay.tags" :key="tag" class="article-tag">
            <a class="article-tag-link" href="#"><em>{{ tag }}</em></a>
          </li>
        </ul>
      </header>

      <figure class="article-hero">
        <div class="article-figure-frame">
          <img class="article-figure-image" :src="essay.image" :alt="essay.title" loading="eager" decoding="async">
          <div class="article-figure-veil" />
          <div class="article-figure-grain" />
        </div>
      </figure>

      <ArticleBody :blocks="essay.body" />

      <section v-if="essay.sources?.length" class="article-sources" aria-labelledby="essay-sources-heading">
        <h2 id="essay-sources-heading" class="article-sources-heading">المصادر</h2>
        <ol class="article-sources-list">
          <li v-for="(src, i) in essay.sources" :key="i" class="article-sources-item">
            <a v-if="src.url" :href="src.url" target="_blank" rel="noopener noreferrer" class="article-source-link">{{ src.text }}</a>
            <span v-else>{{ src.text }}</span>
          </li>
        </ol>
      </section>

      <div class="article-end">
        <CrimsonRule max-width="240px">
          <BlackOrchid :size="14" variant="divider" />
        </CrimsonRule>
        <p class="article-end-credit"><em>— {{ essay.authors?.[0] ?? 'فَـرَح علي' }}</em></p>
      </div>

      <ArticleSiblings
        :prev="prevEssay ? { title: prevEssay.title, to: `/essays/${prevEssay.slug}`, image: prevEssay.image } : undefined"
        :next="nextEssay ? { title: nextEssay.title, to: `/essays/${nextEssay.slug}`, image: nextEssay.image } : undefined"
        prev-label="المقالة السابقة"
        next-label="المقالة التالية"
        aria-label="مقالات أخرى"
      />

      <nav class="article-back-nav article-back-nav--foot">
        <NuxtLink class="article-back" to="/">
          <span class="article-back-arrow" aria-hidden="true">→</span>
          <span class="article-back-label">العودة إلى الصفحة الرئيسية</span>
        </NuxtLink>
      </nav>
    </template>

    <section v-else class="article-missing">
      <p class="article-missing-kicker">مقالة</p>
      <p class="article-missing-text"><em>الصفحة التي بحثتَ عنها غير موجودة. ربّما لم تُكتب بعد، أو ربّما أُعيدت إلى رفٍّ ما.</em></p>
      <NuxtLink class="article-back" to="/">
        <span class="article-back-arrow" aria-hidden="true">→</span>
        <span class="article-back-label">العودة إلى الصفحة الرئيسية</span>
      </NuxtLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { Essay } from '~/data/essays'

const route = useRoute()

// Fetch just this post (small, fast) so navigation swaps in immediately instead
// of holding the previous page (the hero) while a big list loads.
const { data: essay } = await useFetch<Essay>(() => `/api/posts/essay/${route.params.slug}`, {
  key: () => `essay-${route.params.slug}`,
})

// The sibling list loads lazily (non-blocking) — prev/next fill in a moment later.
const { data: essays } = useFetch<Essay[]>('/api/posts', {
  query: { kind: 'essay' }, lazy: true, default: () => [], key: 'essays-list',
})

const essayIndex = computed(() => essays.value.findIndex(e => e.slug === route.params.slug))
const prevEssay = computed(() => essayIndex.value > 0 ? essays.value[essayIndex.value - 1] : undefined)
const nextEssay = computed(() =>
  essayIndex.value >= 0 && essayIndex.value < essays.value.length - 1 ? essays.value[essayIndex.value + 1] : undefined)

const readTime = computed(() => essay.value ? readingTimeLabel(essay.value.body) : '')

useHead(() => ({
  title: essay.value ? `${essay.value.title} — Farah` : 'مقالة — Farah',
  meta: essay.value ? [{ name: 'description', content: essay.value.excerpt }] : [],
}))
</script>

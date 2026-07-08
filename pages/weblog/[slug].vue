<template>
  <main class="article article--weblog" lang="ar" dir="rtl">
    <ReadingProgress v-if="entry" />
    <BackToTop v-if="entry" label="إلى الأعلى" />
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

    <template v-if="entry">
      <header class="article-header">
        <p class="article-kicker"><span class="article-kicker-label">مدونة</span></p>

        <h1 class="article-title">{{ entry.title }}</h1>

        <p class="article-byline">
          <em class="article-byline-prep">بقلم</em>
          <span class="article-byline-author">{{ entry.authors?.[0] ?? 'فَـرَح علي' }}</span>
          <span class="article-byline-sep" aria-hidden="true">·</span>
          <time :datetime="entry.iso">{{ entry.date }}</time>
          <span class="article-byline-sep" aria-hidden="true">·</span>
          <span class="article-byline-time">{{ readTime }}</span>
        </p>

        <div class="article-rule-wrap">
          <CrimsonRule max-width="320px">
            <BlackOrchid :size="16" variant="divider" />
          </CrimsonRule>
        </div>

        <p class="article-lede"><em>{{ entry.excerpt }}</em></p>

        <ul v-if="entry.tags?.length" class="article-tags" aria-label="وسوم">
          <li v-for="tag in entry.tags" :key="tag" class="article-tag">
            <NuxtLink class="article-tag-link" :to="`/tag/${encodeURIComponent(tag)}`"><em>{{ tag }}</em></NuxtLink>
          </li>
        </ul>
      </header>

      <figure class="article-hero">
        <div class="article-figure-frame">
          <img class="article-figure-image" :src="entry.image" :alt="entry.title" loading="eager" decoding="async">
          <div class="article-figure-veil" />
          <div class="article-figure-grain" />
        </div>
      </figure>

      <ArticleBody :blocks="entry.body" />

      <section v-if="entry.sources?.length" class="article-sources" aria-labelledby="weblog-sources-heading">
        <h2 id="weblog-sources-heading" class="article-sources-heading">المصادر</h2>
        <ol class="article-sources-list">
          <li v-for="(src, i) in entry.sources" :key="i" class="article-sources-item">
            <a v-if="src.url" :href="src.url" target="_blank" rel="noopener noreferrer" class="article-source-link">{{ src.text }}</a>
            <span v-else>{{ src.text }}</span>
          </li>
        </ol>
      </section>

      <div class="article-end">
        <CrimsonRule max-width="240px">
          <BlackOrchid :size="14" variant="divider" />
        </CrimsonRule>
        <p class="article-end-credit"><em>— {{ entry.authors?.[0] ?? 'فَـرَح علي' }}</em></p>
      </div>

      <ArticleSiblings
        :prev="prevEntry ? { title: prevEntry.title, to: `/weblog/${prevEntry.slug}`, image: prevEntry.image } : undefined"
        :next="nextEntry ? { title: nextEntry.title, to: `/weblog/${nextEntry.slug}`, image: nextEntry.image } : undefined"
        prev-label="السابقة"
        next-label="التالية"
        aria-label="تدوينات أخرى"
      />

      <nav class="article-back-nav article-back-nav--foot">
        <NuxtLink class="article-back" to="/">
          <span class="article-back-arrow" aria-hidden="true">→</span>
          <span class="article-back-label">العودة إلى الصفحة الرئيسية</span>
        </NuxtLink>
      </nav>
    </template>

    <section v-else class="article-missing">
      <p class="article-missing-kicker">مدونة</p>
      <p class="article-missing-text"><em>الصفحة التي بحثتَ عنها غير موجودة.</em></p>
      <NuxtLink class="article-back" to="/">
        <span class="article-back-arrow" aria-hidden="true">→</span>
        <span class="article-back-label">العودة إلى الصفحة الرئيسية</span>
      </NuxtLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { WeblogEntry } from '~/data/weblog'

const route = useRoute()

// Fetch just this entry (small, fast) so navigation swaps in immediately.
const { data: entry } = await useFetch<WeblogEntry>(() => `/api/posts/weblog/${route.params.slug}`, {
  key: () => `weblog-${route.params.slug}`,
})

// Sibling list loads lazily (non-blocking).
const { data: weblog } = useFetch<WeblogEntry[]>('/api/posts', {
  query: { kind: 'weblog' }, lazy: true, default: () => [], key: 'weblog-list',
})

const entryIndex = computed(() => weblog.value.findIndex(e => e.slug === route.params.slug))
const prevEntry = computed(() => entryIndex.value > 0 ? weblog.value[entryIndex.value - 1] : undefined)
const nextEntry = computed(() =>
  entryIndex.value >= 0 && entryIndex.value < weblog.value.length - 1 ? weblog.value[entryIndex.value + 1] : undefined)

const readTime = computed(() => entry.value ? readingTimeLabel(entry.value.body) : '')

useHead(() => ({
  title: entry.value ? `${entry.value.title} — Farah` : 'مدونة — Farah',
  meta: entry.value ? [{ name: 'description', content: entry.value.excerpt }] : [],
}))
</script>

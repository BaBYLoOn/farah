<template>
  <main class="tag-page" lang="ar" dir="rtl">
    <div class="tag-atmosphere" aria-hidden="true"><div class="tag-veil" /></div>

    <header class="tag-header">
      <p class="eyebrow">وَسْم</p>
      <h1 class="tag-title"># {{ tag }}</h1>
      <div class="tag-rule-wrap">
        <CrimsonRule max-width="320px"><BlackOrchid :size="16" variant="divider" /></CrimsonRule>
      </div>
      <p class="tag-count">
        <em v-if="total">{{ arabicNum(total) }} {{ total === 1 ? 'نتيجة' : 'نتائج' }}</em>
        <em v-else>لا توجد نتائج بهذا الوسم بعد.</em>
      </p>
    </header>

    <section v-if="essays.length" class="tag-section">
      <h2 class="tag-section-title">المقالات</h2>
      <div class="essays-grid">
        <EssayCard v-for="(e, i) in essays" :key="e.id" :essay="e" :card-idx="i" />
      </div>
    </section>

    <section v-if="weblogs.length" class="tag-section">
      <h2 class="tag-section-title">المدونة</h2>
      <ol class="weblog-list tag-weblog-list">
        <WeblogCard v-for="(w, i) in weblogs" :key="w.id" :entry="w" :card-idx="i" />
      </ol>
    </section>

    <nav class="tag-back">
      <NuxtLink class="article-back" to="/">
        <span class="article-back-arrow" aria-hidden="true">→</span>
        <span class="article-back-label">العودة إلى الصفحة الرئيسية</span>
      </NuxtLink>
    </nav>
  </main>
</template>

<script setup lang="ts">
import type { Essay } from '~/data/essays'
import type { WeblogEntry } from '~/data/weblog'

const route = useRoute()
const tag = computed(() => decodeURIComponent(String(route.params.tag)))

// All published posts (essays + weblog), then filter by this tag.
const { data: posts } = await useFetch<(Essay | WeblogEntry)[]>('/api/posts', {
  key: () => `tag-${tag.value}`,
  default: () => [],
})

const matching = computed(() => (posts.value || []).filter((p: any) => (p.tags || []).includes(tag.value)))
const essays = computed(() => matching.value.filter((p: any) => p.kind === 'essay') as Essay[])
const weblogs = computed(() => matching.value.filter((p: any) => p.kind === 'weblog') as WeblogEntry[])
const total = computed(() => matching.value.length)

const AR = '٠١٢٣٤٥٦٧٨٩'
const arabicNum = (n: number) => String(n).replace(/\d/g, d => AR[+d])

useHead(() => ({ title: `#${tag.value} — Farah` }))
</script>

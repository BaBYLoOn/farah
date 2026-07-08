<template>
  <section id="weblog" class="weblog">
    <div class="weblog-atmosphere" aria-hidden="true">
      <div class="weblog-veil" />
      <div class="weblog-paper" />
      <div class="weblog-grain" />
    </div>

    <RefMotif name="fire-keeper" :size="280" class="weblog-bg-motif" aria-hidden="true" />

    <header class="weblog-header">
      <p ref="eyebrowEl" class="eyebrow animate-in">{{ copy.eyebrow }}</p>

      <div ref="ruleTopEl" class="weblog-rule-wrap animate-in">
        <CrimsonRule max-width="380px">
          <BlackOrchid :size="16" variant="divider" />
        </CrimsonRule>
      </div>

      <h2 ref="titleEl" class="weblog-title animate-in">{{ copy.title }}</h2>

      <p ref="subEl" class="weblog-sub animate-in">
        <em>{{ copy.sub }}</em>
      </p>
    </header>

    <ol class="weblog-list">
      <WeblogCard
        v-for="(entry, idx) in weblog"
        :key="entry.id"
        :entry="entry"
        :card-idx="idx"
      />
    </ol>

    <div ref="footerOrnamentEl" class="weblog-foot animate-in">
      <span class="section-sep" aria-hidden="true" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { WeblogEntry } from '~/data/weblog'

import { DEFAULT_SITE } from '~/data/site'

// Published weblog entries, ordered by admin, from the database.
const { data: weblog } = await useFetch<WeblogEntry[]>('/api/posts', {
  query: { kind: 'weblog' },
  default: () => [],
})

const { data: site } = useSite()
const copy = computed(() => site.value?.weblog ?? DEFAULT_SITE.weblog)

const eyebrowEl = ref<HTMLElement>()
const ruleTopEl = ref<HTMLElement>()
const titleEl = ref<HTMLElement>()
const subEl = ref<HTMLElement>()
const footerOrnamentEl = ref<HTMLElement>()

onMounted(() => {
  const targets = [eyebrowEl, ruleTopEl, titleEl, subEl, footerOrnamentEl]
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('visible')
        io.unobserve(e.target)
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
  )
  targets.forEach(t => t.value && io.observe(t.value))
  onUnmounted(() => io.disconnect())
})
</script>

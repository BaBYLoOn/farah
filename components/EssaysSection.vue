<template>
  <section id="essays" class="essays">
    <div class="essays-atmosphere" aria-hidden="true">
      <div class="essays-veil" />
      <div class="essays-grain" />
    </div>

    <header class="essays-header">
      <p ref="eyebrowEl" class="eyebrow animate-in">{{ copy.eyebrow }}</p>

      <div ref="ruleTopEl" class="essays-rule-wrap animate-in">
        <CrimsonRule max-width="420px">
          <BlackOrchid :size="18" variant="divider" />
        </CrimsonRule>
      </div>

      <h2 ref="titleEl" class="essays-title animate-in">{{ copy.title }}</h2>

      <p ref="subEl" class="essays-sub animate-in">
        <em>{{ copy.sub }}</em>
      </p>
    </header>

    <div class="essays-grid">
      <EssayCard
        v-for="(essay, idx) in essays"
        :key="essay.id"
        :essay="essay"
        :card-idx="idx"
      />
    </div>

    <div ref="footerOrnamentEl" class="essays-foot animate-in">
      <span class="section-sep" aria-hidden="true" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Essay } from '~/data/essays'

import { DEFAULT_SITE } from '~/data/site'

// Published essays, ordered by admin, from the database.
const { data: essays } = await useFetch<Essay[]>('/api/posts', {
  query: { kind: 'essay' },
  default: () => [],
})

const { data: site } = useSite()
const copy = computed(() => site.value?.essays ?? DEFAULT_SITE.essays)

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

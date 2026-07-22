<template>
  <footer class="site-foot">
    <div class="site-foot-atmosphere" aria-hidden="true">
      <div class="site-foot-veil" />
    </div>

    <div ref="orchidEl" class="site-foot-orchid animate-in">
      <BlackOrchid :size="48" variant="mark" />
    </div>

    <nav ref="socialsEl" class="site-foot-socials animate-in" aria-label="External links">
      <a
        v-for="link in footerSocials"
        :key="link.key"
        class="site-foot-social-icon"
        :href="link.href"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="link.label"
      >
        <img v-if="link.icon" :src="link.icon" class="site-foot-social-img" alt="" width="22" height="22">
        <span v-else style="display:inline-flex" v-html="iconFor(link.key)" />
      </a>
    </nav>

    <p ref="nameEl" class="site-foot-name animate-in">{{ footerName }}</p>

    <p ref="copyEl" class="site-foot-copy animate-in">
      © {{ year }} {{ footerName }}
    </p>
  </footer>
</template>

<script setup lang="ts">
import { DEFAULT_SITE } from '~/data/site'

const { data: site } = useSite()
const footerSocials = computed(() => site.value?.socials ?? DEFAULT_SITE.socials)
const footerName = computed(() => site.value?.footer?.name ?? DEFAULT_SITE.footer.name)

const icons: Record<string, string> = {
  essays:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M20 3 C16 5 12 8 9 12 L7 15 L5 17 L4 18 L6 20 L7 19 L9 17 L12 15 C16 12 19 8 21 4 Z"/><path d="M9 17 L7 19"/><path d="M5 21 L9 21"/></svg>`,
  weblog:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M3 5 L11 7 L11 19 L3 17 Z"/><path d="M21 5 L13 7 L13 19 L21 17 Z"/><path d="M11 7 L13 7"/></svg>`,
  link:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M9 15 L15 9"/><path d="M11 6 L13 4 C15 2 18 2 20 4 C22 6 22 9 20 11 L18 13"/><path d="M13 18 L11 20 C9 22 6 22 4 20 C2 18 2 15 4 13 L6 11"/></svg>`,
  letterboxd: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="3" y="9" width="18" height="11" rx="0.5"/><path d="M3 9 L4.6 5 L21 5 L19.4 9 Z"/><path d="M8 5 L6.4 9"/><path d="M13 5 L11.4 9"/><path d="M18 5 L16.4 9"/></svg>`,
  pinterest:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="11" r="7.5"/><path d="M10.6 7.6 L10.6 14.4"/><path d="M10.6 7.6 L13 7.6 C14.4 7.6 15.2 8.6 15.2 9.8 C15.2 11 14.4 11.9 13 11.9 L10.6 11.9"/><path d="M10.6 14.4 L9.2 20.5"/></svg>`,
  soundcloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M4.5 6 C7 4 11 4 13.5 6 C15.5 5.4 18 6.4 18.5 8.4" opacity="0.55"/><path d="M3 14 L3 10"/><path d="M6 17 L6 9"/><path d="M9 19 L9 7"/><path d="M12 17 L12 9"/><path d="M15 15 L15 11"/><path d="M18 17 L18 9"/><path d="M21 14 L21 10"/></svg>`,
  instagram:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.2" cy="6.8" r="0.85" fill="currentColor"/></svg>`,
  telegram:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M21 4.5 L3 10.5 L7.45 12.2 L9.5 19 L12.4 16 L17 19.5 Z"/><path d="M7.45 12.2 L18 6.7"/></svg>`,
}
const iconFor = (key: string) => icons[key] ?? icons.link

const year = new Date().getFullYear()

const orchidEl = ref<HTMLElement>()
const socialsEl = ref<HTMLElement>()
const nameEl = ref<HTMLElement>()
const copyEl = ref<HTMLElement>()

onMounted(() => {
  const targets = [orchidEl, socialsEl, nameEl, copyEl]
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('visible')
        io.unobserve(e.target)
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
  )
  targets.forEach(t => t.value && io.observe(t.value))
  onUnmounted(() => io.disconnect())
})
</script>

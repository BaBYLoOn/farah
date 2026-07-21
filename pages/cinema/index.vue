<template>
  <main class="cinema-scope cinema-page" dir="ltr">
    <header class="cinema-head">
      <p class="placard" v-reveal>Farah's</p>
      <h1 class="cinema-marquee" v-reveal="120">Cinema</h1>
    </header>

    <section v-if="favFilms.length" class="favs" aria-label="Favorite films" v-reveal>
      <div class="favs-head">
        <h2 class="favs-label">Favorite Films</h2>
        <NuxtLink to="/cinema/favorites" class="see-all">See all ›</NuxtLink>
      </div>
      <div class="favs-carousel" tabindex="0" aria-label="Swipe through favorite films">
        <a v-for="f in favFilms" :key="f.id" class="fav" :title="f.title" v-bind="imdbAttrs(f)">
          <img v-poster v-if="posterOf(f)" :src="posterOf(f)" alt="" loading="lazy" @error="onPosterErr($event, f)" />
          <span v-else class="fav-fallback">{{ f.title }}</span>
        </a>
        <NuxtLink to="/cinema/favorites" class="fav fav-more" aria-label="See all favorite films">
          <span class="fav-more-in">See all<span class="fav-more-arrow" aria-hidden="true">›</span></span>
        </NuxtLink>
      </div>
      <p v-if="favFilms.length > 4" class="swipe-hint" aria-hidden="true"><span>‹</span> swipe for more <span>›</span></p>
    </section>

    <section v-if="favSeries.length" class="favs" aria-label="Favorite series" v-reveal>
      <div class="favs-head">
        <h2 class="favs-label">Favorite Series</h2>
        <NuxtLink to="/cinema/favorites" class="see-all">See all ›</NuxtLink>
      </div>
      <div class="favs-carousel" tabindex="0" aria-label="Swipe through favorite series">
        <a v-for="f in favSeries" :key="f.id" class="fav" :title="f.title" v-bind="imdbAttrs(f)">
          <img v-poster v-if="posterOf(f)" :src="posterOf(f)" alt="" loading="lazy" @error="onPosterErr($event, f)" />
          <span v-else class="fav-fallback">{{ f.title }}</span>
        </a>
        <NuxtLink to="/cinema/favorites" class="fav fav-more" aria-label="See all favorite series">
          <span class="fav-more-in">See all<span class="fav-more-arrow" aria-hidden="true">›</span></span>
        </NuxtLink>
      </div>
      <p v-if="favSeries.length > 4" class="swipe-hint" aria-hidden="true"><span>‹</span> swipe for more <span>›</span></p>
    </section>

    <CinemaArchive
      :films="films"
      :diary-records="diaryRecords"
      :diary-counts="diaryCounts"
      :diary-loading="diaryLoading"
      @load-diary="loadDiary"
    />

    <ClientOnly>
      <Teleport to="body">
        <button v-show="showTop" class="cinema-totop" aria-label="Back to top" title="Back to top" @click="scrollTop">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
        </button>
      </Teleport>
    </ClientOnly>
  </main>
</template>

<script setup lang="ts">
const { data } = await useFetch<any>('/api/cinema/content', { key: 'cinema-content' })
const films = computed(() => data.value?.films ?? [])
const diaryCounts = computed(() => data.value?.diaryCounts ?? { all: 0, film: 0, series: 0 })

useSeoMeta({ title: 'Cinema — Farah', description: 'Films and television, rated, logged and reviewed.' })

const CAROUSEL_MAX = 10
function favList(kind: 'film' | 'series') {
  const pool = films.value.filter((f: any) => posterOf(f) && f.type === kind)
  const flagged = pool.filter((f: any) => f.favorite)
  if (flagged.length) return [...flagged].sort((a: any, b: any) => (a.favSort || 0) - (b.favSort || 0)).slice(0, CAROUSEL_MAX)
  return [...pool].sort((a: any, b: any) => (b.myRating ?? 0) - (a.myRating ?? 0) || (b.imdb ?? 0) - (a.imdb ?? 0)).slice(0, CAROUSEL_MAX)
}
const favFilms = computed(() => favList('film'))
const favSeries = computed(() => favList('series'))

const diaryRecords = ref<any[] | null>(null)
const diaryLoading = ref(false)
async function loadDiary() {
  if (diaryRecords.value || diaryLoading.value) return
  diaryLoading.value = true
  try {
    const r = await $fetch<{ records: any[] }>('/api/cinema/diary')
    diaryRecords.value = r.records
  } finally {
    diaryLoading.value = false
  }
}

// back-to-top button (fixed, appears once you've scrolled a screen)
const showTop = ref(false)
function onScroll() { showTop.value = window.scrollY > 500 }
function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }) }
onMounted(() => { window.addEventListener('scroll', onScroll, { passive: true }); onScroll() })
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

function imdbAttrs(f: any) {
  return f.imdbId ? { href: `https://www.imdb.com/title/${f.imdbId}/`, target: '_blank', rel: 'noopener' } : {}
}
function posterOf(f: any): string | null { return f.poster || f.posterLocal || null }
function onPosterErr(ev: Event, f: any) {
  const img = ev.target as HTMLImageElement & { dataset: DOMStringMap }
  if (f.posterLocal && !img.dataset.fellback) { img.dataset.fellback = '1'; img.src = f.posterLocal }
}
</script>

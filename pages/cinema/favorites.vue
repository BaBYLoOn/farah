<template>
  <main class="cinema-scope cinema-page" dir="ltr">
    <header class="cinema-head">
      <p class="placard"><NuxtLink to="/cinema" class="back-to-cinema">‹ Cinema</NuxtLink></p>
      <h1 class="cinema-marquee">Favorites</h1>
    </header>

    <section v-if="favFilms.length" class="fav-page-section" v-reveal>
      <h2 class="favs-label">Favorite Films</h2>
      <div class="fav-grid">
        <a v-for="f in favFilms" :key="f.id" class="fav-poster" :title="f.title" v-bind="imdbAttrs(f)">
          <img v-poster v-if="posterOf(f)" :src="posterOf(f)" alt="" loading="lazy" @error="onPosterErr($event, f)" />
          <span v-else class="fav-fallback">{{ f.title }}</span>
        </a>
      </div>
    </section>

    <section v-if="favSeries.length" class="fav-page-section" v-reveal>
      <h2 class="favs-label">Favorite Series</h2>
      <div class="fav-grid">
        <a v-for="f in favSeries" :key="f.id" class="fav-poster" :title="f.title" v-bind="imdbAttrs(f)">
          <img v-poster v-if="posterOf(f)" :src="posterOf(f)" alt="" loading="lazy" @error="onPosterErr($event, f)" />
          <span v-else class="fav-fallback">{{ f.title }}</span>
        </a>
      </div>
    </section>

    <p v-if="!favFilms.length && !favSeries.length" class="archive-empty">No favorites picked yet.</p>
  </main>
</template>

<script setup lang="ts">
const { data } = await useFetch<any>('/api/cinema/favorites', { key: 'cinema-favs' })
const favFilms = computed(() => data.value?.films ?? [])
const favSeries = computed(() => data.value?.series ?? [])
useSeoMeta({ title: 'Favorites — Cinema', description: 'Hand-picked favorite films and series.' })
onMounted(() => window.scrollTo(0, 0))

function imdbAttrs(f: any) {
  return f.imdbId ? { href: `https://www.imdb.com/title/${f.imdbId}/`, target: '_blank', rel: 'noopener' } : {}
}
function posterOf(f: any): string | null { return f.poster || f.posterLocal || null }
function onPosterErr(ev: Event, f: any) {
  const img = ev.target as HTMLImageElement & { dataset: DOMStringMap }
  if (f.posterLocal && !img.dataset.fellback) { img.dataset.fellback = '1'; img.src = f.posterLocal }
}
</script>

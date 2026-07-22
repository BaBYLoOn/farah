<template>
  <section ref="root" class="cinema-scope archive-section" :class="{ 'is-admin': admin }" aria-label="My cinema" dir="ltr">
    <div class="archive-controls">
      <!-- Watched / Diary -->
      <div class="tabs2" role="group" aria-label="Archive view">
        <button :class="{ on: tab === 'watched' }" :aria-pressed="tab === 'watched'" @click="tab = 'watched'">Watched <b>{{ films.length }}</b></button>
        <button :class="{ on: tab === 'diary' }" :aria-pressed="tab === 'diary'" @click="tab = 'diary'">Diary <b>{{ diaryCounts.all }}</b></button>
      </div>

      <div v-if="admin" class="afield admin-search">
        <input v-model="search" type="text" :placeholder="`Search ${tab === 'diary' ? 'diary' : 'titles'} — name, director, year…`" />
      </div>

      <!-- type + review filter -->
      <div class="sorts2 filterline" role="group" aria-label="Filter">
        <button :class="{ on: filterType === 'all' }" @click="filterType = 'all'">All <b>{{ counts.all }}</b></button>
        <span class="vsep" aria-hidden="true"></span>
        <button :class="{ on: filterType === 'film' }" @click="filterType = 'film'">Films <b>{{ counts.film }}</b></button>
        <span class="vsep" aria-hidden="true"></span>
        <button :class="{ on: filterType === 'series' }" @click="filterType = 'series'">Series <b>{{ counts.series }}</b></button>
        <span class="vsep" aria-hidden="true"></span>
        <button :class="{ on: filterType === 'review' }" title="Titles with a review" @click="filterType = 'review'">Reviews <b v-if="counts.review != null">{{ counts.review }}</b></button>
      </div>

      <!-- sort (watched only) + view toggle — always ONE line: the sorts scroll
           sideways if they must, the toggle stays pinned at the end -->
      <div v-if="tab === 'watched'" class="sortline">
        <div class="sorts2 sortscroll">
          <template v-for="(opt, i) in sortOptions" :key="opt.key">
            <span v-if="i" class="vsep" aria-hidden="true"></span>
            <button :class="{ on: sortBy === opt.key }" @click="setSort(opt.key)">
              <span v-if="opt.star" class="sort-star" :class="opt.star" aria-hidden="true">★</span>{{ opt.label }}<template v-if="sortBy === opt.key"> {{ dir === 'desc' ? '↓' : '↑' }}</template>
            </button>
          </template>
        </div>
        <div class="viewtoggle2">
          <button :aria-label="view === 'list' ? 'Grid view' : 'List view'" @click="view = view === 'list' ? 'cards' : 'list'">
            <svg v-if="view === 'list'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- DIARY -->
    <div v-if="tab === 'diary'">
      <div v-if="diaryLoading && !diaryRecords" class="diary-loading"><span class="spinner small" aria-hidden="true"></span> Loading the diary…</div>
      <div v-else-if="shown.length" class="diary">
        <template v-for="g in diaryGroups" :key="g.key">
          <h3 class="diary-month">{{ g.label }}</h3>
          <article v-for="e in g.entries" :key="e.rowKey" class="diary-row" :class="{ 'is-open': isOpen(e.rowKey) }">
            <span class="diary-day">{{ e.day }}</span>
            <a class="thumb-link" v-bind="imdbAttrs(e)">
              <img v-poster v-if="posterOf(e)" class="diary-thumb" :src="posterOf(e)" alt="" loading="lazy" decoding="async" @error="onPosterErr($event, e)" />
              <div v-else class="diary-thumb diary-thumb-fallback" aria-hidden="true">{{ e.title.charAt(0) }}</div>
              <button v-if="admin" type="button" class="arch-edit small" title="Edit title" @click.stop.prevent="emit('edit', e)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
            </a>
            <div class="lrow-main">
              <h3>{{ e.title }}</h3>
              <span class="lrow-sub">{{ subLine(e) }}</span>
              <span class="lrow-ratings">
                <span v-if="e.imdb != null" class="r-imdb"><span class="star" aria-hidden="true">★</span>{{ e.imdb.toFixed(1) }}</span>
                <span v-if="e.myRating != null" class="r-mine"><span class="star" aria-hidden="true">★</span>{{ e.myRating }}</span>
                <CinemaWatchBadge :title="e" />
                <button
                  v-if="e.reviews && e.reviews.length"
                  type="button"
                  class="review-jump"
                  :class="{ open: isOpen(e.rowKey) }"
                  :aria-expanded="isOpen(e.rowKey)"
                  :title="`${isOpen(e.rowKey) ? 'Hide' : 'Read'} ${e.title}'s review${e.reviews.length > 1 ? 's' : ''}`"
                  @click="toggleReview(e.rowKey)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><path d="M9 9h1M9 13h6M9 17h6"/></svg>
                  <span>{{ e.reviews.length > 1 ? `${e.reviews.length} reviews` : 'review' }}</span>
                  <span class="rj-chev" aria-hidden="true">▾</span>
                </button>
              </span>
            </div>

            <!-- expanded in place: the title's details + every review it has -->
            <div v-if="isOpen(e.rowKey)" class="diary-open">
              <p v-if="e.by" class="diary-open-by">
                <span class="by-lbl">{{ e.type === 'series' ? 'Created by' : 'Directed by' }}</span> {{ e.by }}
              </p>
              <p v-for="rv in e.reviews" :key="rv.id" class="title-review">
                <span v-if="rv.reviewed" class="tr-date">{{ fmtDate(rv.reviewed) }}</span>
                <span class="tr-text" dir="auto">{{ rv.text }}</span>
              </p>
            </div>
          </article>
        </template>
      </div>
      <p v-else class="archive-empty">Nothing here matches.</p>
    </div>

    <!-- WATCHED — list -->
    <div v-else-if="view === 'list' && shown.length" class="list">
      <article v-for="f in visible" :key="f.id" :id="`t-${f.id}`" class="lrow" :class="{ 'is-fav': isFav(f) }">
        <a class="thumb-link" v-bind="imdbAttrs(f)">
          <img v-poster v-if="posterOf(f)" class="thumb" :src="posterOf(f)" alt="" loading="lazy" decoding="async" @error="onPosterErr($event, f)" />
          <div v-else class="thumb-fallback" aria-hidden="true">{{ f.title.charAt(0) }}</div>
          <button v-if="admin" type="button" class="arch-edit" title="Edit title" @click.stop.prevent="emit('edit', f)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <span v-if="isFav(f)" class="fav-badge" title="In your favorites" aria-hidden="true">♥</span>
        </a>
        <div class="lrow-main">
          <h3>{{ f.title }}</h3>
          <span class="lrow-sub">{{ subLine(f) }}</span>
          <span class="lrow-ratings">
            <span v-if="f.imdb != null" class="r-imdb"><span class="star" aria-hidden="true">★</span>{{ f.imdb.toFixed(1) }}</span>
            <span v-if="f.myRating != null" class="r-mine"><span class="star" aria-hidden="true">★</span>{{ f.myRating }}</span>
            <CinemaWatchBadge :title="f" />
          </span>
          <span v-if="f.by" class="lrow-by"><span class="by-lbl">{{ f.type === 'series' ? 'Created by' : 'Directed by' }}</span> {{ f.by }}</span>
        </div>
        <div v-if="f.reviews && f.reviews.length" class="title-reviews">
          <p v-for="rv in f.reviews" :key="rv.id" class="title-review">
            <span v-if="rv.reviewed" class="tr-date">{{ fmtDate(rv.reviewed) }}</span>
            <span class="tr-text" dir="auto">{{ rv.text }}</span>
          </p>
        </div>
      </article>
    </div>

    <!-- WATCHED — grid -->
    <div v-else-if="shown.length" class="archive">
      <article v-for="(f, i) in visible" :key="f.id" class="film" :class="{ 'is-fav': isFav(f) }" v-reveal="(i % 8) * 45">
        <a class="film-frame" v-bind="imdbAttrs(f)" :title="f.title">
          <img v-poster v-if="posterOf(f)" :src="posterOf(f)" alt="" loading="lazy" decoding="async" @error="onPosterErr($event, f)" />
          <div v-else class="no-poster" aria-hidden="true"><span class="np-year">{{ f.year }}</span><span class="np-title">{{ f.title }}</span></div>
          <button v-if="admin" type="button" class="arch-edit" title="Edit title" @click.stop.prevent="emit('edit', f)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <span v-if="isFav(f)" class="fav-badge" title="In your favorites" aria-hidden="true">♥</span>
          <span v-if="f.reviews && f.reviews.length" class="grid-review-flag" title="Has a review" aria-hidden="true">❝</span>
        </a>
        <span class="lrow-ratings film-ratings">
          <span v-if="f.imdb != null" class="r-imdb" title="IMDb">{{ f.imdb.toFixed(1) }}</span>
          <span v-if="f.myRating != null" class="r-mine" :title="`My rating ${f.myRating}/10`">{{ f.myRating }}</span>
          <CinemaWatchBadge :title="f" />
        </span>
      </article>
    </div>

    <p v-else class="archive-empty">Nothing here matches.</p>
    <div ref="sentinel" aria-hidden="true"></div>
  </section>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  films: any[]
  diaryRecords?: any[] | null
  diaryCounts?: { all: number; film: number; series: number }
  diaryLoading?: boolean
  admin?: boolean
}>(), {
  diaryRecords: null,
  diaryCounts: () => ({ all: 0, film: 0, series: 0 }),
  diaryLoading: false,
  admin: false,
})

const emit = defineEmits<{ (e: 'edit', title: any): void; (e: 'load-diary'): void }>()

type SortKey = 'watched' | 'year' | 'imdb' | 'myRating' | 'title'
type Filter = 'all' | 'film' | 'series' | 'review'

const sortOptions: Array<{ key: SortKey; label: string; star?: 'gold' | 'red' }> = [
  { key: 'watched', label: 'Watched' },
  { key: 'year', label: 'Release' },
  { key: 'imdb', label: 'IMDb', star: 'gold' },
  { key: 'myRating', label: 'Mine', star: 'red' },
  { key: 'title', label: 'A–Z' },
]

const tab = ref<'watched' | 'diary'>('watched')
const filterType = ref<Filter>('all')
const view = ref<'list' | 'cards'>('list')
const sortBy = ref<SortKey>('watched')
const dir = ref<'asc' | 'desc'>('desc')
const search = ref('')

// Diary rows whose reviews are expanded in place. Keyed per ROW, not per title,
// so a film watched twice expands only the entry you actually pressed.
const openRows = ref(new Set<string>())
const isOpen = (key: string) => openRows.value.has(key)
function toggleReview(key: string) {
  const next = new Set(openRows.value)
  next.has(key) ? next.delete(key) : next.add(key)
  openRows.value = next
}

function matchSearch(f: any): boolean {
  if (!props.admin) return true
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  const hay = `${f.title} ${f.by ?? ''} ${f.year ?? ''}`.toLowerCase()
  return q.split(/\s+/).every((w) => hay.includes(w))
}

function setSort(key: SortKey) {
  if (sortBy.value === key) dir.value = dir.value === 'desc' ? 'asc' : 'desc'
  else { sortBy.value = key; dir.value = key === 'title' ? 'asc' : 'desc' }
}

const hasReview = (f: any) => (f.reviews?.length ?? 0) > 0

function yearLabel(f: any): string | number | null {
  if (f.type !== 'series' || f.year == null) return f.year
  if (f.ended === false) return `${f.year}–`
  if (f.ended === true) return f.endYear && f.endYear !== f.year ? `${f.year}–${f.endYear}` : `${f.year}`
  return f.year
}

function subLine(f: any): string {
  const se = f.season != null
    ? `S${String(f.season).padStart(2, '0')}${f.episode != null ? ` E${String(f.episode).padStart(2, '0')}` : ''}`
    : null
  const typeLabel = se ? null : (f.type === 'series' ? 'Series' : 'Film')
  return [yearLabel(f), f.runtime, typeLabel, se].filter(Boolean).join(' · ')
}

function fmtDate(iso: string): string {
  const [y, m, d] = String(iso).split('-')
  if (!y) return String(iso)
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1] ?? m
  return d ? `${Number(d)} ${mon} ${y}` : `${mon} ${y}`
}

function imdbAttrs(f: any) {
  return f.imdbId ? { href: `https://www.imdb.com/title/${f.imdbId}/`, target: '_blank', rel: 'noopener' } : {}
}
function posterOf(f: any): string | null { return f.poster || f.posterLocal || null }
function onPosterErr(ev: Event, f: any) {
  const img = ev.target as HTMLImageElement & { dataset: DOMStringMap }
  if (f.posterLocal && !img.dataset.fellback) { img.dataset.fellback = '1'; img.src = f.posterLocal }
}
function isFav(f: any): boolean { return props.admin && !!f.favorite }

const filmsById = computed(() => {
  const m = new Map<number, any>()
  for (const f of props.films) m.set(f.id, f)
  return m
})

const counts = computed(() => {
  if (tab.value === 'diary') {
    const recs = props.diaryRecords
    if (recs) {
      const byId = filmsById.value
      let all = 0, film = 0, series = 0, review = 0
      for (const r of recs) {
        const f = byId.get(r.titleId)
        if (!f || !matchSearch(f)) continue
        all++
        if (f.type === 'film') film++; else if (f.type === 'series') series++
        if (hasReview(f)) review++
      }
      return { all, film, series, review }
    }
    const base = props.diaryCounts ?? { all: 0, film: 0, series: 0 }
    return { all: base.all, film: base.film, series: base.series, review: null }
  }
  const base = props.films.filter(matchSearch)
  return {
    all: base.length,
    film: base.filter((f: any) => f.type === 'film').length,
    series: base.filter((f: any) => f.type === 'series').length,
    review: base.filter(hasReview).length,
  }
})

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const shown = computed(() => {
  if (tab.value === 'diary') {
    // Hold a REFERENCE to the title plus the record's own fields. Merging them
    // into a new object here would copy all ~550 diary entries on every tab,
    // filter or search change when only `limit` of them are ever rendered —
    // diaryGroups does the merge, for the visible slice only.
    const byId = filmsById.value
    const out: any[] = []
    for (const r of (props.diaryRecords ?? [])) {
      const f = byId.get(r.titleId)
      if (!f || !matchSearch(f)) continue
      if (filterType.value === 'review') { if (!hasReview(f)) continue }
      else if (filterType.value !== 'all' && f.type !== filterType.value) continue
      out.push({ f, watched: r.watched, season: r.season, episode: r.episode })
    }
    return out
  }
  const list = props.films.filter((f: any) => {
    if (!matchSearch(f)) return false
    if (filterType.value === 'review') return hasReview(f)
    if (filterType.value === 'all') return true
    return f.type === filterType.value
  })
  const m = dir.value === 'asc' ? -1 : 1
  const by = sortBy.value
  return [...list].sort((a: any, b: any) => {
    switch (by) {
      case 'myRating': return m * ((b.myRating ?? 0) - (a.myRating ?? 0) || (b.imdb ?? 0) - (a.imdb ?? 0))
      case 'imdb': return m * ((b.imdb ?? 0) - (a.imdb ?? 0) || (b.myRating ?? 0) - (a.myRating ?? 0))
      case 'year': return m * ((b.year ?? 0) - (a.year ?? 0))
      case 'title': return m * b.title.localeCompare(a.title)
      default: return m * String(b.watched ?? '').localeCompare(String(a.watched ?? ''))
    }
  })
})

const diaryGroups = computed(() => {
  const groups: Array<{ key: string; label: string; entries: any[] }> = []
  for (const rec of visible.value) {
    const [y, m, d] = String(rec.watched).split('-')
    if (!y || !m) continue
    const key = `${y}-${m}`
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) { g = { key, label: `${MONTHS[Number(m) - 1] ?? m} ${y}`, entries: [] }; groups.push(g) }
    // merge title + record only for the rows actually being drawn. rowKey
    // identifies this exact watch (a rewatch is its own row, and expands alone).
    g.entries.push({
      ...rec.f,
      watched: rec.watched, season: rec.season, episode: rec.episode, day: Number(d),
      rowKey: `${rec.f.id}-${rec.watched}-${rec.season ?? ''}-${rec.episode ?? ''}-${g.entries.length}`,
    })
  }
  return groups
})

// Switching tab/sort/filter re-renders the list from scratch, so the FIRST paint
// is kept small — that's the part the eye waits on. The observer below then
// extends the list 1000px before you reach the end, so scrolling still feels
// continuous and you never actually see it stop.
const FIRST_CHUNK = 24
const CHUNK = 48
const limit = ref(FIRST_CHUNK)
const visible = computed(() => shown.value.slice(0, limit.value))
watch([tab, view, sortBy, dir, filterType, search], () => { limit.value = FIRST_CHUNK })

const sentinel = ref<HTMLElement | null>(null)
const root = ref<HTMLElement | null>(null)
let io: IntersectionObserver | undefined

// Watched and Diary are separate lists, so they must not share a scroll
// position — switching while deep in one would otherwise drop you into the
// middle of the other. Rewind to the top of the archive (NOT the top of the
// page: that would yank you back past the favourites carousels), and only when
// you're actually below it, so browsing the carousels stays undisturbed.
function rewindToList() {
  if (!import.meta.client) return
  nextTick(() => {
    const el = root.value
    if (!el) return
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const deck = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deck-top')) || 3.7
    const target = el.getBoundingClientRect().top + window.scrollY - deck * rem
    if (window.scrollY > target) window.scrollTo({ top: target, behavior: 'auto' })
  })
}

watch(tab, (t) => {
  if (t === 'diary' && !props.diaryRecords) emit('load-diary')
  rewindToList()
})

onMounted(() => {
  io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && limit.value < shown.value.length) {
      limit.value += CHUNK
      nextTick(() => { if (sentinel.value && io) { io.unobserve(sentinel.value); io.observe(sentinel.value) } })
    }
  }, { rootMargin: '1000px 0px' })
  if (sentinel.value) io.observe(sentinel.value)
})
onBeforeUnmount(() => io?.disconnect())
</script>

<style scoped>
/* admin edit pencil overlaid on posters so the row/grid stay identical to public */
.is-admin :deep(.thumb-link),
.is-admin :deep(.film-frame) { position: relative; }

.arch-edit {
  position: absolute; top: 0.35rem; left: 0.35rem;
  display: grid; place-items: center; width: 1.9rem; height: 1.9rem; padding: 0;
  border: 1px solid var(--c-line); border-radius: 999px;
  background: rgba(8, 5, 5, 0.85); color: var(--c-accent); cursor: pointer;
  opacity: 0.9; z-index: 3; transition: transform 0.2s ease;
}
.arch-edit.small { width: 1.5rem; height: 1.5rem; top: 0.2rem; left: 0.2rem; }
.arch-edit svg { width: 0.95rem; height: 0.95rem; }
.arch-edit.small svg { width: 0.75rem; height: 0.75rem; }
.arch-edit:hover { transform: scale(1.06); }

.fav-badge {
  position: absolute; top: 0.35rem; right: 0.35rem;
  display: grid; place-items: center; min-width: 1.6rem; height: 1.6rem; padding: 0 0.3rem;
  border: 1px solid rgba(184, 28, 28, 0.5); border-radius: 999px;
  background: rgba(8, 5, 5, 0.85); color: var(--c-red); font-size: 0.95rem; z-index: 3;
}
.is-fav :deep(.thumb), .is-fav :deep(.thumb-fallback), .is-fav :deep(.film-frame) {
  border-color: var(--c-accent-soft);
  box-shadow: 0 0 0 1px var(--c-accent-soft), 0 10px 22px rgba(0,0,0,0.5);
}

.admin-search { margin: 0.7rem 0 0.2rem; }
.admin-search input {
  width: 100%; background: #0b0707; border: 1px solid var(--c-line);
  color: var(--c-ink); font-family: var(--c-body); font-size: 0.95rem; padding: 0.55rem 0.7rem; outline: none;
}
.admin-search input:focus { border-color: var(--c-accent-soft); }
</style>

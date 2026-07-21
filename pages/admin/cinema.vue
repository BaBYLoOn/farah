<template>
  <main class="admin" dir="ltr">
    <header class="admin-topbar">
      <div class="admin-topbar-inner">
        <div class="admin-brand"><span class="admin-brand-name">🎬 Cinema</span></div>
        <div class="admin-topbar-actions">
          <NuxtLink to="/admin" class="admin-btn admin-btn--ghost">‹ Dashboard</NuxtLink>
          <NuxtLink to="/cinema" class="admin-btn admin-btn--ghost" target="_blank">View ↗</NuxtLink>
        </div>
      </div>
    </header>

    <div class="admin-body cinema-scope">
      <!-- ── Sources ── -->
      <section class="cadmin-card">
        <h2>Sources</h2>
        <p class="cadmin-note">
          <b>Films</b> come from Letterboxd (<span class="hl">letterboxd.com/orchidee26_</span> — RSS
          auto-syncs every 6h; full history via <code>diary.csv</code>). <b>Reviews</b> are pulled from
          the same feed onto films already in the diary; upload <code>reviews.csv</code> for the backlog.
          <b>Series</b> come from Trakt. After any add, TMDB details + IMDb id/rating fill in automatically.
        </p>
        <div class="crow">
          <button class="cbtn" :disabled="syncing" @click="sync">{{ syncing ? 'Syncing…' : 'Sync Letterboxd' }}</button>
          <button class="cbtn ghost" :disabled="processing" @click="processNow">{{ processing ? 'Working…' : 'Fetch missing data' }}</button>
          <button class="cbtn ghost" :disabled="refreshing" @click="refreshPosters">{{ refreshing ? refreshMsg : 'Refresh posters (TMDB)' }}</button>
          <span v-if="syncMsg" class="cmsg" :class="{ err: syncErr }">{{ syncMsg }}</span>
        </div>
        <div class="crow">
          <label class="cfield"><span>Diary history (diary.csv) — full film diary</span><input type="file" accept=".csv,text/csv" @change="importDiary" /></label>
        </div>
        <div class="crow">
          <label class="cfield"><span>Reviews (reviews.csv) — full review history (diary first)</span><input type="file" accept=".csv,text/csv" @change="importReviews" /></label>
        </div>
        <label class="ccheck"><input type="checkbox" :checked="autosyncPaused" @change="setAutosyncPaused(($event.target as HTMLInputElement).checked)" /> Pause automatic syncing (while I upload)</label>

        <div class="crow trakt-row">
          <template v-if="!trakt.hasKeys">
            <span class="cmsg err">Trakt keys missing — create an app at trakt.tv/oauth/applications, set NUXT_TRAKT_CLIENT_ID + NUXT_TRAKT_CLIENT_SECRET in .env, then restart. The Connect button appears here once the keys are set.</span>
          </template>
          <template v-else-if="!trakt.connected">
            <button class="cbtn" :disabled="!!traktCode" @click="traktConnect">Connect Trakt</button>
            <span v-if="traktCode" class="cmsg">Go to <b class="hl">{{ traktCode.url }}</b> and enter code <b class="hl">{{ traktCode.userCode }}</b> — waiting…</span>
          </template>
          <template v-else>
            <button class="cbtn" :disabled="traktSyncing" @click="traktSync">{{ traktSyncing ? 'Syncing…' : 'Sync Trakt (episodes + ratings)' }}</button>
            <span class="cmsg ok">Trakt connected ✓</span>
          </template>
          <span v-if="traktMsg" class="cmsg" :class="{ err: traktErr }">{{ traktMsg }}</span>
        </div>
      </section>

      <!-- ── Add a title — TMDB search ── -->
      <section class="cadmin-card">
        <h2>Add a title — search TMDB</h2>
        <label class="cfield"><span>Search a film or series</span><input v-model="q" type="text" placeholder="e.g. Persona" @input="onSearch" /></label>
        <div v-if="hits.length && !draft" class="tmdb-hits">
          <div v-for="h in hits" :key="h.type + h.tmdbId" class="tmdb-hit">
            <img v-if="h.poster" :src="h.poster" alt="" /><div v-else class="noimg"></div>
            <div class="th-main"><div class="t">{{ h.title }}</div><div class="m">{{ h.year ?? '—' }} · {{ h.type === 'series' ? 'Series' : 'Film' }}</div></div>
            <button class="cbtn ghost" @click="pick(h)">Use</button>
          </div>
        </div>
        <div v-if="draft" class="draft">
          <p class="cadmin-note">Auto-filled from TMDB — <span class="hl">the gold fields are yours</span>.</p>
          <div class="crow">
            <label class="cfield grow"><span>Title</span><input v-model="draft.title" type="text" /></label>
            <label class="cfield sm"><span>Year</span><input v-model.number="draft.year" type="number" /></label>
            <label class="cfield sm"><span>Type</span><select v-model="draft.type"><option value="film">Film</option><option value="series">Series</option></select></label>
          </div>
          <div class="crow">
            <label class="cfield"><span>{{ draft.type === 'series' ? 'Creator' : 'Director' }}</span><input v-model="draft.by" type="text" /></label>
            <label class="cfield sm"><span>Runtime</span><input v-model="draft.runtime" type="text" /></label>
            <label class="cfield sm"><span>IMDb id</span><input v-model="draft.imdbId" type="text" placeholder="tt…" /></label>
            <label class="cfield sm gold"><span>My rating</span><input v-model.number="draft.myRating" type="number" min="0" max="10" /></label>
            <label class="cfield sm gold"><span>Watched</span><input v-model="draft.watched" type="date" /></label>
          </div>
          <div class="crow">
            <button class="cbtn" @click="add">+ Add to cinema</button>
            <button class="cbtn ghost" @click="draft = null">Cancel</button>
          </div>
        </div>
      </section>

      <!-- ── Favorites — drag to reorder ── -->
      <section class="cadmin-card">
        <button type="button" class="fav-head" :aria-expanded="favOpen" @click="favOpen = !favOpen">
          <span class="fav-head-title">Favorites</span>
          <span class="fav-head-count">{{ favChips('film').length }} films · {{ favChips('series').length }} series</span>
          <span class="fav-head-chev" :class="{ open: favOpen }" aria-hidden="true">▸</span>
        </button>
        <template v-if="favOpen">
          <p class="cadmin-note">These fill the carousels on the cinema page. <b class="hl">Grab a poster and drag</b> to reorder (works by touch). With none picked, the row falls back to your top-rated.</p>
          <div v-for="kind in (['film', 'series'] as const)" :key="kind" class="fav-kind">
            <h3 class="fav-kind-label">Favorite {{ kind === 'film' ? 'Films' : 'Series' }}</h3>
            <div class="fav-cards" @dragstart.prevent>
              <div v-for="f in favChips(kind)" :key="f.id" class="fav-card" :class="{ dragging: dragKind === kind && dragId === f.id }" :data-fav-id="f.id" :title="f.title"
                @pointerdown="onFavPointerDown(kind, f, $event)" @pointermove="onFavPointerMove(kind, $event)" @pointerup="onFavPointerUp(kind, $event)" @pointercancel="onFavPointerUp(kind, $event)">
                <div class="fav-card-poster">
                  <img v-if="posterOf(f)" :src="posterOf(f)" alt="" draggable="false" />
                  <span v-else class="fav-card-fallback">{{ f.title }}</span>
                  <span class="fav-card-grip" aria-hidden="true">⋮⋮</span>
                  <button class="fav-x" :aria-label="`Remove ${f.title}`" @pointerdown.stop @click="setFavorite(f, false)">✕</button>
                </div>
                <span class="fav-card-t">{{ f.title }}</span>
              </div>
              <p v-if="!favChips(kind).length" class="cmsg">None yet — falls back to your top-rated.</p>
            </div>
            <label class="cfield"><span>Add a favorite {{ kind }} — search your titles</span><input v-model="favQ[kind]" type="text" :placeholder="kind === 'film' ? 'e.g. Persona' : 'e.g. Twin Peaks'" /></label>
            <div v-if="favHits(kind).length" class="tmdb-hits">
              <div v-for="f in favHits(kind)" :key="f.id" class="tmdb-hit">
                <img v-if="posterOf(f)" :src="posterOf(f)" alt="" /><div v-else class="noimg"></div>
                <div class="th-main"><div class="t">{{ f.title }}</div><div class="m">{{ f.year ?? '—' }}<template v-if="f.myRating != null"> · ★ {{ f.myRating }}</template></div></div>
                <button class="cbtn ghost" @click="setFavorite(f, true)">Add</button>
              </div>
            </div>
          </div>
        </template>
      </section>

      <!-- ── Titles ── -->
      <section class="cadmin-titles">
        <div class="cadmin-titles-head">
          <h2>Titles ({{ titles.length }})</h2>
          <p class="cadmin-note">Your cinema page as visitors see it. Tap the <b class="hl">pencil</b> to edit. Favorites are marked with a <span style="color:var(--c-red)">♥</span>. The <b class="hl">Reviews</b> filter shows titles that have a review.</p>
        </div>
        <CinemaArchive :admin="true" :films="titles" :diary-records="adminDiaryRecords" :diary-counts="adminDiaryCounts" @edit="openEditor" />
      </section>
    </div>

    <!-- ── edit modal ── -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="editing" class="cedit-overlay cinema-scope" dir="ltr" @click.self="editing = null">
          <div class="cedit-modal" role="dialog" aria-modal="true">
            <div class="cedit-head">
              <div><h3>{{ editing.title }}</h3><span class="lrow-sub">{{ [editing.year, editing.type === 'series' ? 'Series' : 'Film'].filter(Boolean).join(' · ') }}</span></div>
              <button class="cbtn ghost" @click="editing = null">Close ✕</button>
            </div>
            <div class="cedit-body">
              <label class="ccheck box"><input type="checkbox" :checked="editing.favorite" @change="setFavorite(editing, ($event.target as HTMLInputElement).checked)" /> ♥ Show in the favorites carousel</label>
              <div class="crow">
                <label class="cfield grow"><span>Title</span><input v-model="editing.title" type="text" /></label>
                <label class="cfield sm"><span>Year</span><input v-model.number="editing.year" type="number" /></label>
                <label class="cfield sm"><span>Type</span><select v-model="editing.type"><option value="film">Film</option><option value="series">Series</option></select></label>
              </div>
              <div class="crow">
                <label class="cfield"><span>{{ editing.type === 'series' ? 'Creator' : 'Director' }}</span><input v-model="editing.by" type="text" /></label>
                <label class="cfield sm"><span>Runtime</span><input v-model="editing.runtime" type="text" /></label>
                <label class="cfield sm"><span>My rating</span><input v-model.number="editing.myRating" type="number" min="0" max="10" /></label>
                <label class="cfield sm"><span>IMDb</span><input v-model.number="editing.imdb" type="number" step="0.1" /></label>
                <label class="cfield sm"><span>IMDb id</span><input v-model="editing.imdbId" type="text" placeholder="tt…" /></label>
              </div>
              <label class="cfield"><span>Poster URL (from TMDB)</span><input v-model="editing.poster" type="text" /></label>

              <!-- watch log -->
              <div class="cedit-box">
                <template v-if="editing.type === 'series'">
                  <div class="cbox-head"><b class="hl">Watched — {{ editing.log?.length ?? 0 }} episode plays</b><span class="cmsg">synced from Trakt</span></div>
                  <div class="schips"><span v-for="s in seasonSummary(editing)" :key="s.key" class="schip">{{ s.label }} · {{ s.count }}</span><span v-if="!(editing.log?.length)" class="cmsg">No episodes yet.</span></div>
                </template>
                <template v-else>
                  <div class="cbox-head"><b class="hl">Watched — {{ editing.log?.length ?? 0 }} {{ (editing.log?.length ?? 0) === 1 ? 'time' : 'times' }}</b><button class="cbtn ghost tiny" @click="addWatch(editing)">+ Add watch</button></div>
                  <div v-for="w in (editing.log ?? [])" :key="w.id ?? w.watched" class="watch-row">
                    <label class="cfield sm"><span>Date</span><input v-model="w.watched" type="date" /></label>
                    <button class="cbtn danger tiny" @click="removeWatch(editing, w)">Remove</button>
                  </div>
                </template>
              </div>

              <!-- dated notes / reviews -->
              <div class="cedit-box">
                <div class="cbox-head"><b class="hl">Notes &amp; reviews</b><span class="cmsg">public notes show on the site as reviews · each has a date</span></div>
                <div v-for="rv in (editing.reviews ?? [])" :key="rv.id" class="note-row" :class="{ priv: rv.private }">
                  <div class="nr-top"><span class="tr-date">{{ rv.reviewed || '—' }} · {{ rv.private ? 'PRIVATE' : 'PUBLIC' }}</span><button class="cbtn danger tiny" @click="deleteReview(rv)">Remove</button></div>
                  <p class="tr-text" dir="auto">{{ rv.text }}</p>
                </div>
                <div class="add-note">
                  <div class="crow">
                    <label class="cfield sm"><span>Date</span><input v-model="newNote.reviewed" type="date" /></label>
                    <label class="ccheck"><input v-model="newNote.private" type="checkbox" /> Private (only you)</label>
                  </div>
                  <label class="cfield"><span>{{ newNote.private ? 'Private note' : 'Public note (review)' }}</span><textarea v-model="newNote.text" rows="3"></textarea></label>
                  <button class="cbtn ghost" :disabled="!newNote.text.trim()" @click="addNote(editing)">+ Add {{ newNote.private ? 'private note' : 'review' }}</button>
                </div>
              </div>

              <div class="crow">
                <button class="cbtn" @click="saveTitle(editing)">Save</button>
                <button class="cbtn danger" @click="removeTitle(editing)">Delete title</button>
                <span v-if="msg" class="cmsg" :class="{ err: isErr }">{{ msg }}</span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Admin — Cinema', robots: 'noindex' })

const { data: adminTitles, refresh } = await useFetch<any[]>('/api/admin/titles')
const { data: content, refresh: refreshContent } = await useFetch<any>('/api/cinema/content')
const { data: traktStatus, refresh: refreshTrakt } = await useFetch<any>('/api/admin/trakt-status')

const titles = ref<any[]>([])
const favOrder = ref<{ film: number[]; series: number[] }>({ film: [], series: [] })
watchEffect(() => { if (adminTitles.value) { titles.value = JSON.parse(JSON.stringify(adminTitles.value)); rebuildFavOrder() } })
const trakt = computed(() => traktStatus.value ?? { hasKeys: false, connected: false })

const msg = ref(''); const isErr = ref(false)
const syncing = ref(false); const syncMsg = ref(''); const syncErr = ref(false); const processing = ref(false)
const refreshing = ref(false); const refreshMsg = ref('Refreshing…')

const autosyncPaused = ref(false)
watchEffect(() => { autosyncPaused.value = content.value?.autosync?.paused === true })
async function setAutosyncPaused(paused: boolean) { autosyncPaused.value = paused; await $fetch('/api/admin/settings', { method: 'PUT', body: { key: 'autosync', value: { paused } } }) }

function posterOf(f: any): string | null { return f.poster || f.posterLocal || null }

const adminDiaryRecords = computed(() => {
  const rows: any[] = []
  for (const t of titles.value) for (const w of (t.log ?? [])) rows.push({ titleId: t.id, watched: w.watched, season: w.season, episode: w.episode })
  return rows.sort((a, b) => String(b.watched).localeCompare(String(a.watched)))
})
const adminDiaryCounts = computed(() => {
  const byId = new Map(titles.value.map((t) => [t.id, t]))
  let film = 0, series = 0
  for (const r of adminDiaryRecords.value) { const t = byId.get(r.titleId); if (t?.type === 'film') film++; else if (t?.type === 'series') series++ }
  return { all: adminDiaryRecords.value.length, film, series }
})

async function reload() { await refresh(); await refreshContent(); titles.value = JSON.parse(JSON.stringify(adminTitles.value ?? [])); rebuildFavOrder() }

// ── sources ──
async function sync() {
  syncing.value = true; syncMsg.value = ''
  try { const r = await $fetch<any>('/api/admin/sync', { method: 'POST' }); syncErr.value = false; syncMsg.value = `Imported ${r.imported}, updated ${r.updated}, ${r.reviews} reviews — fetching details…`; await reload() }
  catch (e: any) { syncErr.value = true; syncMsg.value = e?.statusMessage ?? 'Sync failed' } finally { syncing.value = false }
}
async function processNow() {
  processing.value = true; syncErr.value = false
  try { await $fetch('/api/admin/process', { method: 'POST' }); syncMsg.value = 'Fetching missing data in the background — refresh in a minute' }
  catch (e: any) { syncErr.value = true; syncMsg.value = e?.statusMessage ?? 'Failed' } finally { processing.value = false }
}
async function refreshPosters() {
  refreshing.value = true; syncErr.value = false; let after = 0, total = 0
  try {
    for (let i = 0; i < 40; i++) { const r = await $fetch<any>('/api/admin/tmdb-refresh', { method: 'POST', body: { after } }); if (r.error) { syncErr.value = true; syncMsg.value = r.error; break }; total += r.refreshed; refreshMsg.value = `Refreshing… ${total}`; after = r.cursor; if (r.done) break }
    if (!syncErr.value) syncMsg.value = `Refreshed ${total} posters from TMDB`; await reload()
  } catch (e: any) { syncErr.value = true; syncMsg.value = e?.statusMessage ?? 'Refresh failed' } finally { refreshing.value = false; refreshMsg.value = 'Refreshing…' }
}
async function importDiary(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  syncMsg.value = 'Importing diary…'; syncErr.value = false
  try { const fd = new FormData(); fd.append('file', f); const r = await $fetch<any>('/api/admin/import-csv', { method: 'POST', body: fd }); syncMsg.value = `Diary: ${r.imported} new, ${r.records} watches — details fetching automatically`; await reload() }
  catch (er: any) { syncErr.value = true; syncMsg.value = er?.statusMessage ?? 'Import failed' }
}
async function importReviews(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  syncMsg.value = 'Importing reviews…'; syncErr.value = false
  try { const fd = new FormData(); fd.append('file', f); const r = await $fetch<any>('/api/admin/import-reviews', { method: 'POST', body: fd }); syncMsg.value = `Reviews: ${r.added} attached, ${r.nomatch} not-yet-in-diary, ${r.skipped} skipped`; await reload() }
  catch (er: any) { syncErr.value = true; syncMsg.value = er?.statusMessage ?? 'Import failed' }
}

// ── add title (TMDB) ──
const q = ref(''); const hits = ref<any[]>([]); const draft = ref<any>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearch() {
  draft.value = null
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (q.value.trim().length < 2) { hits.value = []; return }
    try { hits.value = await $fetch<any[]>('/api/admin/tmdb-search', { params: { q: q.value } }) } catch { hits.value = [] }
  }, 350)
}
async function pick(h: any) {
  const d = await $fetch<any>('/api/admin/tmdb-details', { params: { id: h.tmdbId, type: h.type } })
  draft.value = { ...d, myRating: null, watched: new Date().toISOString().slice(0, 10) }
  hits.value = []
}
async function add() {
  await $fetch('/api/admin/titles', { method: 'POST', body: draft.value })
  draft.value = null; q.value = ''; await reload(); syncMsg.value = 'Added ✓ — details fetching automatically'
}

// ── favorites reorder ──
const favQ = ref<{ film: string; series: string }>({ film: '', series: '' })
const favOpen = ref(false)
const dragKind = ref<'film' | 'series' | null>(null); const dragId = ref<number | null>(null); let dragMoved = false
function rebuildFavOrder() {
  for (const kind of ['film', 'series'] as const) favOrder.value[kind] = titles.value.filter((f) => f.favorite && f.type === kind).sort((a, b) => (a.favSort || 0) - (b.favSort || 0)).map((f) => f.id)
}
function favChips(kind: 'film' | 'series') { return favOrder.value[kind].map((id) => titles.value.find((t) => t.id === id)).filter(Boolean) }
function favHits(kind: 'film' | 'series') {
  const s = favQ.value[kind].trim().toLowerCase(); if (s.length < 2) return []
  return titles.value.filter((f) => f.type === kind && !f.favorite && `${f.title} ${f.by} ${f.year ?? ''}`.toLowerCase().includes(s)).slice(0, 6)
}
async function setFavorite(f: any, on: boolean) {
  f.favorite = on; favQ.value[f.type as 'film' | 'series'] = ''
  await $fetch('/api/admin/fav-toggle', { method: 'POST', body: { id: f.id, on } })
  const t = titles.value.find((x) => x.id === f.id); if (t) t.favorite = on
  rebuildFavOrder(); if (on && !favOrder.value[f.type].includes(f.id)) favOrder.value[f.type].push(f.id)
  msg.value = on ? `“${f.title}” added to favorites ✓` : `“${f.title}” removed`
}
function onFavPointerDown(kind: 'film' | 'series', f: any, ev: PointerEvent) { dragKind.value = kind; dragId.value = f.id; dragMoved = false; (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId) }
function onFavPointerMove(kind: 'film' | 'series', ev: PointerEvent) {
  if (dragKind.value !== kind || dragId.value == null) return
  ev.preventDefault()
  const card = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-fav-id]') as HTMLElement | null
  if (!card) return
  const over = Number(card.dataset.favId); if (!over || over === dragId.value) return
  const arr = favOrder.value[kind]; const from = arr.indexOf(dragId.value); const to = arr.indexOf(over)
  if (from < 0 || to < 0) return
  arr.splice(to, 0, arr.splice(from, 1)[0]); dragMoved = true
}
async function onFavPointerUp(kind: 'film' | 'series', ev: PointerEvent) {
  if (dragKind.value !== kind || dragId.value == null) return
  ;(ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId)
  dragKind.value = null; dragId.value = null; if (!dragMoved) return
  const arr = favOrder.value[kind]; arr.forEach((id, idx) => { const t = titles.value.find((x) => x.id === id); if (t) t.favSort = idx + 1 })
  await $fetch('/api/admin/fav-order', { method: 'POST', body: { ids: arr } })
}

// ── edit modal ──
const editing = ref<any>(null)
const newNote = ref({ reviewed: '', text: '', private: false })
function openEditor(row: any) { editing.value = titles.value.find((t) => t.id === row.id) ?? row; newNote.value = { reviewed: new Date().toISOString().slice(0, 10), text: '', private: false }; msg.value = '' }
function addWatch(t: any) { if (!Array.isArray(t.log)) t.log = []; t.log.unshift({ watched: new Date().toISOString().slice(0, 10) }) }
function removeWatch(t: any, w: any) { const i = t.log.indexOf(w); if (i >= 0) t.log.splice(i, 1) }
function seasonSummary(t: any) {
  const map = new Map<number | 'x', number>()
  for (const w of (t.log ?? [])) { const k = w.season == null ? 'x' : Number(w.season); map.set(k, (map.get(k) ?? 0) + 1) }
  return [...map.entries()].sort((a, b) => (a[0] === 'x' ? 9999 : a[0]) - (b[0] === 'x' ? 9999 : b[0])).map(([s, count]) => ({ key: String(s), label: s === 'x' ? 'Other' : `S${s}`, count }))
}
async function addNote(t: any) {
  if (!newNote.value.text.trim()) return
  await $fetch('/api/admin/reviews', { method: 'POST', body: { titleId: t.id, reviewed: newNote.value.reviewed, text: newNote.value.text, private: newNote.value.private } })
  if (!Array.isArray(t.reviews)) t.reviews = []
  t.reviews.unshift({ id: Date.now(), reviewed: newNote.value.reviewed, text: newNote.value.text.trim(), private: newNote.value.private })
  newNote.value = { reviewed: new Date().toISOString().slice(0, 10), text: '', private: false }
}
async function deleteReview(rv: any) {
  if (!confirm('Remove this note?')) return
  await $fetch(`/api/admin/reviews/${rv.id}`, { method: 'DELETE' })
  if (editing.value) editing.value.reviews = editing.value.reviews.filter((r: any) => r.id !== rv.id)
}
async function saveTitle(t: any) {
  try { const body = t.type === 'series' ? { ...t, log: undefined } : t; await $fetch(`/api/admin/titles/${t.id}`, { method: 'PUT', body }); isErr.value = false; msg.value = `Saved “${t.title}” ✓` }
  catch (e: any) { isErr.value = true; msg.value = e?.statusMessage ?? 'Failed' }
}
async function removeTitle(t: any) {
  if (!confirm(`Delete “${t.title}”?`)) return
  await $fetch(`/api/admin/titles/${t.id}`, { method: 'DELETE' }); editing.value = null; await reload(); msg.value = 'Deleted'
}

// ── Trakt ──
const traktCode = ref<any>(null); const traktSyncing = ref(false); const traktMsg = ref(''); const traktErr = ref(false)
let traktTimer: ReturnType<typeof setInterval> | null = null
async function traktConnect() {
  traktErr.value = false; traktMsg.value = ''
  try {
    traktCode.value = await $fetch<any>('/api/admin/trakt-connect', { method: 'POST' })
    traktTimer = setInterval(async () => {
      try { const r = await $fetch<any>('/api/admin/trakt-poll', { method: 'POST' }); if (r.connected) { if (traktTimer) clearInterval(traktTimer); traktCode.value = null; await refreshTrakt(); traktMsg.value = 'Connected ✓ — now run the sync' } } catch { /* keep polling */ }
    }, (traktCode.value?.interval ?? 5) * 1000)
  } catch (e: any) { traktErr.value = true; traktMsg.value = e?.statusMessage ?? 'Could not start Trakt connect' }
}
onBeforeUnmount(() => { if (traktTimer) clearInterval(traktTimer) })
async function traktSync() {
  traktSyncing.value = true; traktErr.value = false; traktMsg.value = ''
  try { const r = await $fetch<any>('/api/admin/trakt-sync', { method: 'POST' }); traktMsg.value = `Trakt: ${r.records} episodes, ${r.shows} new series, ${r.ratings} ratings`; await reload() }
  catch (e: any) { traktErr.value = true; traktMsg.value = e?.statusMessage ?? 'Trakt sync failed' } finally { traktSyncing.value = false }
}
</script>

<style scoped>
.admin-body { max-width: 74rem; margin: 0 auto; padding: 1.5rem clamp(1rem, 4vw, 2rem) 4rem; display: grid; gap: 1.6rem; }
.cadmin-card { border: 1px solid var(--c-line); background: rgba(20, 14, 14, 0.5); border-radius: 8px; padding: 1.3rem; display: grid; gap: 0.9rem; }
.cadmin-card h2, .cadmin-titles-head h2 { font-family: var(--c-display); font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-accent); margin: 0; }
.cadmin-note { margin: 0; color: var(--c-ink-dim); font-size: 0.95rem; line-height: 1.6; font-family: var(--c-body); }
.cadmin-note .hl, .hl { color: var(--c-accent); }
.cadmin-note code { font-family: ui-monospace, monospace; font-size: 0.85em; color: var(--c-ink); }
.crow { display: flex; gap: 0.7rem; flex-wrap: wrap; align-items: flex-end; }
.trakt-row { border-top: 1px solid var(--c-line-soft); padding-top: 0.9rem; align-items: center; }
.cfield { display: grid; gap: 0.35rem; flex: 1 1 12rem; }
.cfield.grow { flex: 2 1 14rem; } .cfield.sm { flex: 0 1 6.5rem; }
.cfield.gold > span { color: var(--c-accent); }
.cfield > span { font-family: var(--c-label); font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-mute); }
.cfield input, .cfield select, .cfield textarea { background: #0b0707; border: 1px solid var(--c-line); color: var(--c-ink); font-family: var(--c-body); font-size: 0.95rem; padding: 0.55rem 0.7rem; outline: none; width: 100%; }
.cfield textarea { resize: vertical; line-height: 1.6; }
.cfield input:focus, .cfield select:focus, .cfield textarea:focus { border-color: var(--c-accent-soft); }
.cbtn { font-family: var(--c-label); font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 0.6rem 1rem; border: 1px solid var(--c-accent-soft); background: rgba(205,191,158,0.08); color: var(--c-ink); cursor: pointer; border-radius: 5px; transition: background 0.3s var(--c-ease); }
.cbtn:hover { background: rgba(205,191,158,0.16); }
.cbtn.ghost { border-color: var(--c-line); background: none; color: var(--c-ink-dim); }
.cbtn.danger { border-color: rgba(184,28,28,0.5); color: var(--c-red); background: none; }
.cbtn.tiny { padding: 0.3rem 0.55rem; font-size: 0.56rem; }
.cbtn:disabled { opacity: 0.5; cursor: default; }
.ccheck { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--c-ink-dim); font-family: var(--c-body); font-size: 0.95rem; cursor: pointer; }
.ccheck.box { border: 1px solid var(--c-line); border-radius: 6px; padding: 0.55rem 0.7rem; background: var(--c-bg2); }
.cmsg { font-family: var(--c-label); font-size: 0.62rem; letter-spacing: 0.06em; color: var(--c-ink-dim); }
.cmsg.err { color: var(--c-red); } .cmsg.ok { color: var(--c-accent); }
.cadmin-titles-head { display: grid; gap: 0.4rem; margin-bottom: 0.3rem; }

/* tmdb hits */
.tmdb-hits { display: grid; gap: 0.3rem; }
.tmdb-hit { display: flex; align-items: center; gap: 0.7rem; border: 1px solid var(--c-line-soft); border-radius: 6px; padding: 0.4rem; }
.tmdb-hit img { width: 2.4rem; aspect-ratio: 2/3; object-fit: cover; border-radius: 3px; }
.tmdb-hit .noimg { width: 2.4rem; aspect-ratio: 2/3; background: var(--c-bg2); border-radius: 3px; }
.tmdb-hit .th-main { flex: 1; min-width: 0; }
.tmdb-hit .t { color: var(--c-ink); font-family: var(--c-body); font-size: 1rem; }
.tmdb-hit .m { color: var(--c-mute); font-family: var(--c-label); font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; }
.draft { display: grid; gap: 0.7rem; border-top: 1px solid var(--c-line-soft); padding-top: 0.8rem; }

/* favorites */
.fav-head { display: flex; align-items: center; gap: 0.7rem; width: 100%; padding: 0; background: none; border: none; cursor: pointer; text-align: left; }
.fav-head-title { font-family: var(--c-display); font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-accent); }
.fav-head-count { font-family: var(--c-label); font-size: 0.72rem; color: var(--c-ink-dim); }
.fav-head-chev { margin-left: auto; color: var(--c-accent-soft); font-size: 0.85rem; transition: transform 0.25s var(--c-ease); }
.fav-head-chev.open { transform: rotate(90deg); }
.fav-kind { display: grid; gap: 0.6rem; }
.fav-kind-label { margin: 0.4rem 0 0; font-family: var(--c-label); font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-accent); }
.fav-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)); gap: 0.85rem; }
@media (min-width: 560px) { .fav-cards { grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr)); } }
.fav-card { position: relative; display: grid; gap: 0.35rem; cursor: grab; touch-action: none; user-select: none; transition: transform 0.2s ease, opacity 0.2s ease; }
.fav-card.dragging { opacity: 0.9; transform: scale(1.06); z-index: 2; }
.fav-card-poster { position: relative; aspect-ratio: 2/3; overflow: hidden; border-radius: 5px; border: 1px solid var(--c-line); background: var(--c-bg2); box-shadow: 0 10px 22px rgba(0,0,0,0.45); }
.fav-card.dragging .fav-card-poster { border-color: var(--c-accent-soft); box-shadow: 0 16px 30px rgba(0,0,0,0.6), 0 0 18px var(--c-accent-glow); }
.fav-card-poster img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.fav-card-grip { position: absolute; left: 0.3rem; bottom: 0.28rem; color: var(--c-accent-soft); font-size: 0.72rem; letter-spacing: -2px; line-height: 1; text-shadow: 0 1px 3px rgba(0,0,0,0.9); pointer-events: none; }
.fav-card-t { font-size: 0.72rem; color: var(--c-ink-dim); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fav-x { position: absolute; top: 0.25rem; right: 0.25rem; display: grid; place-items: center; width: 1.5rem; height: 1.5rem; padding: 0; border: 1px solid var(--c-line); border-radius: 999px; background: rgba(8,5,5,0.85); color: var(--c-red); cursor: pointer; font-size: 0.8rem; line-height: 1; }

/* in admin there's no site nav — dock the deck at the top and match the admin bg */
.admin-body :deep(.archive-controls) { top: 0; background: linear-gradient(var(--a-bg, #0c0a0a) 82%, rgba(12,10,10,0.9) 92%, transparent); }

.cedit-overlay { position: fixed; inset: 0; z-index: 200; display: grid; place-items: start center; padding: 3rem 1rem 2rem; background: rgba(0,0,0,0.7); backdrop-filter: blur(3px); overflow-y: auto; }
.cedit-modal { width: 100%; max-width: 42rem; background: var(--c-bg); border: 1px solid var(--c-line); border-radius: 10px; padding: 1.1rem 1.25rem 1.4rem; box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
.cedit-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 0.9rem; margin-bottom: 0.6rem; border-bottom: 1px solid var(--c-line); }
.cedit-head h3 { margin: 0; font-family: var(--c-display); font-size: 1.1rem; color: var(--c-ink); }
.cedit-body { display: grid; gap: 0.75rem; }
.cedit-box { display: grid; gap: 0.55rem; border: 1px solid var(--c-line); border-radius: 6px; padding: 0.75rem; }
.cbox-head { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.schips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.schip { font-family: var(--c-label); font-size: 0.62rem; letter-spacing: 0.04em; color: var(--c-ink-dim); border: 1px solid var(--c-line); border-radius: 5px; padding: 0.2rem 0.5rem; background: var(--c-bg2); white-space: nowrap; }
.watch-row { display: flex; align-items: flex-end; gap: 0.6rem; border-top: 1px solid var(--c-line-soft); padding-top: 0.5rem; }
.note-row { border-top: 1px solid var(--c-line-soft); padding-top: 0.5rem; }
.note-row.priv { opacity: 0.85; }
.nr-top { display: flex; align-items: center; justify-content: space-between; }
.note-row .tr-text { font-family: 'Cormorant Garamond', 'ThmanyahSerifDisplay', serif; font-size: 1.05rem; line-height: 1.6; color: var(--c-ink-dim); white-space: pre-line; margin: 0.2rem 0 0; }
.add-note { display: grid; gap: 0.5rem; border-top: 1px dashed var(--c-line); padding-top: 0.6rem; margin-top: 0.3rem; }
</style>

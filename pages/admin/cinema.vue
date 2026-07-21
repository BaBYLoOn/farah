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
          auto-syncs every 6h, latest ~50; full history via the <code>diary.csv</code> upload).
          <b>Reviews</b> are pulled from the same feed and attached to films already in the diary; upload
          <code>reviews.csv</code> for the full backlog. <b>Series</b> come from Trakt.
        </p>
        <div class="crow">
          <button class="cbtn" :disabled="syncing" @click="sync">{{ syncing ? 'Syncing…' : 'Sync Letterboxd' }}</button>
          <button class="cbtn ghost" :disabled="processing" @click="processNow">{{ processing ? 'Working…' : 'Fetch missing data' }}</button>
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
            <span class="cmsg err">Trakt keys missing — create an app at trakt.tv/oauth/applications and set NUXT_TRAKT_CLIENT_ID + NUXT_TRAKT_CLIENT_SECRET in .env, then restart.</span>
          </template>
          <template v-else-if="!trakt.connected">
            <button class="cbtn" :disabled="!!traktCode" @click="traktConnect">Connect Trakt</button>
            <span v-if="traktCode" class="cmsg">Go to <b class="hl">{{ traktCode.url }}</b> and enter <b class="hl">{{ traktCode.userCode }}</b> — waiting…</span>
          </template>
          <template v-else>
            <button class="cbtn" :disabled="traktSyncing" @click="traktSync">{{ traktSyncing ? 'Syncing…' : 'Sync Trakt (episodes + ratings)' }}</button>
            <span class="cmsg ok">Trakt connected ✓</span>
          </template>
          <span v-if="traktMsg" class="cmsg" :class="{ err: traktErr }">{{ traktMsg }}</span>
        </div>
      </section>

      <!-- ── Titles ── -->
      <section class="cadmin-titles">
        <div class="cadmin-titles-head">
          <h2>Titles ({{ titles.length }})</h2>
          <p class="cadmin-note">Your cinema page as visitors see it. Tap the <b class="hl">pencil</b> on any poster to edit. Favorites are marked with a <span style="color:var(--c-red)">♥</span>. The <b class="hl">Reviews</b> filter shows titles that have a review.</p>
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
              </div>
              <label class="cfield"><span>Poster URL</span><input v-model="editing.poster" type="text" /></label>

              <div v-if="editing.reviews && editing.reviews.length" class="cedit-reviews">
                <b class="hl">Reviews ({{ editing.reviews.length }})</b>
                <div v-for="rv in editing.reviews" :key="rv.id" class="cedit-review">
                  <div class="cr-top"><span class="tr-date">{{ rv.reviewed }}</span><button class="cbtn tiny danger" @click="deleteReview(rv)">Remove</button></div>
                  <p class="tr-text">{{ rv.text }}</p>
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
watchEffect(() => { if (adminTitles.value) titles.value = JSON.parse(JSON.stringify(adminTitles.value)) })
const trakt = computed(() => traktStatus.value ?? { hasKeys: false, connected: false })

const msg = ref(''); const isErr = ref(false)
const syncing = ref(false); const syncMsg = ref(''); const syncErr = ref(false); const processing = ref(false)

const autosyncPaused = ref(false)
watchEffect(() => { autosyncPaused.value = content.value?.autosync?.paused === true })
async function setAutosyncPaused(paused: boolean) {
  autosyncPaused.value = paused
  await $fetch('/api/admin/settings', { method: 'PUT', body: { key: 'autosync', value: { paused } } })
}

// diary records for the shared archive
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

// edit modal
const editing = ref<any>(null)
function openEditor(row: any) { editing.value = titles.value.find((t) => t.id === row.id) ?? row; msg.value = '' }

async function reload() { await refresh(); await refreshContent(); titles.value = JSON.parse(JSON.stringify(adminTitles.value ?? [])) }

async function sync() {
  syncing.value = true; syncMsg.value = ''
  try { const r = await $fetch<any>('/api/admin/sync', { method: 'POST' }); syncErr.value = false; syncMsg.value = `Imported ${r.imported}, updated ${r.updated}, ${r.reviews} reviews`; await reload() }
  catch (e: any) { syncErr.value = true; syncMsg.value = e?.statusMessage ?? 'Sync failed' }
  finally { syncing.value = false }
}
async function processNow() {
  processing.value = true; syncErr.value = false
  try { await $fetch('/api/admin/process', { method: 'POST' }); syncMsg.value = 'Fetching missing data in the background — refresh in a minute' }
  catch (e: any) { syncErr.value = true; syncMsg.value = e?.statusMessage ?? 'Failed' }
  finally { processing.value = false }
}
async function importDiary(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  syncMsg.value = 'Importing diary…'; syncErr.value = false
  try { const fd = new FormData(); fd.append('file', f); const r = await $fetch<any>('/api/admin/import-csv', { method: 'POST', body: fd }); syncMsg.value = `Diary: ${r.imported} new, ${r.records} watches — matching + details now run automatically`; await reload() }
  catch (er: any) { syncErr.value = true; syncMsg.value = er?.statusMessage ?? 'Import failed' }
}
async function importReviews(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
  syncMsg.value = 'Importing reviews…'; syncErr.value = false
  try { const fd = new FormData(); fd.append('file', f); const r = await $fetch<any>('/api/admin/import-reviews', { method: 'POST', body: fd }); syncMsg.value = `Reviews: ${r.added} attached, ${r.nomatch} not-yet-in-diary, ${r.skipped} skipped`; await reload() }
  catch (er: any) { syncErr.value = true; syncMsg.value = er?.statusMessage ?? 'Import failed' }
}

async function setFavorite(f: any, on: boolean) {
  f.favorite = on
  await $fetch('/api/admin/fav-toggle', { method: 'POST', body: { id: f.id, on } })
  const t = titles.value.find((x) => x.id === f.id); if (t) t.favorite = on
  msg.value = on ? `“${f.title}” added to favorites ✓` : `“${f.title}” removed`
}
async function deleteReview(rv: any) {
  if (!confirm('Remove this review?')) return
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

// Trakt
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
  catch (e: any) { traktErr.value = true; traktMsg.value = e?.statusMessage ?? 'Trakt sync failed' }
  finally { traktSyncing.value = false }
}
</script>

<style scoped>
.admin-body { max-width: 74rem; margin: 0 auto; padding: 1.5rem clamp(1rem, 4vw, 2rem) 4rem; display: grid; gap: 1.6rem; }
.cadmin-card { border: 1px solid var(--c-line); background: rgba(14, 9, 9, 0.5); border-radius: 8px; padding: 1.3rem; display: grid; gap: 0.9rem; }
.cadmin-card h2, .cadmin-titles-head h2 { font-family: var(--c-display); font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-accent); margin: 0; }
.cadmin-note { margin: 0; color: var(--c-ink-dim); font-size: 0.95rem; line-height: 1.6; font-family: var(--c-body); }
.cadmin-note .hl, .hl { color: var(--c-accent); }
.cadmin-note code { font-family: ui-monospace, monospace; font-size: 0.85em; color: var(--c-ink); }
.crow { display: flex; gap: 0.7rem; flex-wrap: wrap; align-items: center; }
.trakt-row { border-top: 1px solid var(--c-line-soft); padding-top: 0.9rem; }
.cfield { display: grid; gap: 0.35rem; flex: 1 1 12rem; }
.cfield.grow { flex: 2 1 14rem; } .cfield.sm { flex: 0 1 6rem; }
.cfield > span { font-family: var(--c-label); font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-mute); }
.cfield input, .cfield select { background: #0b0707; border: 1px solid var(--c-line); color: var(--c-ink); font-family: var(--c-body); font-size: 0.95rem; padding: 0.55rem 0.7rem; outline: none; width: 100%; }
.cfield input:focus, .cfield select:focus { border-color: var(--c-accent-soft); }
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

.cedit-overlay { position: fixed; inset: 0; z-index: 200; display: grid; place-items: start center; padding: 3rem 1rem 2rem; background: rgba(0,0,0,0.7); backdrop-filter: blur(3px); overflow-y: auto; }
.cedit-modal { width: 100%; max-width: 40rem; background: var(--c-bg); border: 1px solid var(--c-line); border-radius: 10px; padding: 1.1rem 1.25rem 1.4rem; box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
.cedit-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 0.9rem; margin-bottom: 0.6rem; border-bottom: 1px solid var(--c-line); }
.cedit-head h3 { margin: 0; font-family: var(--c-display); font-size: 1.1rem; color: var(--c-ink); }
.cedit-body { display: grid; gap: 0.75rem; }
.cedit-reviews { display: grid; gap: 0.6rem; border: 1px solid var(--c-line); border-radius: 6px; padding: 0.75rem; }
.cedit-review { border-top: 1px solid var(--c-line-soft); padding-top: 0.5rem; }
.cedit-review:first-of-type { border-top: none; padding-top: 0; }
.cr-top { display: flex; align-items: center; justify-content: space-between; }
</style>

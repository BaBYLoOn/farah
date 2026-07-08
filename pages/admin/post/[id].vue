<template>
  <main class="admin admin-editor" dir="rtl">
    <header class="admin-topbar admin-topbar--sticky">
      <div class="admin-topbar-inner">
        <div class="admin-brand">
          <NuxtLink to="/admin" class="admin-btn admin-btn--ghost">→ رجوع</NuxtLink>
          <span class="admin-brand-name">{{ isNew ? 'مقال جديد' : 'تحرير' }}</span>
        </div>
        <div class="admin-topbar-actions">
          <span v-if="savedMsg" class="admin-saved">{{ savedMsg }}</span>
          <button
            v-if="!isNew"
            class="admin-btn admin-btn--icon admin-btn--danger"
            title="حذف"
            :disabled="saving"
            @click="remove"
          >🗑</button>
          <button class="admin-btn admin-btn--ghost" :class="{ 'is-active': showPreview }" @click="showPreview = !showPreview">
            {{ showPreview ? 'إخفاء المعاينة' : 'معاينة' }}
          </button>
          <button class="admin-btn admin-btn--ghost" :disabled="saving" @click="save('draft')">حفظ كمسودة</button>
          <button class="admin-btn admin-btn--primary" :disabled="saving" @click="save('published')">
            {{ saving ? '…' : 'نشر' }}
          </button>
        </div>
      </div>
    </header>

    <div class="admin-editor-grid" :class="{ 'has-preview': showPreview }">
      <!-- ── form ── -->
      <div class="admin-editor-form">
        <p v-if="error" class="admin-login-error admin-form-error">{{ error }}</p>

        <label class="admin-field">
          <span class="admin-field-label">النوع</span>
          <div class="be-inline-controls">
            <button type="button" class="admin-btn admin-btn--sm" :class="{ 'admin-btn--primary': form.kind === 'essay' }" @click="form.kind = 'essay'">مقالة</button>
            <button type="button" class="admin-btn admin-btn--sm" :class="{ 'admin-btn--primary': form.kind === 'weblog' }" @click="form.kind = 'weblog'">مدونة</button>
          </div>
        </label>

        <label class="admin-field">
          <span class="admin-field-label">العنوان</span>
          <input v-model="form.title" class="admin-input admin-input--title" placeholder="عنوان المقال">
        </label>

        <label class="admin-field">
          <span class="admin-field-label">المقتطف / الوصف</span>
          <textarea v-model="form.excerpt" class="admin-input admin-textarea" rows="3" placeholder="جملة أو جملتان تلخّصان المقال"></textarea>
        </label>

        <label class="admin-field">
          <span class="admin-field-label">التاريخ</span>
          <input :value="form.iso" type="date" class="admin-input admin-input--date" @input="onDate">
          <span v-if="form.date" class="admin-field-note">يظهر كـ: {{ form.date }}</span>
        </label>

        <label class="admin-field">
          <span class="admin-field-label">رابط دائم (Slug) — يُترك فارغًا للتوليد التلقائي</span>
          <input v-model="form.slug" class="admin-input admin-input--ltr" placeholder="auto" dir="ltr">
        </label>

        <div class="admin-field-row">
          <label class="admin-field">
            <span class="admin-field-label">المؤلفون (يُفصل بفاصلة)</span>
            <input v-model="authorsText" class="admin-input" placeholder="فَـرَح علي">
          </label>
          <label class="admin-field">
            <span class="admin-field-label">الوسوم (يُفصل بفاصلة)</span>
            <input v-model="tagsText" class="admin-input" placeholder="الفلسفة، ديكارت">
          </label>
        </div>

        <div class="admin-field">
          <span class="admin-field-label">صورة الغلاف</span>
          <AdminImageUploader v-model="form.image" label="رفع صورة الغلاف" :aspect="true" />
        </div>

        <div class="admin-field">
          <span class="admin-field-label">المتن</span>
          <AdminBlockEditor v-model="form.body" />
          <details class="admin-debug">
            <summary>بنية المتن (للتشخيص)</summary>
            <pre>{{ bodyStructure }}</pre>
          </details>
        </div>

        <div class="admin-field">
          <span class="admin-field-label">المصادر</span>
          <div v-for="(src, i) in form.sources" :key="i" class="admin-source-row">
            <input v-model="src.text" class="admin-input" placeholder="اسم المصدر / المرجع">
            <input v-model="src.url" class="admin-input admin-input--ltr" placeholder="رابط (اختياري)" dir="ltr">
            <button type="button" class="admin-btn admin-btn--sm admin-btn--danger" @click="form.sources.splice(i, 1)">✕</button>
          </div>
          <button type="button" class="admin-btn admin-btn--sm" @click="form.sources.push({ text: '', url: '' })">+ مصدر</button>
        </div>
      </div>

      <!-- ── live preview ── -->
      <aside v-if="showPreview" class="admin-editor-preview">
        <div class="admin-preview-surface article" lang="ar" dir="rtl">
          <header class="article-header">
            <p class="article-kicker"><span class="article-kicker-label">{{ form.kind === 'essay' ? 'مقالة' : 'مدونة' }}</span></p>
            <h1 class="article-title">{{ form.title || 'العنوان' }}</h1>
            <div class="article-rule-wrap"><CrimsonRule max-width="320px"><BlackOrchid :size="16" variant="divider" /></CrimsonRule></div>
            <p v-if="form.excerpt" class="article-lede"><em>{{ form.excerpt }}</em></p>
          </header>
          <figure v-if="form.image" class="article-hero">
            <div class="article-figure-frame">
              <img class="article-figure-image" :src="form.image" :alt="form.title">
              <div class="article-figure-veil" /><div class="article-figure-grain" />
            </div>
          </figure>
          <ArticleBody :blocks="form.body" />
        </div>
      </aside>
    </div>

    <!-- unsaved-changes guard -->
    <div v-if="leaveModal" class="admin-modal-overlay" @click.self="leaveStay">
      <div class="admin-modal" role="dialog" aria-modal="true">
        <h3 class="admin-modal-title">تغييرات غير محفوظة</h3>
        <p class="admin-modal-text">لديك تعديلات لم تُحفظ. هل تريدين المغادرة دون حفظ؟</p>
        <div class="admin-modal-actions">
          <button class="admin-btn admin-btn--primary" :disabled="saving" @click="leaveSaveDraft">حفظ كمسودة والخروج</button>
          <button class="admin-btn admin-btn--danger" @click="leaveDiscard">الخروج دون حفظ</button>
          <button class="admin-btn admin-btn--ghost" @click="leaveStay">إلغاء</button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import type { Post } from '~/server/utils/db'
import type { Block, Source } from '~/data/content'
definePageMeta({ layout: false, middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id as string)
const isNew = computed(() => id.value === 'new')

interface Form {
  kind: 'essay' | 'weblog'
  slug: string
  title: string
  excerpt: string
  date: string
  iso: string
  image: string
  authors: string[]
  tags: string[]
  sources: Source[]
  body: Block[]
  status: 'draft' | 'published'
}

const form = reactive<Form>({
  kind: (route.query.kind === 'weblog' ? 'weblog' : 'essay'),
  slug: '', title: '', excerpt: '', date: '', iso: '',
  image: '', authors: ['فَـرَح علي'], tags: [], sources: [], body: [], status: 'draft',
})

const authorsText = computed({
  get: () => form.authors.join('، '),
  set: (v: string) => { form.authors = v.split(/[،,]/).map(s => s.trim()).filter(Boolean) },
})
const tagsText = computed({
  get: () => form.tags.join('، '),
  set: (v: string) => { form.tags = v.split(/[،,]/).map(s => s.trim()).filter(Boolean) },
})

const showPreview = ref(false)
const saving = ref(false)
const error = ref('')
const savedMsg = ref('')

// Diagnostic: shows the live block structure so heading/quote/etc. are visible.
const bodyStructure = computed(() => (form.body || [])
  .map((b: any, i: number) => {
    const label = b.type === 'heading' ? `heading h${b.level ?? 2}` : b.type
    const txt = (b.text || b.html || b.src || '').toString().replace(/<[^>]+>/g, '').slice(0, 50)
    return `${i + 1}. [${label}] ${txt}`
  })
  .join('\n') || '(فارغ)')

// Calendar picker → ISO (for sorting/<time>) + auto Arabic display date.
const arDate = new Intl.DateTimeFormat('ar-EG-u-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' })
function onDate(e: Event) {
  const iso = (e.target as HTMLInputElement).value
  form.iso = iso
  form.date = iso ? arDate.format(new Date(iso + 'T00:00:00')) : ''
}

async function remove() {
  if (!confirm(`حذف «${form.title || 'هذا المقال'}»؟ لا يمكن التراجع.`)) return
  await $fetch(`/api/admin/posts/${id.value}`, { method: 'DELETE' })
  router.replace('/admin')
}

if (!isNew.value) {
  const { data } = await useFetch<Post>(`/api/admin/posts/${id.value}`)
  if (data.value) Object.assign(form, {
    kind: data.value.kind, slug: data.value.slug, title: data.value.title,
    excerpt: data.value.excerpt, date: data.value.date, iso: data.value.iso,
    image: data.value.image, authors: data.value.authors, tags: data.value.tags,
    sources: data.value.sources, body: data.value.body, status: data.value.status,
  })
}

useHead(() => ({ title: `${form.title || 'مقال جديد'} — لوحة التحكم` }))

async function save(status: 'draft' | 'published') {
  if (saving.value) return
  if (!form.title.trim()) { error.value = 'العنوان مطلوب'; return }
  saving.value = true
  error.value = ''
  savedMsg.value = ''
  const payload = { ...toRaw(form), status }
  try {
    if (isNew.value) {
      const created = await $fetch<Post>('/api/admin/posts', { method: 'POST', body: payload })
      Object.assign(form, { slug: created.slug, status: created.status })
      snapshot()                                  // mark clean before the redirect
      allowLeave = true
      await router.replace(`/admin/post/${created.id}`)
      allowLeave = false
      savedMsg.value = status === 'published' ? '✓ نُشر' : '✓ حُفظ'
    } else {
      const updated = await $fetch<Post>(`/api/admin/posts/${id.value}`, { method: 'PUT', body: payload })
      Object.assign(form, { slug: updated.slug, status: updated.status })
      snapshot()
      savedMsg.value = status === 'published' ? '✓ نُشر' : '✓ حُفظ'
    }
    setTimeout(() => { savedMsg.value = '' }, 2500)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'تعذّر الحفظ'
  } finally {
    saving.value = false
  }
  return !error.value
}

// ── Unsaved-changes guard ──────────────────────────────────────────
const serialize = () => JSON.stringify({
  kind: form.kind, slug: form.slug, title: form.title, excerpt: form.excerpt,
  date: form.date, iso: form.iso, image: form.image, authors: form.authors,
  tags: form.tags, sources: form.sources, body: form.body, status: form.status,
})
const savedSnapshot = ref('')
const snapshot = () => { savedSnapshot.value = serialize() }
const dirty = computed(() => savedSnapshot.value !== '' && serialize() !== savedSnapshot.value)

const leaveModal = ref(false)
const pendingPath = ref('')
let allowLeave = false

onBeforeRouteLeave((to) => {
  if (allowLeave || !dirty.value) return true
  pendingPath.value = to.fullPath
  leaveModal.value = true
  return false
})

async function leaveSaveDraft() {
  leaveModal.value = false
  const ok = await save('draft')
  if (!ok) return               // save failed — stay so the error is visible
  allowLeave = true
  await router.push(pendingPath.value)
}
function leaveDiscard() {
  allowLeave = true
  leaveModal.value = false
  router.push(pendingPath.value)
}
function leaveStay() { leaveModal.value = false; pendingPath.value = '' }

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) { e.preventDefault(); e.returnValue = '' }
}
onMounted(() => {
  snapshot()   // baseline once the (async-loaded) form is populated
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

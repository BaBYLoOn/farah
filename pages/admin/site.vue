<template>
  <main class="admin admin-editor" dir="rtl">
    <header class="admin-topbar admin-topbar--sticky">
      <div class="admin-topbar-inner">
        <div class="admin-brand">
          <NuxtLink to="/admin" class="admin-btn admin-btn--ghost">→ رجوع</NuxtLink>
          <span class="admin-brand-name">إعدادات الموقع</span>
        </div>
        <div class="admin-topbar-actions">
          <span v-if="savedMsg" class="admin-saved">{{ savedMsg }}</span>
          <button class="admin-btn admin-btn--primary" :disabled="saving" @click="save">{{ saving ? '…' : 'حفظ' }}</button>
        </div>
      </div>
    </header>

    <div class="admin-editor-grid">
      <div class="admin-editor-form" style="max-width:760px;margin:0 auto">
        <p v-if="error" class="admin-login-error admin-form-error">{{ error }}</p>

        <h2 class="admin-section-title admin-settings-h">الواجهة (Hero)</h2>
        <div class="admin-field-row">
          <label class="admin-field"><span class="admin-field-label">السطر العلوي</span><input v-model="form.hero.eyebrow" class="admin-input admin-input--ltr" dir="ltr"></label>
          <label class="admin-field"><span class="admin-field-label">الاسم</span><input v-model="form.hero.name" class="admin-input admin-input--ltr" dir="ltr"></label>
        </div>
        <label class="admin-field"><span class="admin-field-label">الشعار (tagline)</span><input v-model="form.hero.tagline" class="admin-input admin-input--ltr" dir="ltr"></label>
        <label class="admin-field"><span class="admin-field-label">الاقتباس</span><textarea v-model="form.hero.quote" class="admin-input admin-textarea" rows="2" dir="ltr"></textarea></label>
        <label class="admin-field"><span class="admin-field-label">الكلمة المميّزة داخل الاقتباس (بالأحمر)</span><input v-model="form.hero.quoteAccent" class="admin-input admin-input--ltr" dir="ltr"></label>

        <h2 class="admin-section-title admin-settings-h">قسم المقالات</h2>
        <div class="admin-field-row">
          <label class="admin-field"><span class="admin-field-label">السطر العلوي</span><input v-model="form.essays.eyebrow" class="admin-input admin-input--ltr" dir="ltr"></label>
          <label class="admin-field"><span class="admin-field-label">العنوان</span><input v-model="form.essays.title" class="admin-input admin-input--ltr" dir="ltr"></label>
        </div>
        <label class="admin-field"><span class="admin-field-label">الوصف</span><textarea v-model="form.essays.sub" class="admin-input admin-textarea" rows="2"></textarea></label>

        <h2 class="admin-section-title admin-settings-h">قسم المدونة</h2>
        <div class="admin-field-row">
          <label class="admin-field"><span class="admin-field-label">السطر العلوي</span><input v-model="form.weblog.eyebrow" class="admin-input admin-input--ltr" dir="ltr"></label>
          <label class="admin-field"><span class="admin-field-label">العنوان</span><input v-model="form.weblog.title" class="admin-input admin-input--ltr" dir="ltr"></label>
        </div>
        <label class="admin-field"><span class="admin-field-label">الوصف</span><textarea v-model="form.weblog.sub" class="admin-input admin-textarea" rows="2"></textarea></label>

        <h2 class="admin-section-title admin-settings-h">التذييل (Footer)</h2>
        <label class="admin-field"><span class="admin-field-label">الاسم</span><input v-model="form.footer.name" class="admin-input admin-input--ltr" dir="ltr"></label>

        <h2 class="admin-section-title admin-settings-h">الروابط والحسابات</h2>
        <p class="admin-hint">تظهر في الواجهة والتذييل. اختاري أيقونة جاهزة أو ارفعي أيقونتك الخاصة (SVG أو PNG).</p>

        <div v-for="(s, i) in form.socials" :key="i" class="admin-social-card">
          <div class="admin-social-icon-col">
            <div class="admin-social-preview">
              <img v-if="s.icon" :src="s.icon" alt="">
              <span v-else class="admin-social-preview-name">{{ s.key }}</span>
            </div>
            <select v-model="s.key" class="admin-input admin-input--sm" :disabled="!!s.icon">
              <option v-for="name in iconNames" :key="name" :value="name">{{ name }}</option>
            </select>
            <button type="button" class="admin-btn admin-btn--sm" :disabled="uploadingIdx === i" @click="pickIcon(i)">
              {{ uploadingIdx === i ? '…' : (s.icon ? 'استبدال الأيقونة' : 'رفع أيقونة') }}
            </button>
            <button v-if="s.icon" type="button" class="admin-btn admin-btn--sm admin-btn--danger" @click="s.icon = undefined">إزالة الأيقونة</button>
          </div>

          <div class="admin-social-fields">
            <input v-model="s.label" class="admin-input admin-input--sm" placeholder="الاسم (Instagram)">
            <input v-model="s.handle" class="admin-input admin-input--sm admin-input--ltr" placeholder="@handle" dir="ltr">
            <input v-model="s.href" class="admin-input admin-input--sm admin-input--ltr" placeholder="https://…" dir="ltr">
            <button type="button" class="admin-btn admin-btn--sm admin-btn--danger admin-social-remove" @click="form.socials.splice(i, 1)">حذف الرابط ✕</button>
          </div>
        </div>

        <p v-if="iconError" class="admin-login-error">{{ iconError }}</p>
        <button type="button" class="admin-btn admin-btn--sm" @click="form.socials.push({ key: 'link', label: '', handle: '', href: 'https://', icon: undefined })">+ رابط جديد</button>
        <input ref="iconInput" type="file" accept="image/*,.svg" hidden @change="onIconFile">
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ICON_NAMES, type SiteContent } from '~/data/site'
definePageMeta({ layout: false, middleware: 'admin' })
useHead({ title: 'إعدادات الموقع — لوحة التحكم' })

const iconNames = ICON_NAMES
const saving = ref(false)
const error = ref('')
const savedMsg = ref('')

const { data } = await useFetch<SiteContent>('/api/site')
const form = reactive<SiteContent>(JSON.parse(JSON.stringify(data.value)))

// ── custom social-icon upload ──
const iconInput = ref<HTMLInputElement>()
const uploadingIdx = ref<number | null>(null)
const iconError = ref('')
let pendingIdx = -1

function pickIcon(i: number) {
  pendingIdx = i
  iconError.value = ''
  iconInput.value?.click()
}
async function onIconFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || pendingIdx < 0) return
  uploadingIdx.value = pendingIdx
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await $fetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd })
    if (form.socials[pendingIdx]) form.socials[pendingIdx].icon = res.url
  } catch (err: any) {
    iconError.value = err?.data?.statusMessage || 'تعذّر رفع الأيقونة'
  } finally {
    uploadingIdx.value = null
    pendingIdx = -1
    if (iconInput.value) iconInput.value.value = ''
  }
}

async function save() {
  if (saving.value) return
  saving.value = true; error.value = ''; savedMsg.value = ''
  try {
    await $fetch('/api/admin/site', { method: 'PUT', body: toRaw(form) })
    savedMsg.value = '✓ حُفظ'
    await refreshNuxtData('site-content')
    setTimeout(() => { savedMsg.value = '' }, 2500)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'تعذّر الحفظ'
  } finally {
    saving.value = false
  }
}
</script>

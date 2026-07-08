<template>
  <main class="admin admin-login" dir="rtl">
    <form class="admin-card admin-login-card" @submit.prevent="submit">
      <div class="admin-login-orchid"><AdminMark :size="46" /></div>
      <h1 class="admin-login-title">لوحة التحكم</h1>
      <p class="admin-login-sub"><em>ادخلي كلمة المرور للمتابعة</em></p>

      <label class="admin-field">
        <span class="admin-field-label">كلمة المرور</span>
        <input
          v-model="password"
          type="password"
          class="admin-input"
          autocomplete="current-password"
          :disabled="loading"
          autofocus
        >
      </label>

      <p v-if="error" class="admin-login-error">{{ error }}</p>

      <button class="admin-btn admin-btn--primary admin-login-btn" type="submit" :disabled="loading">
        {{ loading ? '…' : 'دخول' }}
      </button>
    </form>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'لوحة التحكم — Farah' })

const { loggedIn, fetch: refreshSession } = useUserSession()
const route = useRoute()
const router = useRouter()

const password = ref('')
const loading = ref(false)
const error = ref('')

const redirect = computed(() => (route.query.redirect as string) || '/admin')

onMounted(() => { if (loggedIn.value) router.replace(redirect.value) })

async function submit() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { password: password.value } })
    await refreshSession()
    router.replace(redirect.value)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'تعذّر تسجيل الدخول'
  } finally {
    loading.value = false
  }
}
</script>

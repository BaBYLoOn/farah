<template>
  <main class="admin" dir="rtl">
    <header class="admin-topbar">
      <div class="admin-topbar-inner">
        <div class="admin-brand">
          <AdminMark :size="28" />
          <span class="admin-brand-name">لوحة التحكم</span>
        </div>
        <div class="admin-topbar-actions">
          <NuxtLink to="/admin/cinema" class="admin-btn admin-btn--ghost">السينما 🎬</NuxtLink>
          <NuxtLink to="/admin/site" class="admin-btn admin-btn--ghost">إعدادات الموقع</NuxtLink>
          <NuxtLink to="/" class="admin-btn admin-btn--ghost" target="_blank">عرض الموقع ↗</NuxtLink>
          <button class="admin-btn admin-btn--ghost" @click="logout">خروج</button>
        </div>
      </div>
    </header>

    <div class="admin-body">
      <section v-for="group in groups" :key="group.kind" class="admin-section">
        <div class="admin-section-head">
          <h2 class="admin-section-title">
            {{ group.label }}
            <span class="admin-section-count">{{ group.list.value.length }}</span>
          </h2>
          <NuxtLink :to="`/admin/post/new?kind=${group.kind}`" class="admin-btn admin-btn--primary">
            + {{ group.newLabel }}
          </NuxtLink>
        </div>

        <p class="admin-hint">اسحبي ﴾⠿﴿ لإعادة الترتيب — يظهر نفس الترتيب في الصفحة الرئيسية.</p>

        <p v-if="pending" class="admin-muted">…جارٍ التحميل</p>
        <p v-else-if="!group.list.value.length" class="admin-muted">لا يوجد بعد.</p>

        <draggable
          v-else
          v-model="group.list.value"
          item-key="id"
          handle=".admin-drag"
          :animation="180"
          class="admin-list"
          @end="onReorder(group.kind, group.list.value)"
        >
          <template #item="{ element: post }">
            <div class="admin-card-row">
              <button class="admin-drag" type="button" aria-label="إعادة الترتيب">⠿</button>

              <div class="admin-thumb">
                <img v-if="post.image" :src="post.image" :alt="post.title" loading="lazy">
                <span v-else class="admin-thumb-empty">—</span>
              </div>

              <div class="admin-row-main">
                <span class="admin-row-title">{{ post.title }}</span>
                <span class="admin-row-meta">
                  <span class="admin-badge" :class="post.status === 'draft' ? 'is-draft' : 'is-live'">
                    {{ post.status === 'draft' ? 'مسودة' : 'منشور' }}
                  </span>
                  <span class="admin-row-date">{{ post.date || post.iso }}</span>
                </span>
              </div>

              <div class="admin-row-actions">
                <NuxtLink :to="`/admin/post/${post.id}`" class="admin-btn admin-btn--action">تحرير</NuxtLink>
                <a
                  :href="`/${post.kind === 'essay' ? 'essays' : 'weblog'}/${post.slug}`"
                  target="_blank"
                  class="admin-btn admin-btn--action admin-btn--ghost"
                >عرض</a>
              </div>
            </div>
          </template>
        </draggable>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Post, PostKind } from '~/server/utils/db'
definePageMeta({ layout: false, middleware: 'admin' })
useHead({ title: 'لوحة التحكم — Farah' })

const { clear: clearSession } = useUserSession()
const router = useRouter()

const { data: posts, pending } = await useFetch<Post[]>('/api/admin/posts', { default: () => [] })

const essaysList = ref<Post[]>([])
const weblogList = ref<Post[]>([])
watchEffect(() => {
  essaysList.value = (posts.value || []).filter(p => p.kind === 'essay')
  weblogList.value = (posts.value || []).filter(p => p.kind === 'weblog')
})

const groups = computed(() => [
  { kind: 'essay' as PostKind, label: 'المقالات', newLabel: 'مقالة جديدة', list: essaysList },
  { kind: 'weblog' as PostKind, label: 'المدونة', newLabel: 'مدونة جديدة', list: weblogList },
])

async function onReorder(kind: PostKind, list: Post[]) {
  await $fetch('/api/admin/posts/reorder', { method: 'POST', body: { kind, ids: list.map(p => p.id) } })
}

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await clearSession()
  router.replace('/admin/login')
}
</script>

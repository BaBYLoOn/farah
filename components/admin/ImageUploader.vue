<template>
  <div class="uploader">
    <div v-if="modelValue" class="uploader-preview" :class="{ 'uploader-preview--169': aspect }">
      <img :src="modelValue" alt="" class="uploader-img">
      <div class="uploader-preview-actions">
        <button type="button" class="admin-btn admin-btn--sm" @click="pick">استبدال</button>
        <button type="button" class="admin-btn admin-btn--sm admin-btn--danger" @click="clear">إزالة</button>
      </div>
    </div>

    <button
      v-else
      type="button"
      class="uploader-drop"
      :class="{ 'is-busy': busy }"
      @click="pick"
    >
      <span v-if="busy">…جارٍ الرفع</span>
      <span v-else>{{ label }}</span>
    </button>

    <p v-if="error" class="admin-login-error">{{ error }}</p>
    <input ref="input" type="file" accept="image/*" hidden @change="onChange">

    <AdminImageCropper
      v-if="cropFile"
      :file="cropFile"
      :aspect="16 / 9"
      @confirm="onCropped"
      @cancel="cropFile = null"
    />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: string; label?: string; aspect?: boolean }>(), {
  label: 'رفع صورة',
  aspect: false, // when true, force a 16:9 crop step before upload
})
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const input = ref<HTMLInputElement>()
const busy = ref(false)
const error = ref('')
const cropFile = ref<File | null>(null)

const pick = () => input.value?.click()
const clear = () => emit('update:modelValue', '')

function onChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (input.value) input.value.value = ''
  if (!file) return
  error.value = ''
  if (props.aspect && !/svg/i.test(file.type)) {
    cropFile.value = file            // open the cropper
  } else {
    upload(file)                     // upload as-is
  }
}

async function onCropped(blob: Blob) {
  cropFile.value = null
  await upload(new File([blob], 'crop.jpg', { type: blob.type }))
}

async function upload(file: File | Blob) {
  busy.value = true
  error.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file, (file as File).name || 'upload.jpg')
    const res = await $fetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd })
    emit('update:modelValue', res.url)
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'تعذّر رفع الصورة'
  } finally {
    busy.value = false
  }
}
</script>

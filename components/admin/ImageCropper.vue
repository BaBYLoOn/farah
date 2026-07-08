<template>
  <div class="admin-modal-overlay" @click.self="$emit('cancel')">
    <div class="cropper" role="dialog" aria-modal="true">
      <h3 class="admin-modal-title">اقتصاص الصورة (16:9)</h3>
      <p class="admin-modal-text">حرّكي الصورة واستخدمي التكبير لتناسب الإطار.</p>

      <div
        ref="viewport"
        class="cropper-viewport"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <img
          v-if="src"
          ref="imgEl"
          :src="src"
          class="cropper-img"
          draggable="false"
          :style="imgStyle"
          @load="onImgLoad"
        >
        <div class="cropper-frame" aria-hidden="true" />
      </div>

      <label class="cropper-zoom">
        <span>تكبير</span>
        <input v-model.number="zoom" type="range" min="1" max="3" step="0.01" @input="clamp">
      </label>

      <div class="admin-modal-actions cropper-actions">
        <button class="admin-btn admin-btn--primary" :disabled="busy" @click="confirm">{{ busy ? '…' : 'اقتصاص واستخدام' }}</button>
        <button class="admin-btn admin-btn--ghost" :disabled="busy" @click="$emit('cancel')">إلغاء</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ file: File; aspect?: number }>(), { aspect: 16 / 9 })
const emit = defineEmits<{ confirm: [Blob]; cancel: [] }>()

const src = ref('')
const viewport = ref<HTMLElement>()
const imgEl = ref<HTMLImageElement>()
const nat = reactive({ w: 0, h: 0 })
const vp = reactive({ w: 0, h: 0 })
const zoom = ref(1)
const offset = reactive({ x: 0, y: 0 }) // top-left of image relative to viewport (<= 0)
const busy = ref(false)

let baseScale = 1 // scale at zoom=1 so the image covers the viewport
const scale = computed(() => baseScale * zoom.value)

const imgStyle = computed(() => ({
  width: `${nat.w * scale.value}px`,
  height: `${nat.h * scale.value}px`,
  transform: `translate(${offset.x}px, ${offset.y}px)`,
}))

onMounted(() => {
  const r = new FileReader()
  r.onload = () => { src.value = String(r.result) }
  r.readAsDataURL(props.file)
})

function measure() {
  if (!viewport.value) return
  vp.w = viewport.value.clientWidth
  vp.h = vp.w / props.aspect
}
function onImgLoad() {
  const img = imgEl.value!
  nat.w = img.naturalWidth
  nat.h = img.naturalHeight
  measure()
  baseScale = Math.max(vp.w / nat.w, vp.h / nat.h)
  zoom.value = 1
  offset.x = (vp.w - nat.w * scale.value) / 2
  offset.y = (vp.h - nat.h * scale.value) / 2
  clamp()
}

function clamp() {
  const sw = nat.w * scale.value
  const sh = nat.h * scale.value
  offset.x = Math.min(0, Math.max(vp.w - sw, offset.x))
  offset.y = Math.min(0, Math.max(vp.h - sh, offset.y))
}

// drag
let dragging = false
let startX = 0, startY = 0, ox0 = 0, oy0 = 0
function onDown(e: PointerEvent) {
  dragging = true
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  startX = e.clientX; startY = e.clientY; ox0 = offset.x; oy0 = offset.y
}
function onMove(e: PointerEvent) {
  if (!dragging) return
  offset.x = ox0 + (e.clientX - startX)
  offset.y = oy0 + (e.clientY - startY)
  clamp()
}
function onUp() { dragging = false }

async function confirm() {
  busy.value = true
  try {
    const targetW = Math.min(1600, Math.round(nat.w))
    const targetH = Math.round(targetW / props.aspect)
    const s = scale.value
    // source rectangle (natural coords) currently framed by the viewport
    const sx = -offset.x / s
    const sy = -offset.y / s
    const sW = vp.w / s
    const sH = vp.h / s
    const canvas = document.createElement('canvas')
    canvas.width = targetW; canvas.height = targetH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(imgEl.value!, sx, sy, sW, sH, 0, 0, targetW, targetH)
    const type = /png/i.test(props.file.type) ? 'image/png' : 'image/jpeg'
    const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), type, 0.9))
    emit('confirm', blob)
  } finally {
    busy.value = false
  }
}
</script>

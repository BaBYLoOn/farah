<template>
  <div class="be" dir="rtl">
    <div v-for="(seg, i) in segments" :key="seg._k" class="be-seg" :class="`be-seg--${seg.kind}`">
      <header v-if="seg.kind !== 'text'" class="be-block-head">
        <span class="be-block-kind">{{ kindLabel(seg.kind) }}</span>
        <div class="be-block-tools">
          <button type="button" class="be-icon" title="أعلى" :disabled="i === 0" @click="move(i, -1)">↑</button>
          <button type="button" class="be-icon" title="أسفل" :disabled="i === segments.length - 1" @click="move(i, 1)">↓</button>
          <button type="button" class="be-icon be-icon--danger" title="حذف" @click="removeAt(i)">✕</button>
        </div>
      </header>

      <!-- flowing text (paragraphs + headings) -->
      <AdminRichBody v-if="seg.kind === 'text'" v-model="seg.blocks" @update:model-value="commit" />

      <!-- quote -->
      <div v-else-if="seg.kind === 'quote'" class="be-block-body">
        <AdminRichText v-model="seg.block.html" placeholder="نصّ الاقتباس…" @update:model-value="commit" />
        <input v-model="seg.block.attribution" class="admin-input be-attr" placeholder="النسبة (اختياري) — مثال: بول ريكور" @input="commit">
      </div>

      <!-- single image -->
      <div v-else-if="seg.kind === 'image'" class="be-block-body">
        <AdminImageUploader v-model="seg.block.src" :aspect="true" @update:model-value="commit" />
        <input v-model="seg.block.alt" class="admin-input" placeholder="وصف الصورة (بديل نصّي)" @input="commit">
        <input v-model="seg.block.caption" class="admin-input" placeholder="تعليق أسفل الصورة (اختياري)" @input="commit">
        <div class="be-inline-controls">
          <span class="be-ctl-label">العرض:</span>
          <button type="button" class="admin-btn admin-btn--sm" :class="{ 'admin-btn--primary': seg.block.layout !== 'full' }" @click="seg.block.layout = 'inset'; commit()">داخل النص</button>
          <button type="button" class="admin-btn admin-btn--sm" :class="{ 'admin-btn--primary': seg.block.layout === 'full' }" @click="seg.block.layout = 'full'; commit()">عرض كامل</button>
        </div>
      </div>

      <!-- image group -->
      <div v-else-if="seg.kind === 'imageGroup'" class="be-block-body">
        <div class="be-inline-controls">
          <span class="be-ctl-label">التنسيق:</span>
          <button type="button" class="admin-btn admin-btn--sm" :class="{ 'admin-btn--primary': seg.block.layout === 'stacked' }" @click="seg.block.layout = 'stacked'; commit()">فوق بعض</button>
          <button type="button" class="admin-btn admin-btn--sm" :class="{ 'admin-btn--primary': seg.block.layout === 'duo' }" @click="seg.block.layout = 'duo'; commit()">جنبًا لجنب</button>
          <button type="button" class="admin-btn admin-btn--sm" :class="{ 'admin-btn--primary': seg.block.layout === 'triptych' }" @click="seg.block.layout = 'triptych'; commit()">ثلاث</button>
        </div>
        <div class="be-group-grid">
          <div v-for="(img, gi) in seg.block.images" :key="gi" class="be-group-item">
            <AdminImageUploader v-model="img.src" label="صورة" :aspect="true" @update:model-value="commit" />
            <input v-model="img.caption" class="admin-input admin-input--sm" placeholder="تعليق" @input="commit">
            <button type="button" class="admin-btn admin-btn--sm admin-btn--danger" @click="seg.block.images.splice(gi, 1); commit()">إزالة</button>
          </div>
        </div>
        <button type="button" class="admin-btn admin-btn--sm" @click="seg.block.images.push({ src: '', alt: '', caption: '' }); commit()">+ صورة</button>
      </div>

      <!-- insert-below bar -->
      <div class="be-insert">
        <span class="be-insert-plus">＋</span>
        <button type="button" class="be-insert-btn" @click="insertAfter(i, 'text')">نص</button>
        <button type="button" class="be-insert-btn" @click="insertAfter(i, 'image')">صورة</button>
        <button type="button" class="be-insert-btn" @click="insertAfter(i, 'imageGroup')">مجموعة صور</button>
      </div>
    </div>

    <div v-if="!segments.length" class="be-empty">
      <button type="button" class="admin-btn admin-btn--primary" @click="insertAfter(-1, 'text')">ابدئي الكتابة</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Block } from '~/data/content'

const props = defineProps<{ modelValue: Block[] }>()
const emit = defineEmits<{ 'update:modelValue': [Block[]] }>()

type TextSeg = { kind: 'text'; _k: number; blocks: Block[] }
type BlockSeg = { kind: 'quote' | 'image' | 'imageGroup'; _k: number; block: any }
type Seg = TextSeg | BlockSeg
let keyer = 0
const segments = ref<Seg[]>([])

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function fromModel(list: Block[]): Seg[] {
  const segs: Seg[] = []
  let text: Block[] | null = null
  const flush = () => { if (text && text.length) { segs.push({ kind: 'text', _k: keyer++, blocks: text }); text = null } }
  for (const b of (list || [])) {
    if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote') {
      if (!text) text = []
      text.push(clone(b))
    } else {
      flush()
      segs.push({ kind: b.type as BlockSeg['kind'], _k: keyer++, block: clone(b) })
    }
  }
  flush()
  return segs
}

function toModel(segs: Seg[]): Block[] {
  const out: Block[] = []
  for (const s of segs) {
    if (s.kind === 'text') out.push(...s.blocks)
    else out.push(s.block)
  }
  return out
}

watch(() => props.modelValue, (val) => {
  if (JSON.stringify(toModel(segments.value)) !== JSON.stringify(val || [])) {
    segments.value = fromModel(val || [])
  }
}, { immediate: true })

function commit() { emit('update:modelValue', toModel(segments.value)) }

function makeSeg(kind: Seg['kind']): Seg {
  if (kind === 'text') return { kind: 'text', _k: keyer++, blocks: [{ type: 'paragraph', html: '', text: '' }] }
  const block: Record<string, any> = {
    quote: { type: 'quote', html: '', text: '', attribution: '' },
    image: { type: 'image', src: '', alt: '', caption: '', layout: 'full' },
    imageGroup: { type: 'imageGroup', layout: 'stacked', images: [{ src: '', alt: '', caption: '' }, { src: '', alt: '', caption: '' }] },
  }[kind]
  return { kind: kind as BlockSeg['kind'], _k: keyer++, block }
}

function insertAfter(i: number, kind: Seg['kind']) {
  segments.value.splice(i + 1, 0, makeSeg(kind))
  commit()
  nextTick(() => {
    const els = document.querySelectorAll('.be-seg')
    els[i + 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

function removeAt(i: number) { segments.value.splice(i, 1); commit() }
function move(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= segments.value.length) return
  const a = segments.value
  ;[a[i], a[j]] = [a[j], a[i]]
  commit()
}

const kindLabel = (t: string) => ({ quote: 'اقتباس', image: 'صورة', imageGroup: 'مجموعة صور' } as Record<string, string>)[t] || t
</script>

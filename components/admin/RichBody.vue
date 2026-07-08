<template>
  <div class="rt rt--body" :class="{ 'rt--focused': focused }">
    <div class="rt-toolbar">
      <button type="button" class="rt-tool" :class="{ 'is-active': isActive('bold') }" title="عريض" @mousedown.prevent="run(c => c.toggleBold())"><b>B</b></button>
      <button type="button" class="rt-tool" :class="{ 'is-active': isActive('italic') }" title="مائل" @mousedown.prevent="run(c => c.toggleItalic())"><i>I</i></button>
      <button type="button" class="rt-tool" :class="{ 'is-active': isActive('link') }" title="رابط" @mousedown.prevent="setLink">🔗</button>
      <span class="rt-sep" />
      <button type="button" class="rt-tool rt-tool--txt" :class="{ 'is-active': isActive('heading', { level: 2 }) }" title="عنوان — يجعل السطر المحدد عنوانًا كبيرًا" @mousedown.prevent="run(c => c.toggleHeading({ level: 2 }))">عنوان</button>
      <button type="button" class="rt-tool rt-tool--txt" :class="{ 'is-active': isActive('blockquote') }" title="اقتباس — لإضافة اسم القائل ابدئي السطر التالي بـ -" @mousedown.prevent="run(c => c.toggleBlockquote())">اقتباس</button>
      <span class="rt-sep" />
      <label class="rt-color" :title="`لون الخط (${penColor})`" @mousedown.prevent>
        <span class="rt-color-swatch" :style="{ background: penColor }" />
        <input v-model="penColor" type="color" class="rt-color-input" @change="run(c => c.setColor(penColor))">
      </label>
      <button type="button" class="rt-tool rt-tool--txt" title="لوّن النص المحدد" @mousedown.prevent="run(c => c.setColor(penColor))">لوّن</button>
      <button type="button" class="rt-tool rt-tool--txt" title="إزالة اللون" @mousedown.prevent="run(c => c.unsetColor())">بلا لون</button>
      <span class="rt-sep" />
      <button type="button" class="rt-tool rt-tool--txt" title="تراجع" @mousedown.prevent="run(c => c.undo())">↺</button>
      <button type="button" class="rt-tool rt-tool--txt" title="إعادة" @mousedown.prevent="run(c => c.redo())">↻</button>
      <span class="rt-count">{{ wordCount }} كلمة</span>
    </div>
    <EditorContent :editor="editor" class="rt-content rt-content--body" dir="rtl" />
  </div>
</template>

<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import type { Block } from '~/data/content'

const props = defineProps<{ modelValue: Block[] }>()
const emit = defineEmits<{ 'update:modelValue': [Block[]] }>()

const focused = ref(false)
const wordCount = ref(0)
const penColor = ref('#d63a3a') // default red
const editor = shallowRef<Editor>()

const escapeHtml = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Block[] → editor HTML
function blocksToHtml(blocks: Block[]): string {
  const parts = (blocks || []).map((b: any) => {
    const inner = b.html && String(b.html).trim() ? b.html : escapeHtml(b.text ?? '')
    if (b.type === 'heading') { const lvl = b.level === 3 ? 3 : 2; return `<h${lvl}>${inner}</h${lvl}>` }
    if (b.type === 'quote') {
      const attr = b.attribution ? `<p>- ${escapeHtml(b.attribution)}</p>` : ''
      return `<blockquote><p>${inner}</p>${attr}</blockquote>`
    }
    return `<p>${inner}</p>`
  })
  return parts.join('') || '<p></p>'
}

// editor HTML → Block[] (paragraph / heading / quote)
function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: Block[] = []
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== 1) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (tag === 'h2' || tag === 'h3') {
      out.push({ type: 'heading', level: tag === 'h3' ? 3 : 2, html: el.innerHTML.trim(), text: (el.textContent || '').trim() })
    } else if (tag === 'blockquote') {
      const ps = Array.from(el.querySelectorAll(':scope > p'))
      let quoteEls = ps
      let attribution = ''
      if (ps.length >= 2) {
        const lastText = (ps[ps.length - 1].textContent || '').trim()
        if (/^[-–—]/.test(lastText)) {
          attribution = lastText.replace(/^[-–—]\s*/, '').trim()
          quoteEls = ps.slice(0, -1)
        }
      }
      const quoteHtml = quoteEls.length
        ? quoteEls.map(p => p.innerHTML.trim()).join('<br>')
        : el.innerHTML.trim()
      const quoteText = quoteEls.length
        ? quoteEls.map(p => (p.textContent || '').trim()).join(' ')
        : (el.textContent || '').trim()
      out.push({ type: 'quote', html: quoteHtml, text: quoteText, attribution })
    } else {
      out.push({ type: 'paragraph', html: el.innerHTML.trim(), text: (el.textContent || '').trim() })
    }
  })
  return out
}

onMounted(() => {
  editor.value = new Editor({
    content: blocksToHtml(props.modelValue),
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false, // StarterKit bundles Link; we add our own configured one
        bulletList: false, orderedList: false, listItem: false,
        codeBlock: false, code: false, horizontalRule: false, strike: false,
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: 'ابدئي الكتابة… استخدمي «عنوان» و«اقتباس» عند الحاجة.' }),
    ],
    onUpdate: ({ editor }) => {
      wordCount.value = editor.getText().trim().split(/\s+/).filter(Boolean).length
      emit('update:modelValue', htmlToBlocks(editor.getHTML()))
    },
    onFocus: () => { focused.value = true },
    onBlur: () => { focused.value = false },
    onCreate: ({ editor }) => {
      wordCount.value = editor.getText().trim().split(/\s+/).filter(Boolean).length
    },
  })
})

onBeforeUnmount(() => editor.value?.destroy())

// One-way-out sync: the editor is seeded once from modelValue, then it only
// EMITS changes upward. We only ever push content back into it for the initial
// (possibly async) load while it is still empty — never overwriting the user's
// edits afterwards. This removes any chance of a change (e.g. a new heading)
// being reverted/cleared by the reactive round-trip.
let seeded = Array.isArray(props.modelValue) && props.modelValue.length > 0
watch(() => props.modelValue, (val) => {
  if (!editor.value || seeded) return
  if (val && val.length && editor.value.isEmpty) {
    editor.value.commands.setContent(blocksToHtml(val), { emitUpdate: false })
    seeded = true
  }
})

const isActive = (name: string, attrs?: Record<string, any>) => editor.value?.isActive(name, attrs) ?? false
function run(fn: (c: any) => any) { if (editor.value) fn(editor.value.chain().focus()).run() }
function setLink() {
  if (!editor.value) return
  const prev = editor.value.getAttributes('link').href
  const url = window.prompt('عنوان الرابط:', prev || 'https://')
  if (url === null) return
  if (url === '') { run(c => c.unsetLink()); return }
  run(c => c.extendMarkRange('link').setLink({ href: url }))
}
</script>

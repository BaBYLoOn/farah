<template>
  <div class="rt" :class="{ 'rt--focused': focused }">
    <div class="rt-toolbar">
      <button type="button" class="rt-tool" :class="{ 'is-active': isActive('bold') }" title="عريض (Ctrl+B)" @mousedown.prevent="run(c => c.toggleBold())"><b>B</b></button>
      <button type="button" class="rt-tool" :class="{ 'is-active': isActive('italic') }" title="مائل (Ctrl+I)" @mousedown.prevent="run(c => c.toggleItalic())"><i>I</i></button>
      <button type="button" class="rt-tool" :class="{ 'is-active': isActive('link') }" title="رابط" @mousedown.prevent="setLink"><span>🔗</span></button>
      <button type="button" class="rt-tool" title="إزالة رابط" :disabled="!isActive('link')" @mousedown.prevent="run(c => c.unsetLink())"><span>⌫🔗</span></button>
    </div>
    <EditorContent :editor="editor" class="rt-content" :dir="dir" />
  </div>
</template>

<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  dir?: 'rtl' | 'ltr'
}>(), { modelValue: '', placeholder: 'اكتبي هنا…', dir: 'rtl' })

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const focused = ref(false)
let editor = shallowRef<Editor>()

// getHTML → inline-only HTML: paragraph breaks become <br>, outer <p> stripped.
function toInline(html: string): string {
  return html
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>\s*(?=.)/gi, '<br>')
    .replace(/<\/p>/gi, '')
    .replace(/(<br>\s*)+$/gi, '')
    .trim()
}

onMounted(() => {
  editor.value = new Editor({
    content: props.modelValue || '',
    extensions: [
      StarterKit.configure({
        heading: false, bulletList: false, orderedList: false, listItem: false,
        blockquote: false, codeBlock: false, code: false, horizontalRule: false, strike: false,
        link: false, // StarterKit bundles Link; we add our own below
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Placeholder.configure({ placeholder: props.placeholder }),
    ],
    onUpdate: ({ editor }) => emit('update:modelValue', toInline(editor.getHTML())),
    onFocus: () => { focused.value = true },
    onBlur: () => { focused.value = false },
  })
})

onBeforeUnmount(() => editor.value?.destroy())

// keep editor in sync if the value is replaced externally (e.g. loaded post)
watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  if (toInline(editor.value.getHTML()) !== (val || '')) {
    editor.value.commands.setContent(val || '', false)
  }
})

const isActive = (name: string) => editor.value?.isActive(name) ?? false
function run(fn: (c: any) => any) {
  if (!editor.value) return
  fn(editor.value.chain().focus()).run()
}
function setLink() {
  if (!editor.value) return
  const prev = editor.value.getAttributes('link').href
  const url = window.prompt('عنوان الرابط:', prev || 'https://')
  if (url === null) return
  if (url === '') { run(c => c.unsetLink()); return }
  run(c => c.extendMarkRange('link').setLink({ href: url }))
}
</script>

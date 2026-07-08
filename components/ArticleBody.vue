<template>
  <div class="article-body">
    <template v-for="(block, idx) in blocks" :key="idx">

      <p
        v-if="block.type === 'paragraph'"
        class="article-paragraph"
        :class="{ 'article-paragraph--dropcap': block.dropCap }"
        v-html="richText(block)"
      />

      <component
        :is="block.level === 3 ? 'h3' : 'h2'"
        v-else-if="block.type === 'heading'"
        class="article-heading"
        :class="[`article-heading--${block.level ?? 2}`]"
        v-html="richText(block)"
      />

      <blockquote v-else-if="block.type === 'quote'" class="article-quote">
        <span class="article-quote-stem" aria-hidden="true" />
        <p class="article-quote-text"><em v-html="richText(block)" /></p>
        <cite v-if="block.attribution" class="article-quote-cite">— {{ block.attribution }}</cite>
      </blockquote>

      <figure
        v-else-if="block.type === 'image'"
        class="article-figure"
        :class="[`article-figure--${block.layout ?? 'inset'}`]"
      >
        <div class="article-figure-frame">
          <img
            class="article-figure-image"
            :src="block.src"
            :alt="block.alt ?? ''"
            loading="lazy"
            decoding="async"
          >
          <div class="article-figure-veil" />
          <div class="article-figure-grain" />
        </div>
        <figcaption v-if="block.caption" class="article-figure-caption">
          <em>{{ block.caption }}</em>
        </figcaption>
      </figure>

      <div
        v-else-if="block.type === 'imageGroup'"
        class="article-figures"
        :class="[`article-figures--${block.layout ?? 'duo'}`]"
      >
        <figure v-for="(item, i) in block.images" :key="i" class="article-figure article-figure--inset">
          <div class="article-figure-frame">
            <img
              class="article-figure-image"
              :src="item.src"
              :alt="item.alt ?? ''"
              loading="lazy"
              decoding="async"
            >
            <div class="article-figure-veil" />
            <div class="article-figure-grain" />
          </div>
          <figcaption v-if="item.caption" class="article-figure-caption"><em>{{ item.caption }}</em></figcaption>
        </figure>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import type { Block } from '~/data/content'
defineProps<{ blocks: Block[] }>()

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Prefer stored inline HTML (bold/italic/links); fall back to escaped plain text.
const richText = (block: { html?: string; text?: string }) =>
  block.html && block.html.trim() ? block.html : escapeHtml(block.text ?? '')
</script>

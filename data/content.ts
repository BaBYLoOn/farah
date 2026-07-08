// Block-based content model. Every essay and weblog body is a Block[].
// The dashboard will produce this same array — no refactor needed when it ships.

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | ImageBlock
  | ImageGroupBlock

// Text blocks carry both `text` (plain, used for excerpts / reading-time) and an
// optional `html` (inline formatting only: <strong>, <em>, <a>, <br>). When
// `html` is present the article renderer uses it; otherwise it falls back to
// plain `text`. The static seed content has no `html` and renders unchanged.
export interface ParagraphBlock {
  type: 'paragraph'
  text: string
  html?: string
  dropCap?: boolean
}

export interface HeadingBlock {
  type: 'heading'
  text: string
  html?: string
  level?: 2 | 3
}

export interface QuoteBlock {
  type: 'quote'
  text: string
  html?: string
  attribution?: string
}

export interface ImageBlock {
  type: 'image'
  src: string
  alt?: string
  caption?: string
  layout?: 'inset' | 'full'
}

export interface ImageGroupBlock {
  type: 'imageGroup'
  images: { src: string; alt?: string; caption?: string }[]
  // 'stacked' = one below the other (default); 'duo' = side by side; 'triptych' = three across
  layout?: 'stacked' | 'duo' | 'triptych'
}

export interface Source {
  text: string
  url?: string
}

import type { Block } from '~/data/content'

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const toArabicDigits = (n: number) => String(n).replace(/\d/g, d => AR_DIGITS[+d])

/** Estimated reading time for a Block[] body, as an Arabic label (e.g. "٧ دقائق قراءة"). */
export function readingTimeLabel(blocks: Block[]): string {
  let words = 0
  for (const b of blocks) {
    if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote') {
      words += b.text.trim().split(/\s+/).length
    }
  }
  const mins = Math.max(1, Math.round(words / 180)) // ~180 wpm for Arabic prose

  if (mins === 1) return 'دقيقة قراءة'
  if (mins === 2) return 'دقيقتا قراءة'
  if (mins <= 10) return `${toArabicDigits(mins)} دقائق قراءة`
  return `${toArabicDigits(mins)} دقيقة قراءة`
}

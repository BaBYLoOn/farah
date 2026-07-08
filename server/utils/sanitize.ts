// Minimal allow-list sanitizer for the inline HTML produced by the editor.
// Only a handful of inline tags are permitted; everything else is stripped
// (its text content is kept). Anchors keep a validated href only.
const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'a', 'span'])

function safeHref(raw: string): string | null {
  const v = raw.trim()
  if (/^(https?:|mailto:|\/|#)/i.test(v) && !/^javascript:/i.test(v)) return v
  return null
}

// Only allow a `color: <value>` inline style (from the editor's text colour).
function safeColorStyle(inner: string): string {
  const m = inner.match(/color\s*:\s*([^;"']+)/i)
  if (!m) return ''
  const v = m[1].trim()
  if (/^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\)|[a-zA-Z]+)$/.test(v)) {
    return ` style="color: ${v}"`
  }
  return ''
}

export function sanitizeInlineHtml(input: string): string {
  if (!input) return ''
  // drop script/style blocks entirely
  let html = input.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')

  html = html.replace(/<([^>]*)>/g, (_m, inner: string) => {
    const closing = /^\s*\//.test(inner)
    const nameMatch = inner.match(/^\s*\/?\s*([a-zA-Z0-9]+)/)
    const name = nameMatch ? nameMatch[1].toLowerCase() : ''
    if (!ALLOWED.has(name)) return '' // strip disallowed tag, keep text
    if (name === 'br') return '<br>'
    if (closing) return `</${name}>`
    if (name === 'span') {
      const style = safeColorStyle(inner)
      return style ? `<span${style}>` : '<span>'
    }
    if (name === 'a') {
      const hrefMatch = inner.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i)
      const href = hrefMatch ? safeHref(hrefMatch[2] ?? hrefMatch[3] ?? '') : null
      return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">` : '<a>'
    }
    return `<${name}>` // strip all attributes from formatting tags
  })

  return html.trim()
}

// Plain-text projection of inline HTML — used for excerpts / reading time.
export function htmlToText(input: string): string {
  return String(input || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// Client-safe site-content model + defaults. NO server/DB imports here, so this
// can be imported by both browser components and server code.
import { socials as seedSocials } from './socials'

// `key` picks a built-in SVG icon; `icon` (optional) is an uploaded image URL
// that overrides the built-in when present.
export interface SocialLink { key: string; label: string; handle: string; href: string; icon?: string }

export interface SiteContent {
  hero: { eyebrow: string; name: string; tagline: string; quote: string; quoteAccent: string }
  essays: { eyebrow: string; title: string; sub: string }
  weblog: { eyebrow: string; title: string; sub: string }
  footer: { name: string }
  socials: SocialLink[]
}

// Icon names the hero/footer can render (must match the SVG maps in those components).
export const ICON_NAMES = ['essays', 'weblog', 'letterboxd', 'pinterest', 'soundcloud', 'instagram', 'telegram', 'link']

export const DEFAULT_SITE: SiteContent = {
  hero: {
    eyebrow: "Dante's Beatrice",
    name: 'FARAH',
    tagline: 'Radically Original',
    quote: 'Every consciousness pursues the death of the other.',
    quoteAccent: 'death',
  },
  essays: {
    eyebrow: 'Selected Writings',
    title: 'ESSAYS',
    sub: 'Pages from a slow study — on grief, hunger, the dream, and what the candle remembers when no one is watching.',
  },
  weblog: {
    eyebrow: 'From the Notebook',
    title: 'WEBLOG',
    sub: 'Brief notes, kept between essays — fragments, marginalia, and the small heresies that are too restless to sit still on a longer page.',
  },
  footer: { name: 'Farah Ali' },
  socials: seedSocials.map(s => ({ ...s })),
}

export function deepMergeSite<T>(base: T, over: any): T {
  if (Array.isArray(base)) return (Array.isArray(over) ? over : base) as T
  if (base && typeof base === 'object') {
    const out: any = { ...base }
    for (const k of Object.keys(base as any)) {
      if (over && k in over) out[k] = deepMergeSite((base as any)[k], over[k])
    }
    return out
  }
  return (over ?? base) as T
}

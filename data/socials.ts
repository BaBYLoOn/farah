export interface SocialLink {
  key: string
  label: string
  handle: string
  href: string
}

// Order matters — used directly by the hero cluster and the footer row.
// Letterboxd → Pinterest → SoundCloud → Instagram → Essays → Weblog.
export const socials: SocialLink[] = [
  {
    key: 'letterboxd',
    label: 'Letterboxd',
    handle: 'orchidee26_',
    href: 'https://letterboxd.com/orchidee26_',
  },
  {
    key: 'pinterest',
    label: 'Pinterest',
    handle: 'orchidee27_',
    href: 'https://www.pinterest.com/orchidee27_/',
  },
  {
    key: 'soundcloud',
    label: 'SoundCloud',
    handle: 'farah-a27',
    href: 'https://soundcloud.com/farah-a27',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    handle: 'fara77ali',
    href: 'https://www.instagram.com/fara77ali',
  },
  {
    key: 'essays',
    label: 'Essays',
    handle: 'elmahatta',
    href: 'https://elmahatta.com/author/farahali/',
  },
  {
    key: 'weblog',
    label: 'Weblog',
    handle: 'farahphilo',
    href: 'https://farahphilo.wordpress.com/',
  },
]

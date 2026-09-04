import type { Metadata, Viewport } from 'next'
import { Black_Han_Sans, IBM_Plex_Sans_KR } from 'next/font/google'
import './globals.css'

// 스펙 15. subsets는 preload 대상만 정한다. 한글 조각은 unicode-range로 필요할 때 내려받는다.
const display = Black_Han_Sans({ weight: '400', subsets: ['latin'], variable: '--font-display-src', display: 'swap' })
const body = IBM_Plex_Sans_KR({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-body-src', display: 'swap' })

export const metadata: Metadata = {
  title: '식사 룰렛',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}

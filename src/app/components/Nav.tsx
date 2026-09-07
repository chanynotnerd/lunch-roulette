'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: '홈' },
  { href: '/places', label: '장소' },
  { href: '/records', label: '기록' },
  { href: '/me', label: '내 정보' },
] as const

/** 하단 탭: 홈, 장소, 기록, 내 정보. 현재 화면은 aria-current로 표시한다. 로그아웃은 내 정보 안에 있다. 스펙 07 공통, 15 접근성, 18. */
export default function Nav() {
  const pathname = usePathname()
  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <nav className="tabbar" aria-label="주요 화면">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={isCurrent(t.href) ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

import Link from 'next/link'
import { signOut } from '@/actions/auth'

/** 하단 탭: 홈, 장소, 기록 + 로그아웃. 스펙 07 공통. */
export default function Nav() {
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '10px 8px',
        borderTop: '1px solid #ddd',
        background: '#fff',
      }}
    >
      <Link href="/">홈</Link>
      <Link href="/places">장소</Link>
      <Link href="/records">기록</Link>
      <form action={signOut}>
        <button type="submit" style={{ background: 'none', border: 'none', padding: 0, color: '#666', cursor: 'pointer' }}>
          로그아웃
        </button>
      </form>
    </nav>
  )
}

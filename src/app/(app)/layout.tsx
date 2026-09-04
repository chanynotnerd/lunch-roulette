import Nav from '@/app/components/Nav'

/** 홈, 장소, 기록 공통 뼈대. 로그인은 이 그룹 밖이다. 스펙 07 공통. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="page">{children}</main>
      <Nav />
    </>
  )
}

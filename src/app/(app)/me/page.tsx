import { redirect } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { loadProfile } from '@/lib/profile'
import Avatar from './Avatar'

export const dynamic = 'force-dynamic'

/** S5. 내 정보: Google 계정 사진·이름·이메일과 로그아웃. 스펙 18. */
export default async function MePage() {
  const profile = await loadProfile()
  // proxy가 먼저 막지만, 세션이 그 사이 만료됐을 때를 위해 한 번 더 보낸다.
  if (!profile) redirect('/login')

  return (
    <>
      <h1 className="page-title">내 정보</h1>

      <div className="member-card">
        <Avatar src={profile.avatarUrl} initial={profile.initial} name={profile.name} />
        <div className="member-card-main">
          <div className="member-card-name">{profile.name}</div>
          {profile.email && <div className="member-card-email">{profile.email}</div>}
        </div>
      </div>

      <p className="muted small">Google 계정으로 로그인되어 있습니다</p>

      <form action={signOut}>
        <button type="submit" className="btn btn-block">
          로그아웃
        </button>
      </form>
    </>
  )
}

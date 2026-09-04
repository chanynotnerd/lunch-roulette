import { resetTodaySessions } from '@/actions/admin'
import { isAdminEmail } from '@/lib/admin'
import { requireUser } from '@/lib/auth'

/** 관리자(ADMIN_EMAILS)에게만 보이는 "오늘 기록 초기화" 버튼. 서버 컴포넌트. */
export default async function AdminResetButton() {
  const user = await requireUser()
  if (!user || !isAdminEmail(user.email)) return null
  return (
    <form
      action={async () => {
        'use server'
        await resetTodaySessions()
      }}
    >
      <button type="submit" className="btn btn-admin">
        오늘 기록 초기화 (관리자)
      </button>
    </form>
  )
}

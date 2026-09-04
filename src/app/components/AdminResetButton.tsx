import { isAdminEmail, resetTodaySessions } from '@/actions/admin'
import { requireUser } from '@/lib/auth'

/** 관리자(ADMIN_EMAILS)에게만 보이는 "오늘 기록 초기화" 버튼. 서버 컴포넌트. */
export default async function AdminResetButton() {
  const user = await requireUser()
  if (!user || !(await isAdminEmail(user.email))) return null
  return (
    <form
      action={async () => {
        'use server'
        await resetTodaySessions()
      }}
      style={{ margin: '8px 0 16px' }}
    >
      <button
        type="submit"
        style={{
          padding: '6px 10px',
          border: '1px dashed #c66',
          borderRadius: 6,
          background: '#fff5f5',
          color: '#a33',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        오늘 기록 초기화 (관리자)
      </button>
    </form>
  )
}

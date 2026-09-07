import { redirect } from 'next/navigation'
import { loadRecordsScreen } from '@/actions/records'
import { ERROR_MESSAGES } from '@/lib/result'
import AdminResetButton from '@/app/components/AdminResetButton'
import RecordsScreen from './RecordsScreen'

export const dynamic = 'force-dynamic'

/** S4. 기록: 전체 화면 지도 + 목록 오버레이. 스펙 16. 데이터는 서버에서 모아 클라이언트에 넘긴다. */
export default async function RecordsPage() {
  const result = await loadRecordsScreen()
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  if (!result.ok) {
    return (
      <>
        <h1 className="page-title">기록</h1>
        <p role="alert" className="alert">
          {ERROR_MESSAGES[result.code](result.params)}
        </p>
      </>
    )
  }

  return (
    <RecordsScreen
      data={result.data}
      kakaoJsKey={process.env.NEXT_PUBLIC_KAKAO_JS_KEY || null}
      adminSlot={<AdminResetButton />}
    />
  )
}

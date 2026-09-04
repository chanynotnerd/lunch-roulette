import { redirect } from 'next/navigation'
import { listRecords } from '@/actions/records'
import { ERROR_MESSAGES } from '@/lib/result'
import { formatSlotDate } from '@/lib/format'
import AdminResetButton from '@/app/components/AdminResetButton'
import LevelStamps from '@/app/components/LevelStamps'

export const dynamic = 'force-dynamic'

/** S4. 기록: confirmed 세션을 날짜 내림차순으로. 뜯어낸 식권 더미. */
export default async function RecordsPage() {
  const result = await listRecords()
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <>
      <h1 className="page-title">기록</h1>
      <AdminResetButton />
      {!result.ok ? (
        <p role="alert" className="alert">
          {ERROR_MESSAGES[result.code](result.params)}
        </p>
      ) : result.data.length === 0 ? (
        <p className="muted">아직 기록이 없습니다. 홈에서 룰렛을 돌리면 여기에 쌓입니다</p>
      ) : (
        <ul className="stubs">
          {result.data.map((r) => (
            <li key={`${r.slotDate}-${r.slot}`} className="stub">
              <p className="stub-meta">
                {formatSlotDate(r.slotDate)} {r.slotLabel}, {r.placeName}
              </p>
              <p className="stub-name">{r.restaurantName}</p>
              <LevelStamps level={r.levelAtThatTime} levelName={r.levelName} nextIn={null} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

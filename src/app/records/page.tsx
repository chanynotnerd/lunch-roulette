import { redirect } from 'next/navigation'
import { listRecords } from '@/actions/records'
import { ERROR_MESSAGES } from '@/lib/result'
import Nav from '../components/Nav'
import AdminResetButton from '../components/AdminResetButton'

export const dynamic = 'force-dynamic'

/** S4. 기록: confirmed 세션을 날짜 내림차순으로. */
export default async function RecordsPage() {
  const result = await listRecords()
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 72px' }}>
      <h1>기록</h1>
      <AdminResetButton />
      {!result.ok ? (
        <p role="alert">{ERROR_MESSAGES[result.code](result.params)}</p>
      ) : result.data.length === 0 ? (
        <p>아직 기록이 없습니다</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {result.data.map((r) => (
            <li
              key={`${r.slotDate}-${r.slot}`}
              style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <div style={{ color: '#666', fontSize: 14 }}>
                {r.slotDate} · {r.slotLabel} · {r.placeName}
              </div>
              <div style={{ fontWeight: 'bold', marginTop: 4 }}>{r.restaurantName}</div>
              <div style={{ marginTop: 4 }}>
                <span style={{ padding: '2px 8px', borderRadius: 12, background: '#eef', fontSize: 13 }}>
                  Lv{r.levelAtThatTime} {r.levelName}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Nav />
    </main>
  )
}

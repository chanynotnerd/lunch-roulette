import Link from 'next/link'
import Nav from '@/app/components/Nav'
import { redirect } from 'next/navigation'
import { listPlaceRestaurants } from '@/actions/places'
import { ERROR_MESSAGES } from '@/lib/result'

export const dynamic = 'force-dynamic'

export default async function PlaceRestaurantsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await listPlaceRestaurants(id)
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, paddingBottom: 72 }}>
      <h1>연결된 식당</h1>
      {!result.ok ? (
        <p role="alert">{ERROR_MESSAGES[result.code](result.params)}</p>
      ) : result.data.length === 0 ? (
        <p>{ERROR_MESSAGES.PLACE_NO_RESTAURANTS()}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {result.data.map((r) => (
            <li key={r.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8 }}>
              <div>
                <strong>{r.name}</strong>
              </div>
              <div>{r.address}</div>
              <div style={{ marginTop: 4 }}>
                <span style={{ padding: '2px 8px', borderRadius: 12, background: '#eef', fontSize: 13 }}>
                  Lv{r.level} {r.levelName}
                </span>
                {r.nextIn !== null && <span style={{ marginLeft: 8, fontSize: 13 }}>다음 레벨까지 {r.nextIn}회</span>}
              </div>
              {!r.has_hours && <div style={{ color: '#888' }}>영업시간 정보 없음</div>}
            </li>
          ))}
        </ul>
      )}
      <Nav />
    </main>
  )
}

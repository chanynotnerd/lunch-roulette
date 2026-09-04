import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listPlaces } from '@/actions/places'
import { ERROR_MESSAGES } from '@/lib/result'
import DeletePlaceButton from './DeletePlaceButton'
import PlaceForm from './PlaceForm'

export const dynamic = 'force-dynamic'

export default async function PlacesPage() {
  const result = await listPlaces()
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <>
      <h1>장소 관리</h1>

      <section>
        <h2>내 장소</h2>
        {!result.ok ? (
          <p role="alert">{ERROR_MESSAGES[result.code](result.params)}</p>
        ) : result.data.length === 0 ? (
          <p>아직 장소가 없습니다. 아래에서 장소를 추가해 주세요.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {result.data.map((p) => (
              <li
                key={p.id}
                style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8 }}
              >
                <div>
                  <Link href={`/places/${p.id}`}>
                    <strong>{p.name}</strong>
                  </Link>
                </div>
                <div>{p.address}</div>
                <div>
                  반경 {p.radius_m}m · 식당 {p.restaurant_count}곳
                </div>
                <DeletePlaceButton placeId={p.id} placeName={p.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>장소 추가</h2>
        <PlaceForm />
      </section>
    </>
  )
}

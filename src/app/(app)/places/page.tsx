import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listPlaces } from '@/actions/places'
import { ERROR_MESSAGES } from '@/lib/result'
import DeletePlaceButton from './DeletePlaceButton'
import PlaceForm from './PlaceForm'

export const dynamic = 'force-dynamic'

/** S3. 장소 관리. */
export default async function PlacesPage() {
  const result = await listPlaces()
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <>
      <h1 className="page-title">장소 관리</h1>

      <section className="section">
        <h2 className="section-title">내 장소</h2>
        {!result.ok ? (
          <p role="alert" className="alert">
            {ERROR_MESSAGES[result.code](result.params)}
          </p>
        ) : result.data.length === 0 ? (
          <p className="muted">아직 장소가 없습니다. 아래에서 장소를 추가해 주세요.</p>
        ) : (
          <ul className="rows">
            {result.data.map((p) => (
              <li key={p.id} className="row">
                <Link href={`/places/${p.id}`} className="row-title">
                  {p.name}
                </Link>
                <p className="muted small">{p.address}</p>
                <p className="row-meta">
                  반경 {p.radius_m}m, 식당 {p.restaurant_count}곳
                </p>
                <DeletePlaceButton placeId={p.id} placeName={p.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">장소 추가</h2>
        <PlaceForm />
      </section>
    </>
  )
}

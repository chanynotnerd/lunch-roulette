import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listPlaceRestaurants } from '@/actions/places'
import { ERROR_MESSAGES } from '@/lib/result'
import LevelStamps from '@/app/components/LevelStamps'

export const dynamic = 'force-dynamic'

/** S3. 장소에 연결된 식당 목록. */
export default async function PlaceRestaurantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await listPlaceRestaurants(id)
  if (!result.ok && result.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <>
      <Link href="/places" className="back-link">
        장소 목록으로
      </Link>
      <h1 className="page-title">연결된 식당</h1>
      {!result.ok ? (
        <p role="alert" className="alert">
          {ERROR_MESSAGES[result.code](result.params)}
        </p>
      ) : result.data.length === 0 ? (
        <p className="muted">{ERROR_MESSAGES.PLACE_NO_RESTAURANTS()}</p>
      ) : (
        <ul className="rows">
          {result.data.map((r) => (
            <li key={r.id} className="row">
              <p className="row-title">{r.name}</p>
              <p className="muted small">{r.address}</p>
              <LevelStamps level={r.level} levelName={r.levelName} nextIn={r.nextIn} />
              {!r.has_hours && <p className="row-meta">영업시간 정보 없음</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

import { redirect } from 'next/navigation'
import { listPlaces } from '@/actions/places'
import { getHomeState } from '@/actions/roulette'
import { ERROR_MESSAGES } from '@/lib/result'
import AdminResetButton from '@/app/components/AdminResetButton'
import PlacePicker from '@/app/components/PlacePicker'
import RouletteBoard from '@/app/components/RouletteBoard'

export const dynamic = 'force-dynamic'

/** S2. 홈(룰렛). 장소 선택 + 서버가 판정한 상태를 그대로 표시한다. */
export default async function Home({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const { place } = await searchParams

  const places = await listPlaces()
  if (!places.ok) {
    if (places.code === 'AUTH_REQUIRED') redirect('/login')
    return (
      <>
        <h1>식사 룰렛</h1>
        <p role="alert">{ERROR_MESSAGES[places.code](places.params)}</p>
      </>
    )
  }

  // 스펙 06 F1.2: 장소가 없으면 장소 관리로 보낸다.
  if (places.data.length === 0) redirect('/places')

  const selectedPlaceId = places.data.some((p) => p.id === place) ? (place as string) : places.data[0].id
  const state = await getHomeState(selectedPlaceId)
  if (!state.ok && state.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <>
      <h1>식사 룰렛</h1>
      <AdminResetButton />
      <PlacePicker places={places.data.map((p) => ({ id: p.id, name: p.name }))} selectedId={selectedPlaceId} />
      {state.ok ? (
        <RouletteBoard state={state.data} placeId={selectedPlaceId} />
      ) : (
        <p role="alert">{ERROR_MESSAGES[state.code](state.params)}</p>
      )}
    </>
  )
}

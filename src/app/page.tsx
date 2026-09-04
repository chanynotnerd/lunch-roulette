import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listPlaces } from '@/actions/places'
import { getHomeState } from '@/actions/roulette'
import { ERROR_MESSAGES } from '@/lib/result'
import Nav from './components/Nav'
import AdminResetButton from './components/AdminResetButton'
import PlacePicker from './components/PlacePicker'
import RouletteBoard from './components/RouletteBoard'

export const dynamic = 'force-dynamic'

const mainStyle: React.CSSProperties = { maxWidth: 480, margin: '0 auto', padding: '16px 16px 72px' }

/** S2. 홈(룰렛). 장소 선택 + 서버가 판정한 상태를 그대로 표시한다. */
export default async function Home({ searchParams }: { searchParams: Promise<{ place?: string }> }) {
  const { place } = await searchParams

  const places = await listPlaces()
  if (!places.ok) {
    if (places.code === 'AUTH_REQUIRED') redirect('/login')
    return (
      <main style={mainStyle}>
        <h1>점심 룰렛</h1>
        <p role="alert">{ERROR_MESSAGES[places.code](places.params)}</p>
        <Nav />
      </main>
    )
  }

  if (places.data.length === 0) {
    return (
      <main style={mainStyle}>
        <h1>점심 룰렛</h1>
        <p>장소를 먼저 등록해 주세요</p>
        <Link href="/places">장소 관리로 가기</Link>
        <Nav />
      </main>
    )
  }

  const selectedPlaceId = places.data.some((p) => p.id === place) ? (place as string) : places.data[0].id
  const state = await getHomeState(selectedPlaceId)
  if (!state.ok && state.code === 'AUTH_REQUIRED') redirect('/login')

  return (
    <main style={mainStyle}>
      <h1>점심 룰렛</h1>
      <AdminResetButton />
      <PlacePicker places={places.data.map((p) => ({ id: p.id, name: p.name }))} selectedId={selectedPlaceId} />
      {state.ok ? (
        <RouletteBoard state={state.data} placeId={selectedPlaceId} />
      ) : (
        <p role="alert">{ERROR_MESSAGES[state.code](state.params)}</p>
      )}
      <Nav />
    </main>
  )
}

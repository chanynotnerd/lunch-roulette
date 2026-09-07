import { describe, expect, it } from 'vitest'
import * as helpers from '@/actions/records-helpers'
import { toMarkers, toRecordRows, type JoinedRow } from '@/actions/records-helpers'

const KIMBAP = { id: 'r-kimbap', name: '김밥천국', address: '강남대로 123', lat: 37.5, lng: 127.03 }
const BONJUK = { id: 'r-bonjuk', name: '본죽', address: '테헤란로 45', lat: 37.51, lng: 127.04 }

function row(over: Partial<JoinedRow> & { slot_date: string }): JoinedRow {
  return {
    slot: 'lunch',
    chosen_restaurant_id: KIMBAP.id,
    confirmed_at: `${over.slot_date}T03:30:00Z`,
    places: { name: '회사' },
    restaurants: KIMBAP,
    ...over,
  }
}

// 서버가 주는 순서(slot_date desc)대로
const ROWS: JoinedRow[] = [
  row({ slot_date: '2026-09-04' }),
  row({ slot_date: '2026-09-03', slot: 'dinner', places: { name: '집' } }),
  row({ slot_date: '2026-09-02', chosen_restaurant_id: BONJUK.id, restaurants: BONJUK }),
  row({ slot_date: '2026-09-01' }),
]

describe('toRecordRows', () => {
  it('입력 순서를 지키고 슬롯 라벨, 장소 이름, 식당 id를 채운다', () => {
    const out = toRecordRows(ROWS)
    expect(out.map((r) => r.slotDate)).toEqual(['2026-09-04', '2026-09-03', '2026-09-02', '2026-09-01'])
    expect(out[1]).toMatchObject({ slot: 'dinner', slotLabel: '저녁', placeName: '집', restaurantId: KIMBAP.id, restaurantName: '김밥천국' })
  })

  it('확정 당시 레벨: 그 시각까지의 같은 식당 확정 횟수로 계산한다', () => {
    const out = toRecordRows(ROWS)
    // 레벨 표(스펙 05): 경험치 1 → Lv2 익숙, 3 → Lv3 단골. 첫 확정이 곧 경험치 1이다.
    // 김밥천국: 9/1 1회(Lv2 익숙), 9/3 2회(Lv2 익숙), 9/4 3회(Lv3 단골)
    expect(out.find((r) => r.slotDate === '2026-09-01')).toMatchObject({ levelAtThatTime: 2, levelName: '익숙' })
    expect(out.find((r) => r.slotDate === '2026-09-03')).toMatchObject({ levelAtThatTime: 2, levelName: '익숙' })
    expect(out.find((r) => r.slotDate === '2026-09-04')).toMatchObject({ levelAtThatTime: 3, levelName: '단골' })
  })

  it('장소가 삭제됐으면 "삭제된 장소", 확정 정보가 없는 행은 뺀다', () => {
    const out = toRecordRows([
      row({ slot_date: '2026-09-04', places: null }),
      row({ slot_date: '2026-09-03', chosen_restaurant_id: null }),
      row({ slot_date: '2026-09-02', confirmed_at: null }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].placeName).toBe('삭제된 장소')
  })

  it('조인 결과가 배열이어도 첫 항목을 쓴다', () => {
    const out = toRecordRows([row({ slot_date: '2026-09-04', places: [{ name: '회사' }], restaurants: [KIMBAP] })])
    expect(out[0]).toMatchObject({ placeName: '회사', restaurantName: '김밥천국' })
  })
})

describe('toMarkers', () => {
  it('식당 하나에 마커 하나. 방문 횟수, 레벨, 마지막 방문일을 채운다', () => {
    const out = toMarkers(ROWS)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      restaurantId: KIMBAP.id,
      name: '김밥천국',
      address: '강남대로 123',
      lat: 37.5,
      lng: 127.03,
      visits: 3,
      level: 3,
      levelName: '단골',
      lastVisitDate: '2026-09-04',
    })
    // 방문 1회 = 경험치 1 → Lv2 익숙 (스펙 05 레벨 표)
    expect(out[1]).toMatchObject({ restaurantId: BONJUK.id, visits: 1, level: 2, levelName: '익숙', lastVisitDate: '2026-09-02' })
  })

  it('마지막 방문일은 입력 순서와 무관하게 가장 늦은 날짜다', () => {
    const out = toMarkers([row({ slot_date: '2026-09-01' }), row({ slot_date: '2026-09-04' }), row({ slot_date: '2026-09-02' })])
    expect(out[0].lastVisitDate).toBe('2026-09-04')
  })

  it('방문 횟수 내림차순, 같으면 이름 오름차순', () => {
    const out = toMarkers([
      row({ slot_date: '2026-09-04', chosen_restaurant_id: BONJUK.id, restaurants: BONJUK }),
      row({ slot_date: '2026-09-03' }),
    ])
    expect(out.map((m) => m.name)).toEqual(['김밥천국', '본죽'])
  })

  it('좌표가 없거나 유한하지 않은 식당은 뺀다', () => {
    const noLat = { ...BONJUK, lat: null }
    const nan = { ...BONJUK, id: 'r-nan', lng: Number.NaN }
    const out = toMarkers([
      row({ slot_date: '2026-09-04' }),
      row({ slot_date: '2026-09-03', chosen_restaurant_id: noLat.id, restaurants: noLat }),
      row({ slot_date: '2026-09-02', chosen_restaurant_id: nan.id, restaurants: nan }),
    ])
    expect(out.map((m) => m.restaurantId)).toEqual([KIMBAP.id])
  })

  it('식당 조인이 null이거나 확정 정보가 없는 행은 뺀다. 빈 입력은 빈 배열', () => {
    expect(toMarkers([])).toEqual([])
    expect(toMarkers([row({ slot_date: '2026-09-04', restaurants: null }), row({ slot_date: '2026-09-03', chosen_restaurant_id: null })])).toEqual([])
  })

  it('레벨은 방문 횟수를 레벨 표에 대입한 값이다 (7회 → 4 찐단골)', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((d) => row({ slot_date: `2026-09-0${d}` }))
    expect(toMarkers(rows)[0]).toMatchObject({ visits: 7, level: 4, levelName: '찐단골' })
  })
})

describe('toPlaceMarkers', () => {
  const { toPlaceMarkers } = helpers

  it('장소 행을 id, 이름, 좌표만 남긴 마커로 바꾸고 입력 순서를 지킨다', () => {
    const out = toPlaceMarkers([
      { id: 'p-1', name: '회사', lat: 37.49, lng: 127.02 },
      { id: 'p-2', name: '집', lat: 37.55, lng: 126.98 },
    ])
    expect(out).toEqual([
      { id: 'p-1', name: '회사', lat: 37.49, lng: 127.02 },
      { id: 'p-2', name: '집', lat: 37.55, lng: 126.98 },
    ])
  })

  it('좌표가 없거나 유한하지 않은 장소는 뺀다. 빈 입력은 빈 배열', () => {
    expect(toPlaceMarkers([])).toEqual([])
    expect(
      toPlaceMarkers([
        { id: 'p-1', name: '회사', lat: null, lng: 127.02 },
        { id: 'p-2', name: '집', lat: 37.55, lng: Number.NaN },
        { id: 'p-3', name: '학교', lat: 37.5, lng: 127.0 },
      ]).map((p) => p.id),
    ).toEqual(['p-3'])
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { geocode, searchRestaurants } from '@/places/google'
import { ExternalApiError } from '@/places/types'

const CENTER = { lat: 37.5, lng: 127.0 }

type Place = Record<string, unknown>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function place(id: string, lat = CENTER.lat, lng = CENTER.lng, extra: Place = {}): Place {
  return {
    id,
    displayName: { text: `식당 ${id}` },
    formattedAddress: `주소 ${id}`,
    location: { latitude: lat, longitude: lng },
    ...extra,
  }
}

function sentBody(call: unknown[]): Record<string, unknown> {
  return JSON.parse((call[1] as RequestInit).body as string)
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-google-key')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('google.searchRestaurants', () => {
  it('nextPageToken 이 없으면 첫 페이지에서 멈춘다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ places: [place('1'), place('2')] }))
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['1', '2'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentBody(fetchMock.mock.calls[0])).not.toHaveProperty('pageToken')
  })

  it('nextPageToken 을 다음 요청에 넘기고 최대 3페이지까지만 요청한다', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { pageToken?: string }
      const n = body.pageToken ? Number(body.pageToken.slice(1)) + 1 : 1
      return jsonResponse({ places: [place(`p${n}`)], nextPageToken: `t${n}` })
    })
    const found = await searchRestaurants(CENTER, 500)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.map((c) => sentBody(c).pageToken)).toEqual([undefined, 't1', 't2'])
    expect(found.map((f) => f.google_place_id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('2페이지에 토큰이 없으면 3페이지를 요청하지 않는다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ places: [place('a')], nextPageToken: 'tok' }))
      .mockResolvedValueOnce(jsonResponse({ places: [place('b')] }))
    const found = await searchRestaurants(CENTER, 500)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(found.map((f) => f.google_place_id)).toEqual(['a', 'b'])
  })

  it('요청에 API 키·필드 마스크 헤더를 붙이고 캐시하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ places: [] }))
    await searchRestaurants(CENTER, 500)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(init.method).toBe('POST')
    expect(headers['X-Goog-Api-Key']).toBe('test-google-key')
    expect(headers['X-Goog-FieldMask']).toContain('places.id')
    expect(init.cache).toBe('no-store')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(sentBody(fetchMock.mock.calls[0])).toMatchObject({
      locationBias: { circle: { center: { latitude: CENTER.lat, longitude: CENTER.lng }, radius: 500 } },
    })
  })

  it('반경 밖 식당과 중복 id 를 걸러낸다 (페이지 간 중복 포함)', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ places: [place('near'), place('far', CENTER.lat + 0.01), place('near')], nextPageToken: 't' }),
      )
      .mockResolvedValueOnce(jsonResponse({ places: [place('near'), place('near2', CENTER.lat + 0.001)] }))
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['near', 'near2'])
  })

  it('좌표가 유한한 숫자가 아닌 장소는 버린다', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        places: [
          place('ok'),
          { ...place('nan'), location: { latitude: NaN, longitude: 127 } },
          { ...place('str'), location: { latitude: '37.5', longitude: 'abc' } },
          { ...place('noloc'), location: undefined },
          { ...place('noid'), id: undefined },
          'garbage',
        ],
      }),
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['ok'])
    expect(found[0]).toMatchObject({ name: '식당 ok', address: '주소 ok', hours: null, hours_source: 'none' })
  })

  it('영업시간이 있으면 hours 로 변환하고 hours_source 를 google 로 표시한다', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        places: [
          place('h', CENTER.lat, CENTER.lng, {
            regularOpeningHours: {
              periods: [{ open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 21, minute: 0 } }],
            },
          }),
        ],
      }),
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found[0].hours_source).toBe('google')
    expect(found[0].hours?.mon).toEqual({ open: '11:00', close: '21:00' })
  })

  it('places 가 없으면 빈 배열', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    await expect(searchRestaurants(CENTER, 500)).resolves.toEqual([])
  })

  it('2xx 가 아니면 ExternalApiError (본문 앞부분 포함, status 보존)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"denied ' + 'x'.repeat(500) + '"}', { status: 403 }))
    const err = await searchRestaurants(CENTER, 500).catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.status).toBe(403)
    expect(err.message).toContain('HTTP 403')
    expect(err.message).toContain('denied')
    expect(err.message.length).toBeLessThan(300)
    expect(err.message).not.toContain('test-google-key')
  })

  it('네트워크 오류(TypeError)는 ExternalApiError 로 바뀐다', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const err = await searchRestaurants(CENTER, 500).catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.message).not.toContain('test-google-key')
  })

  it('최상위 형태가 다르면 ExternalApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ places: { id: 'x' } }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toThrow(/unexpected response shape/)

    fetchMock.mockResolvedValueOnce(jsonResponse([]))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('API 키가 없으면 fetch 전에 ExternalApiError', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '')
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('google.geocode', () => {
  it('OK 이면 첫 결과의 좌표', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'OK', results: [{ geometry: { location: { lat: 37.6, lng: 127.1 } } }] }),
    )
    await expect(geocode('서울시 어딘가')).resolves.toEqual({ lat: 37.6, lng: 127.1 })
    expect(fetchMock.mock.calls[0][0]).toContain('maps.googleapis.com/maps/api/geocode/json')
  })

  it('ZERO_RESULTS 이면 null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'ZERO_RESULTS', results: [] }))
    await expect(geocode('없는 곳')).resolves.toBeNull()
  })

  it('다른 status 는 ExternalApiError (키 노출 없음)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'REQUEST_DENIED', error_message: 'bad key' }))
    const err = await geocode('x').catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.message).toContain('REQUEST_DENIED')
    expect(err.message).not.toContain('test-google-key')
  })

  it('네트워크 오류는 ExternalApiError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(geocode('x')).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('최상위 형태가 다르거나 좌표가 숫자가 아니면 ExternalApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [] }))
    await expect(geocode('x')).rejects.toThrow(/unexpected response shape/)

    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'OK', results: [{ geometry: { location: { lat: 'a', lng: 1 } } }] }))
    await expect(geocode('x')).rejects.toThrow(/unexpected response shape/)
  })
})

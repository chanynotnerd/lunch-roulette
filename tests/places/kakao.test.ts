import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { geocode, searchRestaurants } from '@/places/kakao'
import { ExternalApiError } from '@/places/types'

const CENTER = { lat: 37.5, lng: 127.0 }

type Doc = Record<string, unknown>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function page(documents: Doc[], isEnd: boolean) {
  return { documents, meta: { is_end: isEnd, total_count: documents.length } }
}

function doc(id: string, lat = CENTER.lat, lng = CENTER.lng, extra: Doc = {}): Doc {
  return { id, place_name: `식당 ${id}`, road_address_name: `도로명 ${id}`, x: String(lng), y: String(lat), ...extra }
}

function pageParam(url: string): string | null {
  return new URL(url).searchParams.get('page')
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('KAKAO_REST_API_KEY', 'test-kakao-key')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('kakao.searchRestaurants', () => {
  it('is_end 가 true 이면 첫 페이지에서 멈춘다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([doc('1'), doc('2')], true)))
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:1', 'kakao:2'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pageParam(fetchMock.mock.calls[0][0] as string)).toBe('1')
  })

  it('is_end 가 false 여도 최대 3페이지까지만 요청한다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const p = pageParam(url)
      return jsonResponse(page([doc(`p${p}`)], false))
    })
    const found = await searchRestaurants(CENTER, 500)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.map((c) => pageParam(c[0] as string))).toEqual(['1', '2', '3'])
    expect(found).toHaveLength(3)
  })

  it('2페이지에서 is_end 이면 3페이지를 요청하지 않는다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page([doc('a')], false)))
      .mockResolvedValueOnce(jsonResponse(page([doc('b')], true)))
    const found = await searchRestaurants(CENTER, 500)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:a', 'kakao:b'])
  })

  it('요청에 API 키 헤더를 붙이고 캐시하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([], true)))
    await searchRestaurants(CENTER, 500)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('KakaoAK test-kakao-key')
    expect(init.cache).toBe('no-store')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('반경 밖 식당과 중복 id 를 걸러낸다', async () => {
    // 위도 0.01도 ≈ 1.1km
    fetchMock.mockResolvedValueOnce(
      jsonResponse(page([doc('near'), doc('far', CENTER.lat + 0.01), doc('near'), doc('near2', CENTER.lat + 0.001)], true)),
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:near', 'kakao:near2'])
  })

  it('좌표가 숫자가 아닌 문서는 버린다', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        page(
          [
            doc('ok'),
            { ...doc('nan'), x: 'abc' },
            { ...doc('empty'), y: '' },
            { ...doc('missing'), x: undefined },
            { ...doc('noid'), id: undefined },
          ],
          true,
        ),
      ),
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:ok'])
    expect(found[0]).toMatchObject({
      name: '식당 ok',
      address: '도로명 ok',
      lat: CENTER.lat,
      lng: CENTER.lng,
      hours_source: 'default',
    })
    expect(found[0].hours).not.toBeNull()
  })

  it('road_address_name 이 없으면 address_name 을 쓴다', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(page([doc('x', CENTER.lat, CENTER.lng, { road_address_name: '', address_name: '지번 주소' })], true)),
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found[0].address).toBe('지번 주소')
  })

  it('2xx 가 아니면 ExternalApiError (본문 앞부분 포함, status 보존)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('quota exceeded ' + 'x'.repeat(500), { status: 429 }))
    const err = await searchRestaurants(CENTER, 500).catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.status).toBe(429)
    expect(err.message).toContain('HTTP 429')
    expect(err.message).toContain('quota exceeded')
    expect(err.message.length).toBeLessThan(300)
    expect(err.message).not.toContain('test-kakao-key')
  })

  it('네트워크 오류(TypeError)는 ExternalApiError 로 바뀐다', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const err = await searchRestaurants(CENTER, 500).catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.message).toContain('fetch failed')
  })

  it('타임아웃(AbortError)도 ExternalApiError 로 바뀐다', async () => {
    const abort = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    fetchMock.mockRejectedValueOnce(abort)
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('최상위 형태가 다르면 ExternalApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ meta: { is_end: true } }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toThrow(/unexpected response shape/)

    fetchMock.mockResolvedValueOnce(jsonResponse({ documents: 'nope' }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)

    fetchMock.mockResolvedValueOnce(jsonResponse(null))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('JSON 이 아닌 본문은 ExternalApiError', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('API 키가 없으면 fetch 전에 ExternalApiError', async () => {
    vi.stubEnv('KAKAO_REST_API_KEY', '')
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('kakao.geocode', () => {
  it('주소 검색 결과가 있으면 그 좌표를 돌려준다', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([{ x: '127.1', y: '37.6' }], true)))
    await expect(geocode('서울시 어딘가')).resolves.toEqual({ lat: 37.6, lng: 127.1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/v2/local/search/address.json')
  })

  it('주소 검색이 비면 키워드 검색으로 폴백한다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page([], true)))
      .mockResolvedValueOnce(jsonResponse(page([{ x: '127.2', y: '37.7' }], true)))
    await expect(geocode('회사')).resolves.toEqual({ lat: 37.7, lng: 127.2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain('/v2/local/search/keyword.json')
  })

  it('둘 다 비면 null', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(page([], true)))
    await expect(geocode('없는 곳')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('좌표가 NaN 이면 결과로 쓰지 않는다', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page([{ x: 'abc', y: '37.6' }], true)))
      .mockResolvedValueOnce(jsonResponse(page([{ x: 'abc', y: 'def' }], true)))
    await expect(geocode('이상한 곳')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('최상위 형태가 다르면 ExternalApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'bad' }))
    await expect(geocode('x')).rejects.toBeInstanceOf(ExternalApiError)
  })
})

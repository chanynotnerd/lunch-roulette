import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEYWORDS, geocode, searchRestaurants } from '@/places/kakao'
import { ExternalApiError } from '@/places/types'

const CENTER = { lat: 37.5, lng: 127.0 }
const KEYWORD_PATH = '/v2/local/search/keyword.json'

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

/** 요청 URL에서 이 테스트가 보는 파라미터만 뽑는다. */
type Q = {
  path: string
  query: string | null
  category: string | null
  rect: string | null
  radius: string | null
  page: number
  sort: string | null
  x: string | null
  y: string | null
  size: string | null
}

function parseCall(url: string): Q {
  const u = new URL(url)
  const g = (k: string) => u.searchParams.get(k)
  return {
    path: u.pathname,
    query: g('query'),
    category: g('category_group_code'),
    rect: g('rect'),
    radius: g('radius'),
    page: Number(g('page') ?? '1'),
    sort: g('sort'),
    x: g('x'),
    y: g('y'),
    size: g('size'),
  }
}

let fetchMock: ReturnType<typeof vi.fn>

function calls(): Q[] {
  return fetchMock.mock.calls.map((c) => parseCall(c[0] as string))
}

/**
 * 모의 fetch 를 URL 파라미터로 분기한다.
 * 핸들러가 Doc[] 를 돌려주면 is_end=true 한 페이지, { docs, isEnd } 면 그대로, Response 면 그대로 응답.
 */
function route(handler: (q: Q) => Doc[] | { docs: Doc[]; isEnd: boolean } | Response): void {
  fetchMock.mockImplementation(async (url: string) => {
    const out = handler(parseCall(url))
    if (out instanceof Response) return out
    if (Array.isArray(out)) return jsonResponse(page(out, true))
    return jsonResponse(page(out.docs, out.isEnd))
  })
}

const SORTED_KEYWORDS = [...KEYWORDS].sort()

beforeEach(() => {
  vi.stubEnv('KAKAO_REST_API_KEY', 'test-kakao-key')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('kakao.searchRestaurants', () => {
  it('500m 이하: 키워드 9개를 radius 로 질의하고 rect 는 없다', async () => {
    route((q) => (q.query === '음식점' ? [doc('1')] : []))
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:1'])

    const qs = calls()
    expect(qs).toHaveLength(9)
    expect(qs.map((q) => q.query).sort()).toEqual(SORTED_KEYWORDS)
    for (const q of qs) {
      expect(q.path).toBe(KEYWORD_PATH)
      expect(q.category).toBe('FD6')
      expect(q.radius).toBe('500')
      expect(q.rect).toBeNull()
      expect(q.sort).toBe('distance')
      expect(q.x).toBe('127')
      expect(q.y).toBe('37.5')
      expect(q.size).toBe('15')
      expect(q.page).toBe(1)
    }
  })

  it('800m: rect 4개 × 키워드 9개 = 36 작업, radius 없음, 성공 로그 한 줄', async () => {
    route(() => [])
    await searchRestaurants(CENTER, 800)

    const qs = calls()
    expect(qs).toHaveLength(36)
    const rects = new Set(qs.map((q) => q.rect))
    expect(rects.size).toBe(4)
    expect(rects.has(null)).toBe(false)
    for (const rect of rects) {
      expect(qs.filter((q) => q.rect === rect).map((q) => q.query).sort()).toEqual(SORTED_KEYWORDS)
    }
    for (const q of qs) {
      expect(q.radius).toBeNull()
      expect(q.category).toBe('FD6')
      expect(q.sort).toBe('distance')
      expect(q.x).toBe('127')
    }
    expect(console.info).toHaveBeenCalledTimes(1)
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/^\[kakao\.searchRestaurants\] radius=800 cells=4 calls=36 raw=0 unique=0 capped=0 ms=\d+$/),
    )
  })

  it('작업별로 is_end 면 다음 페이지를 요청하지 않고 최대 3페이지', async () => {
    route((q) => {
      if (q.query === '한식') return { docs: [doc(`h${q.page}`)], isEnd: false }
      if (q.query === '중식') return { docs: [doc(`c${q.page}`)], isEnd: q.page === 2 }
      return []
    })
    const found = await searchRestaurants(CENTER, 500)
    const pagesOf = (keyword: string) => calls().filter((q) => q.query === keyword).map((q) => q.page)
    expect(pagesOf('한식')).toEqual([1, 2, 3])
    expect(pagesOf('중식')).toEqual([1, 2])
    expect(pagesOf('일식')).toEqual([1])
    expect(calls()).toHaveLength(3 + 2 + 7)
    expect(found.map((f) => f.google_place_id).sort()).toEqual(['kakao:c1', 'kakao:c2', 'kakao:h1', 'kakao:h2', 'kakao:h3'])
  })

  it('여러 키워드에 같은 id 가 나와도 결과에는 한 번만', async () => {
    route((q) => (q.query === '음식점' || q.query === '한식' || q.query === '술집' ? [doc('same')] : []))
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:same'])
  })

  it('200개를 넘으면 거리순 200개', async () => {
    // 키워드 9개 × 3페이지 × 15개 = 405개, 전부 다른 id, 중심에서 1.1m 씩 멀어진다 (최대 약 450m).
    route((q) => {
      const k = KEYWORDS.indexOf(q.query as (typeof KEYWORDS)[number])
      const docs = Array.from({ length: 15 }, (_, i) => {
        const n = k * 45 + (q.page - 1) * 15 + i
        return doc(`n${n}`, CENTER.lat + n * 0.00001)
      })
      return { docs, isEnd: q.page === 3 }
    })
    const found = await searchRestaurants(CENTER, 500)
    expect(calls()).toHaveLength(27)
    expect(found).toHaveLength(200)
    expect(found[0].google_place_id).toBe('kakao:n0')
    expect(found[199].google_place_id).toBe('kakao:n199')
    for (let i = 1; i < found.length; i++) expect(found[i].lat).toBeGreaterThanOrEqual(found[i - 1].lat)
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/ radius=500 cells=1 calls=27 raw=405 unique=405 capped=200 /),
    )
  })

  it('작업 하나가 429 면 전체 ExternalApiError, status 보존, 메시지에 키 없음, 실패 로그', async () => {
    route((q) =>
      q.query === '술집' ? new Response('quota exceeded ' + 'x'.repeat(500), { status: 429 }) : [],
    )
    const err = await searchRestaurants(CENTER, 500).catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.status).toBe(429)
    expect(err.message).toContain('HTTP 429')
    expect(err.message).toContain('quota exceeded')
    expect(err.message.length).toBeLessThan(300)
    expect(err.message).not.toContain('test-kakao-key')
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[kakao\.searchRestaurants\] job failed cell=0 keyword=술집: Kakao .*HTTP 429/),
    )
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('test-kakao-key'))
  })

  it('요청에 API 키 헤더를 붙이고 캐시하지 않는다', async () => {
    route(() => [])
    await searchRestaurants(CENTER, 500)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('KakaoAK test-kakao-key')
    expect(init.cache).toBe('no-store')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('반경 밖 식당과 중복 id 를 걸러낸다', async () => {
    // 위도 0.01도 ≈ 1.1km
    route((q) =>
      q.query === '음식점'
        ? [doc('near'), doc('far', CENTER.lat + 0.01), doc('near'), doc('near2', CENTER.lat + 0.001)]
        : [],
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found.map((f) => f.google_place_id)).toEqual(['kakao:near', 'kakao:near2'])
  })

  it('좌표가 숫자가 아니거나 id 가 없는 문서는 버린다', async () => {
    route((q) =>
      q.query === '음식점'
        ? [
            doc('ok'),
            { ...doc('nan'), x: 'abc' },
            { ...doc('empty'), y: '' },
            { ...doc('missing'), x: undefined },
            { ...doc('noid'), id: undefined },
            { ...doc('emptyid'), id: '' },
          ]
        : [],
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
    route((q) =>
      q.query === '음식점' ? [doc('x', CENTER.lat, CENTER.lng, { road_address_name: '', address_name: '지번 주소' })] : [],
    )
    const found = await searchRestaurants(CENTER, 500)
    expect(found[0].address).toBe('지번 주소')
  })

  it('네트워크 오류(TypeError)는 ExternalApiError 로 바뀐다', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const err = await searchRestaurants(CENTER, 500).catch((e) => e)
    expect(err).toBeInstanceOf(ExternalApiError)
    expect(err.message).toContain('fetch failed')
  })

  it('타임아웃(AbortError)도 ExternalApiError 로 바뀐다', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('최상위 형태가 다르면 ExternalApiError', async () => {
    // 작업이 동시에 여러 개 돌므로 호출마다 새 Response 를 만든다 (본문은 한 번만 읽을 수 있다)
    fetchMock.mockImplementation(async () => jsonResponse({ meta: { is_end: true } }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toThrow(/unexpected response shape/)

    fetchMock.mockImplementation(async () => jsonResponse({ documents: 'nope' }))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)

    fetchMock.mockImplementation(async () => jsonResponse(null))
    await expect(searchRestaurants(CENTER, 500)).rejects.toBeInstanceOf(ExternalApiError)
  })

  it('JSON 이 아닌 본문은 ExternalApiError', async () => {
    fetchMock.mockImplementation(async () => new Response('<html>', { status: 200 }))
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

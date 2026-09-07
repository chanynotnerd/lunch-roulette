import { capByDistance, gridCells, mapWithConcurrency, type Cell } from './collect'
import { distanceMeters } from './distance'
import { fetchExternalJson, finiteNumber, isRecord } from './http'
import { ExternalApiError, type FoundRestaurant, type LatLng } from './types'
import { DEFAULT_HOURS } from '@/config/default-hours'

/**
 * 카카오 로컬 API 어댑터 (스펙 09 대안, D17).
 * - 주소 → 좌표: /v2/local/search/address.json, 실패 시 /v2/local/search/keyword.json
 * - 식당 검색: /v2/local/search/keyword.json, category_group_code=FD6, 페이지당 15개, 작업당 최대 3페이지.
 *   카카오는 질의당 45개가 상한이라 키워드 9개 × 셀(500m 이하 radius 1개, 초과 2×2 rect 4개)로 나눠
 *   동시 5개씩 호출하고 id 로 합친 뒤 거리순 200개까지 남긴다. (스펙 17, D18)
 * 카카오는 영업시간을 주지 않으므로 hours 는 DEFAULT_HOURS 를 넣고 hours_source 를 'default' 로 표시한다.
 * 정확한 영업시간은 data/hours-overrides.json 으로 덮어쓴다. (스펙 10)
 * 저장 키는 `kakao:<id>` 형식이다.
 */

/** 카카오 카테고리 2단계 이름. "음식점"은 세분류에 안 걸리는 가게용. (스펙 17 E2) */
export const KEYWORDS = ['음식점', '한식', '중식', '일식', '양식', '분식', '아시아음식', '패스트푸드', '술집'] as const
const MAX_PAGES = 3
const PAGE_SIZE = 15
const MAX_RESTAURANTS = 200
const CONCURRENCY = 5
const KEYWORD_PATH = '/v2/local/search/keyword.json'

function apiKey(): string {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) throw new ExternalApiError('KAKAO_REST_API_KEY is not set')
  return key
}

type KakaoPage = { documents: Record<string, unknown>[]; isEnd: boolean }

/** 최상위 형태 검증: documents 가 배열이어야 한다. meta.is_end 는 없으면 true 로 본다(더 요청하지 않음). */
function parsePage(path: string, json: unknown): KakaoPage {
  if (!isRecord(json) || !Array.isArray(json.documents)) {
    throw new ExternalApiError(`Kakao ${path} unexpected response shape`)
  }
  const meta = isRecord(json.meta) ? json.meta : null
  const isEnd = meta?.is_end === undefined ? true : meta.is_end === true
  return { documents: json.documents.filter(isRecord), isEnd }
}

async function kakaoGet(key: string, path: string, params: Record<string, string | number>): Promise<KakaoPage> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  const json = await fetchExternalJson(`Kakao ${path}`, `https://dapi.kakao.com${path}?${qs}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  })
  return parsePage(path, json)
}

/** 카카오 문서의 x(경도)/y(위도) 문자열을 좌표로. 유한하지 않으면 null. */
function toLatLng(doc: Record<string, unknown>): LatLng | null {
  const lat = finiteNumber(doc.y)
  const lng = finiteNumber(doc.x)
  if (lat === null || lng === null) return null
  return { lat, lng }
}

export async function geocode(address: string): Promise<LatLng | null> {
  const key = apiKey()
  const byAddress = await kakaoGet(key, '/v2/local/search/address.json', { query: address, size: 1 })
  const a = byAddress.documents[0]
  if (a) {
    const point = toLatLng(a)
    if (point) return point
  }

  const byKeyword = await kakaoGet(key, KEYWORD_PATH, { query: address, size: 1 })
  const k = byKeyword.documents[0]
  if (k) return toLatLng(k)
  return null
}

/** (셀, 키워드) 한 쌍이 작업 하나. cellIndex 는 실패 로그용. */
type Job = { cellIndex: number; cell: Cell; keyword: string }
type JobResult = { documents: Record<string, unknown>[]; calls: number }

/** 셀 종류에 따른 위치 파라미터. rect 셀도 x/y 와 sort=distance 를 같이 보낸다(스파이크 항목 1에서 확인). */
function cellParams(center: LatLng, radiusM: number, cell: Cell): Record<string, string | number> {
  if (cell.kind === 'radius') {
    return { x: center.lng, y: center.lat, radius: Math.min(Math.max(radiusM, 0), 20000), sort: 'distance' }
  }
  return { rect: cell.rect, x: center.lng, y: center.lat, sort: 'distance' }
}

/** 작업 하나: 페이지 1→3 순차, is_end 면 멈춤. 실패하면 셀 번호와 키워드를 로그에 남기고 그대로 던진다. */
async function runJob(key: string, center: LatLng, radiusM: number, job: Job): Promise<JobResult> {
  const documents: Record<string, unknown>[] = []
  let calls = 0
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      calls++
      const res = await kakaoGet(key, KEYWORD_PATH, {
        query: job.keyword,
        category_group_code: 'FD6',
        size: PAGE_SIZE,
        page,
        ...cellParams(center, radiusM, job.cell),
      })
      documents.push(...res.documents)
      if (res.isEnd) break
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[kakao.searchRestaurants] job failed cell=${job.cellIndex} keyword=${job.keyword}: ${message}`)
    throw e
  }
  return { documents, calls }
}

/** 카카오 문서 하나를 FoundRestaurant 로. id 나 좌표가 없거나 반경 밖이면 null. */
function toFound(center: LatLng, radiusM: number, p: Record<string, unknown>): FoundRestaurant | null {
  if (typeof p.id !== 'string' || p.id === '') return null
  const point = toLatLng(p)
  if (!point) return null
  if (distanceMeters(center, point) > radiusM) return null
  return {
    google_place_id: `kakao:${p.id}`,
    name: typeof p.place_name === 'string' ? p.place_name : '',
    address:
      (typeof p.road_address_name === 'string' && p.road_address_name) ||
      (typeof p.address_name === 'string' && p.address_name) ||
      '',
    lat: point.lat,
    lng: point.lng,
    hours: DEFAULT_HOURS,
    hours_source: 'default',
  }
}

export async function searchRestaurants(center: LatLng, radiusM: number): Promise<FoundRestaurant[]> {
  const key = apiKey()
  const started = Date.now()
  const cells = gridCells(center, radiusM)
  const jobs: Job[] = cells.flatMap((cell, cellIndex) => KEYWORDS.map((keyword) => ({ cellIndex, cell, keyword })))

  const results = await mapWithConcurrency(jobs, CONCURRENCY, (job) => runJob(key, center, radiusM, job))

  const seen = new Map<string, FoundRestaurant>()
  let raw = 0
  let calls = 0
  for (const r of results) {
    calls += r.calls
    raw += r.documents.length
    for (const p of r.documents) {
      const found = toFound(center, radiusM, p)
      if (found && !seen.has(found.google_place_id)) seen.set(found.google_place_id, found)
    }
  }
  const capped = capByDistance(center, [...seen.values()], MAX_RESTAURANTS)
  console.info(
    `[kakao.searchRestaurants] radius=${radiusM} cells=${cells.length} calls=${calls} raw=${raw} unique=${seen.size} capped=${capped.length} ms=${Date.now() - started}`,
  )
  return capped
}

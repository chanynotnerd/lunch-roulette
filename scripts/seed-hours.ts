/**
 * 영업시간 보정 시드 스크립트 (스펙 10)
 *
 *   npm run seed:hours                 data/hours-overrides.json 을 restaurants 에 반영
 *   npm run seed:hours -- --reset <key>
 *                                      해당 식당을 DEFAULT_HOURS + hours_source='default' 로 되돌림
 *
 * 보정 파일의 키는 restaurants.google_place_id 컬럼 값이다.
 *   - 카카오 로컬 API(D17)로 들어온 식당: "kakao:<카카오 장소 id>"  (예: "kakao:12345678")
 *   - Google Places 로 들어온 식당:          "ChIJ…" 형식의 place id
 * 두 형식 중 어느 쪽도 아닌 키는 경고만 내고 그대로 진행한다(행이 없으면 건너뜀으로 출력됨).
 *
 * 형식 검증은 src/rules/hours-schema.ts 의 validateHours 를 쓴다. 항목을 전부 검증한 뒤 하나라도 오류가 있으면
 * 아무것도 쓰지 않는다.
 *
 * .env.local 의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 읽는다.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_HOURS } from '../src/config/default-hours'
import { isPlainObject, validateHours } from '../src/rules/hours-schema'

const ROOT = resolve(__dirname, '..')
const OVERRIDES_PATH = resolve(ROOT, 'data', 'hours-overrides.json')
const KEY_RE = /^(kakao:.+|ChIJ.+)$/

function loadEnvLocal(): void {
  const path = resolve(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function warnKeyFormat(key: string): void {
  if (!KEY_RE.test(key)) {
    console.warn(`경고: ${key}: 키가 "kakao:<id>" 나 "ChIJ…" 형식이 아닙니다. google_place_id 와 일치하는지 확인하세요.`)
  }
}

function validateEntry(placeId: string, entry: unknown, errors: string[]): void {
  if (!isPlainObject(entry)) {
    errors.push(`${placeId}: 객체가 아닙니다`)
    return
  }
  errors.push(...validateHours(entry.hours, `${placeId}.hours`))
}

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env.local)')
    process.exit(1)
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function reset(placeId: string): Promise<void> {
  warnKeyFormat(placeId)
  const supabase = makeClient()
  const { data, error } = await supabase
    .from('restaurants')
    .update({ hours: DEFAULT_HOURS, hours_source: 'default' })
    .eq('google_place_id', placeId)
    .select('id')
  if (error) {
    console.error(`reset 실패: ${error.message}`)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.log(`건너뜀 (행 없음): ${placeId}`)
    return
  }
  console.log(`기본 영업시간(DEFAULT_HOURS, hours_source=default) 으로 되돌림: ${placeId}`)
}

async function apply(): Promise<void> {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
  } catch (e) {
    console.error(`보정 파일을 읽을 수 없습니다: ${OVERRIDES_PATH}`)
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
  if (!isPlainObject(parsed)) {
    console.error('보정 파일의 최상위는 객체여야 합니다')
    process.exit(1)
  }

  const errors: string[] = []
  for (const [placeId, entry] of Object.entries(parsed)) {
    warnKeyFormat(placeId)
    validateEntry(placeId, entry, errors)
  }
  if (errors.length) {
    console.error(`보정 파일 형식 오류 ${errors.length}건. 아무것도 쓰지 않습니다.`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  const entries = Object.entries(parsed) as [string, { hours: unknown }][]
  if (entries.length === 0) {
    console.log('보정 항목이 없습니다. 적용 0건.')
    return
  }

  const supabase = makeClient()
  const skipped: string[] = []
  let applied = 0
  for (const [placeId, entry] of entries) {
    const { data, error } = await supabase
      .from('restaurants')
      .update({ hours: entry.hours, hours_source: 'override' })
      .eq('google_place_id', placeId)
      .select('id')
    if (error) {
      console.error(`${placeId}: 갱신 실패 - ${error.message}`)
      process.exit(1)
    }
    if (!data || data.length === 0) {
      skipped.push(placeId)
    } else {
      applied += 1
    }
  }

  console.log(`적용 ${applied}건, 건너뜀 ${skipped.length}건 (전체 ${entries.length}건)`)
  if (skipped.length) {
    console.log('건너뜀 (restaurants 에 행 없음):')
    for (const id of skipped) console.log(`  - ${id}`)
  }
}

async function main(): Promise<void> {
  loadEnvLocal()
  const args = process.argv.slice(2)
  const resetIdx = args.indexOf('--reset')
  if (resetIdx >= 0) {
    const placeId = args[resetIdx + 1]
    if (!placeId) {
      console.error('사용법: npm run seed:hours -- --reset <kakao:<id> 또는 ChIJ…>')
      process.exit(1)
    }
    await reset(placeId)
    return
  }
  await apply()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})

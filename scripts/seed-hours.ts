/**
 * 영업시간 보정 시드 스크립트 (스펙 10)
 *
 *   npm run seed:hours                 data/hours-overrides.json 을 restaurants 에 반영
 *   npm run seed:hours -- --reset <google_place_id>
 *                                      해당 식당의 hours_source 를 google 로 되돌림
 *
 * .env.local 의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 읽는다.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { DAY_KEYS } from '../src/rules/types'

const ROOT = resolve(__dirname, '..')
const OVERRIDES_PATH = resolve(ROOT, 'data', 'hours-overrides.json')
const TIME_RE = /^([01]\d|2[0-4]):[0-5]\d$/

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateDay(day: unknown, path: string, errors: string[]): void {
  if (!isRecord(day)) {
    errors.push(`${path}: 객체가 아닙니다`)
    return
  }
  if (day.closed === true) {
    const extra = Object.keys(day).filter((k) => k !== 'closed')
    if (extra.length) errors.push(`${path}: closed 와 함께 다른 키(${extra.join(', ')})가 있습니다`)
    return
  }
  if (typeof day.open !== 'string' || !TIME_RE.test(day.open)) {
    errors.push(`${path}.open: "HH:MM" 형식이 아닙니다 (${String(day.open)})`)
  }
  if (typeof day.close !== 'string' || !TIME_RE.test(day.close)) {
    errors.push(`${path}.close: "HH:MM" 형식이 아닙니다 (${String(day.close)})`)
  }
  if (day.break !== undefined) {
    if (!isRecord(day.break)) {
      errors.push(`${path}.break: 객체가 아닙니다`)
    } else {
      if (typeof day.break.start !== 'string' || !TIME_RE.test(day.break.start)) {
        errors.push(`${path}.break.start: "HH:MM" 형식이 아닙니다`)
      }
      if (typeof day.break.end !== 'string' || !TIME_RE.test(day.break.end)) {
        errors.push(`${path}.break.end: "HH:MM" 형식이 아닙니다`)
      }
    }
  }
}

function validateEntry(placeId: string, entry: unknown, errors: string[]): void {
  if (!isRecord(entry)) {
    errors.push(`${placeId}: 객체가 아닙니다`)
    return
  }
  const hours = entry.hours
  if (!isRecord(hours)) {
    errors.push(`${placeId}.hours: 객체가 아닙니다`)
    return
  }
  for (const key of DAY_KEYS) {
    if (!(key in hours)) {
      errors.push(`${placeId}.hours.${key}: 요일이 빠졌습니다`)
      continue
    }
    validateDay(hours[key], `${placeId}.hours.${key}`, errors)
  }
  const unknown = Object.keys(hours).filter((k) => !(DAY_KEYS as readonly string[]).includes(k))
  if (unknown.length) errors.push(`${placeId}.hours: 알 수 없는 요일 키(${unknown.join(', ')})`)
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
  const supabase = makeClient()
  const { data, error } = await supabase
    .from('restaurants')
    .update({ hours_source: 'google' })
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
  console.log(`hours_source 를 google 로 되돌림: ${placeId}`)
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
  if (!isRecord(parsed)) {
    console.error('보정 파일의 최상위는 객체여야 합니다')
    process.exit(1)
  }

  const errors: string[] = []
  for (const [placeId, entry] of Object.entries(parsed)) validateEntry(placeId, entry, errors)
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
      console.error('사용법: npm run seed:hours -- --reset <google_place_id>')
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

import { SLOTS } from '@/config/slots'
import { seoulClock } from '@/rules/time'
import type { Slot } from '@/rules/types'

const SLOT_ORDER: Slot[] = ['lunch', 'dinner']

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 현재 시각(Asia/Seoul)이 속한 슬롯. 시작 포함, 끝 미포함. 없으면 null. */
export function getSlot(now: Date): { slot: Slot; slotDate: string } | null {
  const { dateStr, minutes } = seoulClock(now)
  for (const slot of SLOT_ORDER) {
    const { start, end } = SLOTS[slot]
    if (start <= minutes && minutes < end) return { slot, slotDate: dateStr }
  }
  return null
}

/**
 * 다음 슬롯 시작 시각 "HH:MM".
 * 슬롯 안이면 그 슬롯의 시작, 슬롯 사이면 다음 슬롯 시작, 마지막 슬롯 끝 이후면 다음 날 첫 슬롯 시작.
 */
export function nextSlotStart(now: Date): string {
  const { minutes } = seoulClock(now)
  for (const slot of SLOT_ORDER) {
    const { start, end } = SLOTS[slot]
    if (minutes < end) return fmt(start)
  }
  return fmt(SLOTS[SLOT_ORDER[0]].start)
}

/** 세션의 슬롯이 끝났는지. now의 서울 날짜가 slotDate 이후이거나, 같은 날이고 슬롯 끝 시각 이상이면 true. */
export function isSlotEnded(slot: Slot, slotDate: string, now: Date): boolean {
  const { dateStr, minutes } = seoulClock(now)
  if (dateStr > slotDate) return true
  if (dateStr < slotDate) return false
  return minutes >= SLOTS[slot].end
}

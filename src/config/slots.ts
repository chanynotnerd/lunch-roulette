import type { Slot } from '@/rules/types'

export const SLOTS: Record<Slot, { start: number; end: number; label: string }> = {
  lunch: { start: 11 * 60, end: 15 * 60, label: '점심' },
  dinner: { start: 17 * 60, end: 21 * 60, label: '저녁' },
}

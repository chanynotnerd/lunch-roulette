import { LEVELS } from '@/config/levels'

/**
 * 경험치(확정 횟수)를 레벨로 환산한다. 스펙 05.
 * 레벨 = 필요 경험치가 xp 이하인 가장 높은 단계. nextIn = 다음 단계 필요 경험치 − xp, 최고 레벨이면 null.
 */
export function getLevel(xp: number): { level: number; name: string; nextIn: number | null } {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (LEVELS[i].xp <= xp) idx = i
  }
  const current = LEVELS[idx]
  const next = LEVELS[idx + 1]
  return {
    level: current.level,
    name: current.name,
    nextIn: next ? next.xp - xp : null,
  }
}

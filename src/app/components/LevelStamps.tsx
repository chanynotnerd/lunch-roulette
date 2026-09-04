import { LEVELS } from '@/config/levels'

type Props = {
  level: number
  levelName: string
  nextIn: number | null
  /** 식권 절취선 영역용. 세로 배치, "다음 레벨까지" 숨김. */
  compact?: boolean
}

/** 레벨을 도장 5칸으로 보여 준다. 찍힌 칸 수가 레벨이다. 스펙 15. */
export default function LevelStamps({ level, levelName, nextIn, compact = false }: Props) {
  const label = `레벨 ${level} ${levelName}${nextIn !== null ? `, 다음 레벨까지 ${nextIn}회` : ''}`
  return (
    <span className={compact ? 'stamps stamps-compact' : 'stamps'} role="img" aria-label={label}>
      <span className="stamps-row" aria-hidden="true">
        {LEVELS.map((l) => (
          <span key={l.level} className={l.level <= level ? 'stamp is-on' : 'stamp'} />
        ))}
      </span>
      <span className="stamps-name" aria-hidden="true">
        {levelName}
      </span>
      {!compact && nextIn !== null && (
        <span className="stamps-next" aria-hidden="true">
          다음 레벨까지 {nextIn}회
        </span>
      )}
    </span>
  )
}

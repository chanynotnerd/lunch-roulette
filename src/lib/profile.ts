import 'server-only'
import { createClient } from '@/lib/supabase/server'

/** 내 정보 화면이 쓰는 프로필. 스펙 18 "데이터". */
export type Profile = {
  /** full_name → name → 이메일 @ 앞 → "사용자" */
  name: string
  email: string | null
  /** avatar_url → picture → null */
  avatarUrl: string | null
  /** 사진이 없을 때 원 안에 넣는 이름 첫 코드 포인트 */
  initial: string
}

/** Supabase User 중 프로필에 필요한 부분만. 테스트에서 통째로 만들기 쉽도록 좁혀 둔다. */
export type ProfileSource = {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

const FALLBACK_NAME = '사용자'

/** 문자열이고 공백을 뗀 뒤 비어 있지 않으면 그 값, 아니면 null. */
function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Google 메타데이터에서 Profile을 만든다. 순수 함수. */
export function toProfile(user: ProfileSource): Profile {
  const meta = user.user_metadata ?? {}
  const email = nonEmptyString(user.email) ?? nonEmptyString(meta.email)
  const name =
    nonEmptyString(meta.full_name) ??
    nonEmptyString(meta.name) ??
    nonEmptyString(email?.split('@')[0]) ??
    FALLBACK_NAME
  const avatarUrl = nonEmptyString(meta.avatar_url) ?? nonEmptyString(meta.picture)
  return { name, email, avatarUrl, initial: [...name][0] ?? '' }
}

/** 현재 요청의 프로필. 비로그인이면 null. 화면 전용이며 서버 액션은 requireUser를 쓴다. */
export async function loadProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return toProfile(user)
}

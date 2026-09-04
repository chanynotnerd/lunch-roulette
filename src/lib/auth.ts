import { createClient } from '@/lib/supabase/server'

export type AuthUser = { id: string; email: string | null }

/**
 * 현재 요청의 로그인 사용자를 돌려준다. 비로그인이면 null.
 * 서버 액션은 이 값이 null이면 AUTH_REQUIRED로 거절한다.
 */
export async function requireUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { id: user.id, email: user.email ?? null }
}

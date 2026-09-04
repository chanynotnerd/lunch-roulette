import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * 요청 쿠키에 묶인 Supabase 서버 클라이언트.
 * 서버 컴포넌트, 서버 액션, 라우트 핸들러에서 사용한다.
 * 환경변수는 호출 시점에 읽는다(빌드 타임에 env가 없어도 되도록).
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다.
            // 미들웨어가 세션을 갱신하므로 무시해도 된다.
          }
        },
      },
    },
  )
}

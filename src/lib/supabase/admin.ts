import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * 서비스 롤 키를 쓰는 관리자 클라이언트. RLS를 우회한다.
 * 모든 쓰기는 이 클라이언트로만 수행한다. 브라우저에 절대 노출되지 않는다.
 * 환경변수는 호출 시점에 읽는다(빌드 타임에 env가 없어도 되도록).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}

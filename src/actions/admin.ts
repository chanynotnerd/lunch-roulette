'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { isAdminEmail } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { seoulClock } from '@/rules/time'

/** 오늘(Asia/Seoul) 본인의 룰렛 세션을 모두 지운다. 테스트용. 관리자만 가능. */
export async function resetTodaySessions(): Promise<Result<{ deleted: number }>> {
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  // 스펙 08에 관리자 전용 거절 코드가 없어 가장 가까운 PLACE_FORBIDDEN을 쓴다(백로그).
  if (!isAdminEmail(user.email)) return fail('PLACE_FORBIDDEN')
  try {
    const admin = createAdminClient()
    const today = seoulClock(new Date()).dateStr
    const { error, count } = await admin
      .from('roulette_sessions')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
      .eq('slot_date', today)
    if (error) throw error
    revalidatePath('/')
    revalidatePath('/records')
    return ok({ deleted: count ?? 0 })
  } catch (e) {
    console.error('[admin] resetTodaySessions', e)
    return fail('UNEXPECTED')
  }
}

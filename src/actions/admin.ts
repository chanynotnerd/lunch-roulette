'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { fail, ok, type Result } from '@/lib/result'
import { createAdminClient } from '@/lib/supabase/admin'
import { seoulClock } from '@/rules/time'

/** ADMIN_EMAILS(쉼표 구분)에 포함된 이메일만 관리자다. 미설정이면 아무도 아니다. */
export async function isAdminEmail(email: string | null): Promise<boolean> {
  if (!email) return false
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.toLowerCase())
}

/** 오늘(Asia/Seoul) 본인의 룰렛 세션을 모두 지운다. 테스트용. 관리자만 가능. */
export async function resetTodaySessions(): Promise<Result<{ deleted: number }>> {
  const user = await requireUser()
  if (!user) return fail('AUTH_REQUIRED')
  if (!(await isAdminEmail(user.email))) return fail('PLACE_FORBIDDEN')
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

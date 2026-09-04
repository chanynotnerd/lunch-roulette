'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function resolveOrigin(): Promise<string> {
  const h = await headers()
  return h.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

/** Google OAuth 로그인 시작. Supabase가 준 URL로 이동한다. */
export async function signInWithGoogle() {
  const origin = await resolveOrigin()
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  })

  if (error || !data.url) {
    redirect('/login?error=auth')
  }

  redirect(data.url)
}

/** 로그아웃 후 로그인 화면으로. */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 리디렉션에 쓸 공개 origin.
 * Docker standalone 서버는 HOSTNAME=0.0.0.0 으로 바인드하고, Next 는 request.nextUrl.origin 을 Host 헤더가 아니라
 * 그 바인드 주소로 채운다(2026-09-08 셀프호스팅에서 https://0.0.0.0:3000/ 으로 튕김). 그래서 운영은 NEXT_PUBLIC_SITE_URL 을
 * 우선하고, 변수가 없는 로컬 개발만 요청 origin 을 쓴다.
 */
function publicOrigin(request: NextRequest): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  return site ? site.replace(/\/+$/, '') : request.nextUrl.origin
}

/** Google OAuth 리디렉션 도착점. code를 세션으로 교환한다. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const origin = publicOrigin(request)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}

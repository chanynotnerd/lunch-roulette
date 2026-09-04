import 'server-only'

/**
 * ADMIN_EMAILS(쉼표 구분)에 포함된 이메일만 관리자다. 미설정이면 아무도 아니다.
 * 'use server' 파일에 두면 공개 액션 엔드포인트가 되므로(이메일 열거 오라클) server-only 모듈에 둔다.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(email.trim().toLowerCase())
}

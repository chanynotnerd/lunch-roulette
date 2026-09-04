import { signInWithGoogle } from '@/actions/auth'

type Props = {
  searchParams: Promise<{ error?: string }>
}

/** S1. 로그인. 스펙 07, 15. */
export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="login-title">식사 룰렛</h1>
        <p className="muted">지금 영업 중인 근처 식당 3곳 중에서 고릅니다</p>
        <form action={signInWithGoogle}>
          <button type="submit" className="btn btn-primary btn-block">
            Google로 로그인
          </button>
        </form>
        {error && (
          <p role="alert" className="alert">
            로그인에 실패했습니다. 다시 시도해 주세요
          </p>
        )}
      </div>
    </main>
  )
}

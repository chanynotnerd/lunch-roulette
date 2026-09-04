import { signInWithGoogle } from '@/actions/auth'

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <main>
      <h1>식사 룰렛</h1>
      {error && <p role="alert">로그인에 실패했습니다. 다시 시도해 주세요</p>}
      <form action={signInWithGoogle}>
        <button type="submit">Google로 로그인</button>
      </form>
    </main>
  )
}

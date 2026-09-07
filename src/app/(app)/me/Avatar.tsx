'use client'

import { useState } from 'react'

type Props = {
  src: string | null
  /** 사진이 없거나 로드에 실패했을 때 원 안에 넣는 글자 */
  initial: string
  /** img alt와 이니셜 원의 aria-label */
  name: string
}

/**
 * 지름 56px 원형 프로필 사진. 스펙 18 P4: next/image 대신 img + no-referrer.
 * 로드 실패(onError)는 서버 컴포넌트에서 잡을 수 없어 이 컴포넌트만 클라이언트다.
 */
export default function Avatar({ src, initial, name }: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = src !== null && !failed

  if (!showImage) {
    return (
      <span className="avatar avatar-initial" role="img" aria-label={`${name} 프로필`}>
        {initial}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 스펙 18 P4. Google 사진 도메인을 next.config에 등록하지 않는다.
    <img
      className="avatar avatar-img"
      src={src}
      alt={`${name} 프로필`}
      width={56}
      height={56}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

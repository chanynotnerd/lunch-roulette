import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지용(deploy/app.Dockerfile). 실행에 필요한 파일만 .next/standalone 에 모은다.
  // Vercel 배포에는 영향이 없다.
  output: "standalone",
};

export default nextConfig;

# 셀프호스팅 증명 (2026-09-08)

**주장**: 식사 룰렛(https://lunch.rouleat.biz)은 클라우드 호스팅(Vercel + Supabase 클라우드)이 아니라,
개인 노트북(Windows 11, 호스트명 DESKTOP-MNNAJ8E) 위의 Docker 컨테이너 8개로 앱·DB·인증 서버를 전부 직접 돌린다.
외부 연결은 Cloudflare Tunnel(아웃바운드 전용) 하나뿐이며 포트 개방·공인 IP 노출이 없다.

## 증거 목록

| # | 파일 | 무엇을 보여 주나 |
|---|---|---|
| 1 | [evidence.md](evidence.md) §1~§2 | 노트북 호스트명, Docker 버전, 컨테이너 8개(app, tunnel, db, auth, rest, envoy, meta, studio) healthy |
| 2 | evidence.md §3 | cloudflared 컨테이너가 Cloudflare 서울(icn) 데이터센터 3곳에 터널 연결을 등록한 로그 |
| 3 | evidence.md §4 | rouleat.biz 네임서버가 Cloudflare, lunch.rouleat.biz 가 Cloudflare 애니캐스트 IP 로 해석 |
| 4 | evidence.md §5 | 공개 주소의 HTTPS 응답 헤더: `Server: cloudflare` + `x-powered-by: Next.js` (Cloudflare 뒤에 Next.js 원본) |
| 5 | evidence.md §6 | 노트북 안 Postgres 컨테이너에 실제로 쌓인 데이터: auth.users 1명(구글 로그인), places 1건, restaurants 200건 |
| 6 | evidence.md §7 | **결정적 실험**: 노트북에서 `docker compose stop app` → 공개 주소 502, `start app` → 200. 원본 서버가 이 노트북임을 직접 증명 |
| 7 | evidence.md §8 + [02-cloudflare-tunnel-healthy.jpg](02-cloudflare-tunnel-healthy.jpg) | Cloudflare 대시보드가 보는 커넥터 호스트명 `33fda8e5b0ee` = 노트북의 `docker ps` 컨테이너 ID |
| 8 | [01-home-logged-in.jpg](01-home-logged-in.jpg) | https://lunch.rouleat.biz 에 구글 로그인한 뒤의 홈 화면 |

## 구성 요약

```
브라우저 ──HTTPS──▶ Cloudflare (DNS·인증서·CDN) ──Tunnel(QUIC, 아웃바운드)──▶ 노트북 Docker
                                                                          ├ app        Next.js
                                                                          ├ api-gw     Envoy
                                                                          ├ auth       GoTrue (구글 OAuth)
                                                                          ├ rest       PostgREST
                                                                          ├ db         Postgres 17
                                                                          ├ meta/studio 관리 화면(내부용)
                                                                          └ cloudflared
```

자세한 구성은 [../README.md](../README.md), 컨테이너 정의는 [../docker-compose.yml](../docker-compose.yml).

## 재현 방법

노트북에서 `deploy/` 폴더로 가서:

```sh
docker compose --profile tunnel ps                       # 컨테이너 상태
docker compose stop app; curl -sI https://lunch.rouleat.biz/login | head -1   # 502
docker compose start app; sleep 10; curl -sI https://lunch.rouleat.biz/login | head -1   # 200
```

## 참고

- 같은 코드의 Vercel 배포(https://lunch-roulette-sooty.vercel.app)는 별개로 살아 있으며, 두 배포는 DB 가 다르다.
- evidence.md 와 스크린샷의 Origin IP 는 노트북이 있는 곳의 공인 IP 다. 외부 접속은 Tunnel 로만 들어오므로 이 IP 로 직접 접속되는 포트는 없다.

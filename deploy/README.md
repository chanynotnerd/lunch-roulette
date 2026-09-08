# 점심 룰렛 셀프호스팅

Vercel + Supabase 클라우드 대신 내 서버(Docker) 한 대에서 앱과 DB를 모두 돌리는 구성.
로컬 노트북에서 연습한 뒤 같은 파일로 Oracle Cloud 무료 VM에 올리는 것이 목표다.

## 구조

```
브라우저
  │  https://lunch.도메인            https://lunch-api.도메인      (도메인: GoDaddy 구매, DNS: Cloudflare)
  ▼                                  ▼
Cloudflare Tunnel (cloudflared 컨테이너) ── DNS, HTTPS, CDN, 방화벽. 포트 개방 없음  [profile tunnel, 기본]
  │   (대안: caddy 컨테이너가 :80/:443 으로 직접 HTTPS. Caddyfile 참고             [profile public])
  ├─ app      Next.js (deploy/app.Dockerfile, standalone)          :3000
  └─ api-gw   Envoy 게이트웨이 ── /auth/v1 → auth, /rest/v1 → rest   :8000
                                 /        → studio (관리 화면, 기본 인증)
       auth    GoTrue   구글 로그인
       rest    PostgREST
       meta    postgres-meta (studio용)
       db      supabase/postgres 17  (named volume db-data)
       migrate 일회성: ../supabase/migrations/*.sql 적용
```

Supabase 공식 self-host 구성(`volumes/UPSTREAM.txt`)에서 이 앱이 안 쓰는
realtime, storage, imgproxy, edge functions, supavisor, analytics 는 뺐다.

## 처음 띄우기

```sh
cd deploy
cp .env.example .env
sh scripts/gen-secrets.sh          # 출력된 6줄을 .env 의 같은 이름 줄에 붙여 넣는다
# .env 에 카카오 키(KAKAO_REST_API_KEY, NEXT_PUBLIC_KAKAO_JS_KEY), ADMIN_EMAILS 채우기
docker compose up -d --build
docker compose ps                   # 전부 healthy / migrate 는 exited (0)
```

- 앱: http://localhost:3000
- Supabase Studio: http://localhost:8000 (아이디 `DASHBOARD_USERNAME`, 비밀번호 `DASHBOARD_PASSWORD`)
- DB 직접 접속: `docker compose exec db psql -U postgres`

로컬에서는 구글 로그인이 안 된다. 구글이 https 공개 주소만 리디렉션 URI로 받기 때문이다.
로그인까지 확인하려면 아래 "외부 공개"까지 진행한다.

## 외부 공개 (GoDaddy 도메인 + Cloudflare Tunnel) — 기본

도메인은 GoDaddy 에서 사고, 관리(DNS)만 Cloudflare 로 넘긴 뒤 Tunnel 로 서버를 낸다.
서버 쪽 포트 개방·집 IP 노출·인증서 관리가 전부 필요 없다. 실제 도메인은 `rouleat.biz`(GoDaddy, 2026-09-07 구매).
앱 `lunch.rouleat.biz`, API `lunch-api.rouleat.biz` 기준.

> 무료 서브도메인(내도메인.한국 `*.kro.kr` 등)으로는 이 방식이 안 된다. Cloudflare 무료 플랜은 서브도메인을
> zone 으로 못 받기 때문(Enterprise 전용, Public Suffix List 미등재). 그 경우는 아래 "대안" 으로.

1. **도메인 구매 (GoDaddy)**: 원하는 이름 검색 → 장바구니에서 도메인 보호·이메일·빌더 같은 추가 상품은 전부 빼고
   도메인만 결제. 첫해 할인가와 갱신가가 다르니 갱신가 확인. WHOIS 개인정보 보호는 기본 포함인지 확인.
2. **Cloudflare 에 사이트 추가**: Cloudflare 대시보드 → Add a domain → `rouleat.biz` → Free 플랜.
   화면에 나오는 Cloudflare 네임서버 2개(`xxx.ns.cloudflare.com`)를 메모.
3. **GoDaddy 네임서버 변경**: GoDaddy → 내 제품 → 도메인 → DNS → 네임서버 → "내 네임서버 사용" → 2번의 2개 입력.
   반영까지 몇 분~수 시간. Cloudflare 대시보드에서 상태가 Active 로 바뀌면 끝.
4. **터널 생성**: Cloudflare → Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared → 이름 `lunch-roulette`.
   화면의 토큰을 `.env` 의 `CLOUDFLARE_TUNNEL_TOKEN` 에 넣는다.
5. **호스트명 매핑**: 같은 화면 Public Hostname 탭에서 두 줄 추가 (DNS 레코드는 자동 생성된다):
   - `lunch.rouleat.biz` → Service `HTTP` `app:3000`
   - `lunch-api.rouleat.biz` → Service `HTTP` `api-gw:8000`
   `api.lunch.rouleat.biz` 처럼 두 단계 서브도메인은 쓰지 않는다. Cloudflare 무료 인증서가 한 단계까지만 덮는다.
6. `.env` 주소를 바꾼다:
   ```
   SITE_URL=https://lunch.rouleat.biz
   SUPABASE_PUBLIC_URL=https://lunch-api.rouleat.biz
   ADDITIONAL_REDIRECT_URLS=https://lunch.rouleat.biz/auth/callback
   ```
7. **구글 로그인**: Google Cloud Console → 사용자 인증 정보 → OAuth 클라이언트 → 승인된 리디렉션 URI에
   `https://lunch-api.rouleat.biz/auth/v1/callback` 추가. `.env` 에 `GOOGLE_ENABLED=true`, `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET`.
8. **카카오**: 개발자 콘솔 → 앱 → 플랫폼 Web 사이트 도메인에 `https://lunch.rouleat.biz` 추가 (JS SDK 도메인 제한).
9. 기동: `docker compose --profile tunnel up -d --build`. `docker compose logs tunnel` 에 `Registered tunnel connection` 이 뜨면 연결된 것.
   Cloudflare 대시보드의 터널 상태도 HEALTHY.
10. 확인: 휴대폰 LTE 로 `https://lunch.rouleat.biz` → 구글 로그인 → 홈 화면.

Studio(관리 화면)는 `https://lunch-api.rouleat.biz/` 에서 기본 인증(`DASHBOARD_USERNAME`/`PASSWORD`)으로 열린다.
밖에 안 내고 싶으면 5번에서 `lunch-api` 매핑에 경로를 `auth/v1/*`, `rest/v1/*` 두 줄로 나눠 넣고 `/` 는 빼면 된다.

## 외부 공개 — 대안 (Cloudflare 없이 Caddy 직접 HTTPS)

Cloudflare 를 빼고 싶거나 무료 서브도메인만 있을 때. DNS A 레코드는 도메인 업체 화면에서, HTTPS 는 서버의 Caddy 가 맡는다.
앱과 API 는 호스트명 하나(`lunch.rouleat.biz`)를 쓰고 Caddy 가 `/auth/v1`, `/rest/v1` 경로만 api-gw 로 보낸다(Caddyfile).

1. **DNS**: 도메인 업체 DNS 화면에서 A 레코드 `lunch` → 서버 공인 IP.
   노트북이면 집 공인 IP(통신사가 바꾸면 다시 고쳐야 함), Oracle VM 이면 VM 공인 IP(고정).
2. **포트 개방** (80, 443 이 서버까지 닿아야 인증서 발급·접속이 된다):
   - 노트북: 공유기 포트포워딩 외부 80→노트북 80, 외부 443→노트북 443 (TCP, 443은 UDP도). 노트북 사설 IP 는 공유기에서 고정 할당.
   - Oracle VM: 보안 목록 인그레스 규칙에 80, 443 추가 + VM 안 iptables 허용.
3. `.env`: `DOMAIN=lunch.rouleat.biz`, `SITE_URL` 과 `SUPABASE_PUBLIC_URL` 둘 다 `https://lunch.rouleat.biz`,
   `ADDITIONAL_REDIRECT_URLS=https://lunch.rouleat.biz/auth/callback`.
4. 구글 리디렉션 URI 는 `https://lunch.rouleat.biz/auth/v1/callback`, 카카오 도메인은 `https://lunch.rouleat.biz`.
5. 기동: `docker compose --profile public up -d --build`. `docker compose logs caddy` 에서 `certificate obtained` 확인.
   실패는 거의 다 1·2번(A 레코드 미전파, 80/443 미개방). 인증서는 `caddy-data` 볼륨에 남는다.
   Studio 는 이 방식에서는 밖으로 안 나가고 서버의 `http://localhost:8000` 에서만 열린다.

## 셀프호스팅 증명

2026-09-08 노트북에서 외부 공개·구글 로그인까지 성공한 증거를 [proof/README.md](proof/README.md)에 모아 두었다
(컨테이너 상태, 터널 로그, DNS, 응답 헤더, DB 내용, 앱 정지·재시작 실험, 스크린샷).

## 자주 쓰는 명령

```sh
docker compose ps                        # 상태
docker compose logs -f app               # 앱 로그
docker compose logs migrate              # 마이그레이션 결과
docker compose up -d --build app         # 코드 바꾼 뒤 앱만 다시 빌드
docker compose run --rm migrate          # 새 마이그레이션 파일 적용
docker compose down                      # 정지 (DB 데이터 유지)
docker compose down -v                   # DB 데이터까지 삭제 (주의)
docker compose exec db pg_dump -U postgres postgres > backup.sql   # 백업
```

## Oracle VM 으로 옮길 때

VM에 Docker 설치 후 저장소를 clone 하고, 이 폴더의 `.env` 를 복사한 뒤 위 "외부 공개" 순서 그대로.
Tunnel 방식이면 터널 토큰을 그대로 쓰고, 노트북 쪽 스택을 내리면 주소가 VM 으로 넘어간다(DNS 손볼 것 없음).
Caddy 방식이면 A 레코드를 VM 공인 IP 로 바꾸고, Caddy 가 VM 에서 인증서를 새로 받는다.
DB 데이터는 `pg_dump` 로 받아 VM 에서 `psql -f` 로 복원한다.

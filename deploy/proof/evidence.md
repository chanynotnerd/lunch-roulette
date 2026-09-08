# 증거 수집 2026-09-08 10:37:26 +0900

## 1. 서버 = 이 노트북
```
DESKTOP-MNNAJ8E
Windows: 
Microsoft Windows [Version 10.0.26200.9168]
Docker version 29.7.2, build a7dcaa6
```

## 2. 컨테이너 상태 (docker compose ps)
```
NAME              IMAGE                                    STATUS
lunch-app         lunch-roulette-app                       Up 35 minutes (healthy)
lunch-tunnel      cloudflare/cloudflared:2026.8.3          Up 35 minutes
supabase-auth     supabase/gotrue:v2.189.0                 Up 16 minutes (healthy)
supabase-db       supabase/postgres:17.6.1.136             Up 18 hours (healthy)
supabase-envoy    envoyproxy/envoy:v1.39.0                 Up 35 minutes (healthy)
supabase-meta     supabase/postgres-meta:v0.96.6           Up 18 hours (healthy)
supabase-rest     postgrest/postgrest:v14.12               Up 18 hours (healthy)
supabase-studio   supabase/studio:2026.08.03-sha-022b374   Up 35 minutes (healthy)
```

## 3. Cloudflare Tunnel 연결 로그
```
2026-09-08T01:01:59Z INF Tunnel connection curve preferences: [X25519MLKEM768 CurveID(65074) CurveP256] connIndex=0 event=0 ip=198.41.192.47
2026-09-08T01:01:59Z INF Registered tunnel connection connIndex=0 connection=cc2877c8-77d2-4881-bb12-080203491aac event=0 ip=198.41.192.47 location=icn06 protocol=quic
2026-09-08T01:02:00Z INF Registered tunnel connection connIndex=1 connection=ef9facf8-05ab-4985-8c1a-a4e6767dd854 event=0 ip=198.41.200.23 location=icn05 protocol=quic
2026-09-08T01:02:01Z INF Registered tunnel connection connIndex=2 connection=b16cc3ee-eff8-4cde-ba2a-fdf925727ab8 event=0 ip=198.41.200.233 location=icn01 protocol=quic
```

## 4. DNS
```
$ nslookup -type=NS rouleat.biz 1.1.1.1
rouleat.biz	nameserver = eloise.ns.cloudflare.com
rouleat.biz	nameserver = toby.ns.cloudflare.com

$ nslookup lunch.rouleat.biz 1.1.1.1
Name:    lunch.rouleat.biz
Addresses:  2606:4700:3036::6815:1b2d
	  2606:4700:3036::ac43:a8e7
	  172.67.168.231
	  104.21.27.45
```

## 5. HTTPS 응답 헤더 (Cloudflare 경유)
```
$ curl -sI https://lunch.rouleat.biz/login
HTTP/1.1 200 OK
x-powered-by: Next.js
cf-cache-status: DYNAMIC
Server: cloudflare
CF-RAY: a37a3a6a7f83e65e-HKG
```

## 6. 셀프호스팅 DB 내용 (supabase-db 컨테이너, auth.users / places)
```
          email          |     created_at      |    last_sign_in     
-------------------------+---------------------+---------------------
 boltwriter721@gmail.com | 2026-09-08 01:34:14 | 2026-09-08 01:34:15
(1 row)

 name |              address              | radius_m |     created_at      
------+-----------------------------------+----------+---------------------
 회사 | 봉은사로 524 KR 서울특별시 강남구 |      500 | 2026-09-08 01:35:56
(1 row)

```

## 7. 원본 서버가 이 노트북임을 보이는 실험: 앱 컨테이너를 잠깐 끄면 공개 주소가 죽고, 켜면 살아난다
```
$ docker compose stop app
 Container lunch-app Stopped 
$ curl -s -o /dev/null -w '%{http_code}' https://lunch.rouleat.biz/login   # 앱 정지 중
→ 502
$ docker compose start app
 Container lunch-app Started 
$ curl -s -o /dev/null -w '%{http_code}' https://lunch.rouleat.biz/login   # 앱 재시작 후
→ 200
```

## 8. Cloudflare 대시보드의 커넥터 호스트명 = 이 노트북의 cloudflared 컨테이너 ID
```
Cloudflare 대시보드(02-cloudflare-tunnel-healthy.jpg): Connector Hostname 33fda8e5b0ee, Status Connected, Data center icn
$ docker ps --filter name=lunch-tunnel --format '{{.ID}}  {{.Names}}  {{.Status}}'
33fda8e5b0ee  lunch-tunnel  Up 37 minutes
```

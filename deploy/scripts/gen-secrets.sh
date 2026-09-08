#!/bin/sh
# 셀프호스팅용 비밀값을 생성해 표준 출력으로 낸다. (Supabase 공식 utils/generate-keys.sh 를 이 구성에 맞게 줄임)
# 사용: sh scripts/gen-secrets.sh >> .env   (그 뒤 .env 에서 같은 이름의 예시 줄을 지운다)
set -e

b64url() { openssl enc -base64 -A | tr '+/' '-_' | tr -d '='; }

jwt_secret=$(openssl rand -base64 30)
header='{"alg":"HS256","typ":"JWT"}'
iat=$(date +%s)
exp=$((iat + 5 * 3600 * 24 * 365))

sign() {
  payload_b64=$(printf %s "$1" | b64url)
  header_b64=$(printf %s "$header" | b64url)
  content="${header_b64}.${payload_b64}"
  sig=$(printf %s "$content" | openssl dgst -binary -sha256 -hmac "$jwt_secret" | b64url)
  printf '%s' "${content}.${sig}"
}

anon_key=$(sign "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":$iat,\"exp\":$exp}")
service_role_key=$(sign "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":$iat,\"exp\":$exp}")

echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
echo "JWT_SECRET=${jwt_secret}"
echo "ANON_KEY=${anon_key}"
echo "SERVICE_ROLE_KEY=${service_role_key}"
echo "PG_META_CRYPTO_KEY=$(openssl rand -base64 24)"
echo "DASHBOARD_PASSWORD=$(openssl rand -hex 16)"

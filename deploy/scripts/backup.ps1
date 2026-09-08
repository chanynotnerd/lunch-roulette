# 셀프호스팅 DB 일일 백업.
# supabase-db 컨테이너 안에서 pg_dump(custom 형식)를 만들고 deploy/backups/ 로 꺼낸 뒤 7일 지난 파일은 지운다.
# 작업 스케줄러 등록: deploy/scripts/register-backup-task.ps1
# 복원: deploy/README.md "백업과 복원"
$ErrorActionPreference = 'Stop'

$deployDir = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $deployDir 'backups'
$keepDays  = 7
$stamp     = Get-Date -Format 'yyyyMMdd-HHmm'
$name      = "lunch-$stamp.dump"
$logFile   = Join-Path $backupDir 'backup.log'

New-Item -ItemType Directory -Force $backupDir | Out-Null
function Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Tee-Object -FilePath $logFile -Append }

Set-Location $deployDir
try {
  # 컨테이너 안에서 덤프 → docker cp 로 꺼낸다(PowerShell 리디렉션은 바이너리를 깨뜨릴 수 있다).
  docker compose exec -T db sh -c "pg_dump -U postgres -d postgres -Fc -f /tmp/$name"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump 실패 (exit $LASTEXITCODE)" }
  docker compose cp "db:/tmp/$name" (Join-Path $backupDir $name)
  if ($LASTEXITCODE -ne 0) { throw "docker cp 실패 (exit $LASTEXITCODE)" }
  docker compose exec -T db rm -f "/tmp/$name"

  $size = (Get-Item (Join-Path $backupDir $name)).Length
  Log "OK $name ($size bytes)"

  Get-ChildItem $backupDir -Filter 'lunch-*.dump' |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$keepDays) } |
    ForEach-Object { Remove-Item $_.FullName -Force; Log "삭제 $($_.Name) (보관 기간 $keepDays 일 초과)" }
} catch {
  Log "FAIL $($_.Exception.Message)"
  exit 1
}

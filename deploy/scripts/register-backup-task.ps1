# backup.ps1 을 매일 04:00 에 실행하는 작업 스케줄러 항목을 현재 사용자로 등록한다.
# 다시 실행하면 같은 이름의 항목을 덮어쓴다. 해제: schtasks /Delete /TN LunchRouletteDbBackup /F
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'backup.ps1'
$taskName = 'LunchRouletteDbBackup'
$tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
schtasks /Create /F /TN $taskName /SC DAILY /ST 04:00 /TR $tr | Out-Null
if ($LASTEXITCODE -ne 0) { throw "schtasks 등록 실패 (exit $LASTEXITCODE)" }
schtasks /Query /TN $taskName /FO LIST | Select-String 'TaskName|Next Run Time|다음 실행 시간|Status|상태'

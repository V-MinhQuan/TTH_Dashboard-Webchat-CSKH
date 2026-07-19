$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$SupervisorScript = Join-Path $PSScriptRoot "Run-FlicSupervisor.ps1"
$StartupDirectory = [Environment]::GetFolderPath("Startup")
$LauncherPath = Join-Path $StartupDirectory "FLIC-Dashboard.cmd"

if (-not (Test-Path -LiteralPath $SupervisorScript)) {
    throw "Không tìm thấy supervisor: $SupervisorScript"
}

$launcher = @"
@echo off
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$SupervisorScript"
"@

Set-Content -LiteralPath $LauncherPath -Value $launcher -Encoding ASCII
Write-Host "Đã tạo Startup launcher cho user hiện tại: $LauncherPath"
Write-Host "Khởi động supervisor ngay bây giờ..."
Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $SupervisorScript) `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden

Start-Sleep -Seconds 8
Invoke-RestMethod http://127.0.0.1:5001/health/live

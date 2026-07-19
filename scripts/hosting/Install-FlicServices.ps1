param(
    [string]$NssmPath = "C:\nssm\nssm.exe"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$PowerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$LogDirectory = Join-Path $ProjectRoot "logs\services"

if (-not (Test-Path -LiteralPath $NssmPath)) {
    throw "Không tìm thấy NSSM tại $NssmPath"
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Hãy chạy PowerShell bằng quyền Run as administrator."
}

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

function Install-FlicService {
    param(
        [string]$Name,
        [string]$DisplayName,
        [string]$ScriptPath
    )

    if (Get-Service -Name $Name -ErrorAction SilentlyContinue) {
        throw "Service $Name đã tồn tại. Không tự ghi đè cấu hình hiện có."
    }

    & $NssmPath install $Name $PowerShellExe `"-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`"`"
    if ($LASTEXITCODE -ne 0) { throw "Không thể cài service $Name" }

    & $NssmPath set $Name DisplayName $DisplayName
    & $NssmPath set $Name AppDirectory $ProjectRoot
    & $NssmPath set $Name Start SERVICE_AUTO_START
    & $NssmPath set $Name AppExit Default Restart
    & $NssmPath set $Name AppRestartDelay 5000
    & $NssmPath set $Name AppThrottle 10000
    & $NssmPath set $Name AppStdout (Join-Path $LogDirectory "$Name.out.log")
    & $NssmPath set $Name AppStderr (Join-Path $LogDirectory "$Name.err.log")
    & $NssmPath set $Name AppRotateFiles 1
    & $NssmPath set $Name AppRotateBytes 10485760
}

Install-FlicService `
    -Name "FlicDashboardApi" `
    -DisplayName "FLIC Dashboard API" `
    -ScriptPath (Join-Path $PSScriptRoot "Start-FlicApi.ps1")

Install-FlicService `
    -Name "FlicDashboardWorker" `
    -DisplayName "FLIC Dashboard Background Worker" `
    -ScriptPath (Join-Path $PSScriptRoot "Start-FlicWorker.ps1")

Start-Service FlicDashboardApi
Start-Service FlicDashboardWorker

Write-Host "Đã cài và khởi động FlicDashboardApi + FlicDashboardWorker."
Get-Service FlicDashboardApi, FlicDashboardWorker | Format-Table Status, Name, DisplayName

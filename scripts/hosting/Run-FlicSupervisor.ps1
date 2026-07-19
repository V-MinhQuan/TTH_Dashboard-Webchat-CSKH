$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDirectory = Join-Path $ProjectRoot "logs\supervisor"
$ApiScript = Join-Path $PSScriptRoot "Start-FlicApi.ps1"
$WorkerScript = Join-Path $PSScriptRoot "Start-FlicWorker.ps1"
$PowerShellExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$mutex = $null
$apiProcess = $null
$workerProcess = $null

New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$createdNew = $false
$mutex = [Threading.Mutex]::new($true, "Local\FlicDashboardSupervisor", [ref]$createdNew)
if (-not $createdNew) {
    Add-Content -LiteralPath (Join-Path $LogDirectory "supervisor.log") -Value "$(Get-Date -Format o) Supervisor đã chạy, bỏ qua lần khởi động trùng."
    exit 0
}

function Start-ManagedProcess {
    param(
        [string]$Name,
        [string]$ScriptPath
    )

    $stdout = Join-Path $LogDirectory "$Name.out.log"
    $stderr = Join-Path $LogDirectory "$Name.err.log"
    Add-Content -LiteralPath (Join-Path $LogDirectory "supervisor.log") -Value "$(Get-Date -Format o) Khởi động $Name"

    return Start-Process `
        -FilePath $PowerShellExe `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $ScriptPath) `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
}

try {
    $apiProcess = Start-ManagedProcess -Name "api" -ScriptPath $ApiScript
    $workerProcess = Start-ManagedProcess -Name "worker" -ScriptPath $WorkerScript

    while ($true) {
        Start-Sleep -Seconds 5

        if ($apiProcess.HasExited) {
            Add-Content -LiteralPath (Join-Path $LogDirectory "supervisor.log") -Value "$(Get-Date -Format o) API dừng exitCode=$($apiProcess.ExitCode); chạy lại sau 5 giây."
            Start-Sleep -Seconds 5
            $apiProcess = Start-ManagedProcess -Name "api" -ScriptPath $ApiScript
        }

        if ($workerProcess.HasExited) {
            Add-Content -LiteralPath (Join-Path $LogDirectory "supervisor.log") -Value "$(Get-Date -Format o) Worker dừng exitCode=$($workerProcess.ExitCode); chạy lại sau 5 giây."
            Start-Sleep -Seconds 5
            $workerProcess = Start-ManagedProcess -Name "worker" -ScriptPath $WorkerScript
        }
    }
} finally {
    foreach ($process in @($apiProcess, $workerProcess)) {
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
    if ($mutex) {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
}

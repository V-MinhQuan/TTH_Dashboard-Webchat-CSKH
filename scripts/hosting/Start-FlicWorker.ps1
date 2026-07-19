$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$EnvironmentFile = Join-Path $ProjectRoot ".env_hosting"
$PythonExe = Join-Path $ProjectRoot "backend\.venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $PythonExe)) {
    throw "Không tìm thấy Python virtual environment: $PythonExe"
}
if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    throw "Không tìm thấy file cấu hình hosting: $EnvironmentFile"
}

Get-Content -LiteralPath $EnvironmentFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $name, $value = $line.Split("=", 2)
    $name = $name.Trim()
    $value = $value.Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

$env:HF_BACKGROUND_ENABLED = "true"
$env:PYTHONUNBUFFERED = "1"
$env:TZ = "Asia/Ho_Chi_Minh"

Set-Location -LiteralPath (Join-Path $ProjectRoot "backend")
& $PythonExe -m app.worker.standalone
exit $LASTEXITCODE

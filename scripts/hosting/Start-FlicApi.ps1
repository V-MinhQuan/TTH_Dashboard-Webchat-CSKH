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

# API processes never own scheduled jobs. This permits multiple API workers
# without duplicating sentiment, precompute, or nightly rollup tasks.
$env:HF_BACKGROUND_ENABLED = "false"
$env:PYTHONUNBUFFERED = "1"

Set-Location -LiteralPath $ProjectRoot
& $PythonExe -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 5001 --workers 4
exit $LASTEXITCODE

@echo off
setlocal

set PYTHONIOENCODING=utf-8

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8001
) else (
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
)

endlocal

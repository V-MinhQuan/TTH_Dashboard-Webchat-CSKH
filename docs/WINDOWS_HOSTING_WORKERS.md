# Triển khai API và background worker trên Windows hosting

Mô hình production:

- `FlicDashboardApi`: Uvicorn port 5001, 4 API workers, không chạy lịch nền.
- `FlicDashboardWorker`: đúng 1 process chạy sentiment, dashboard precompute và nightly rollup.
- Cả hai chạy dưới dạng Windows Service, tự khởi động sau reboot và tự chạy lại sau crash.

Nếu tài khoản không có quyền Administrator, dùng `Install-FlicUserStartup.ps1`
thay cho Windows Service. Chế độ này tự chạy sau khi user đăng nhập và supervisor
sẽ tự khởi động lại API/worker khi crash. Nó không thể chạy khi Windows đang ở màn
hình đăng nhập hoặc sau khi user Sign out.

## Điều kiện

- Source code: `C:\___Hosting\1.WebDashboard_ChatBot`
- Python virtual environment: `C:\___Hosting\1.WebDashboard_ChatBot\backend\.venv`
- File `C:\___Hosting\1.WebDashboard_ChatBot\.env_hosting` chứa cấu hình production.
- NSSM đặt tại `C:\nssm\nssm.exe`.

## Cài đặt lần đầu

Mở PowerShell bằng **Run as administrator**:

```powershell
Set-TimeZone -Id "SE Asia Standard Time"
cd C:\___Hosting\1.WebDashboard_ChatBot

backend\.venv\Scripts\python.exe -m pip install -r requirements.backend.txt

Set-ExecutionPolicy -Scope Process Bypass
.\scripts\hosting\Install-FlicServices.ps1 -NssmPath C:\nssm\nssm.exe
```

## Cài không cần quyền Administrator

Không cần NSSM. Mở PowerShell bình thường bằng đúng tài khoản sẽ duy trì ứng dụng:

```powershell
cd C:\___Hosting\1.WebDashboard_ChatBot
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\hosting\Install-FlicUserStartup.ps1
```

Sau khi VPS reboot, phải đăng nhập tài khoản Windows này ít nhất một lần. Có thể
Disconnect phiên Remote Desktop nhưng không chọn Sign out.

Nightly Rollup tính trực tiếp theo `Asia/Ho_Chi_Minh` trong code, nên chế độ này
không cần quyền Administrator để đổi timezone của Windows.

Log chế độ user nằm trong:

```text
C:\___Hosting\1.WebDashboard_ChatBot\logs\supervisor
```

## Kiểm tra

```powershell
Get-Service FlicDashboardApi, FlicDashboardWorker
Get-TimeZone
Invoke-RestMethod http://127.0.0.1:5001/health/live
```

Xem log:

```powershell
Get-Content .\logs\services\FlicDashboardApi.err.log -Tail 100 -Wait
Get-Content .\logs\services\FlicDashboardWorker.out.log -Tail 100 -Wait
```

Log worker phải có các dòng tương tự:

- `Standalone background worker service started.`
- `SQL-backed Hugging Face sentiment worker started.`
- `DashboardPrecomputeWorker started.`
- `NightlyRollup: Lịch chạy tiếp theo lúc 1:00 AM...`

Kiểm tra API dùng 4 process nhưng chỉ có một standalone worker:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match "uvicorn|app.worker.standalone" } |
  Select-Object ProcessId, CommandLine
```

## Cập nhật phiên bản mới

```powershell
cd C:\___Hosting\1.WebDashboard_ChatBot
Stop-Service FlicDashboardApi, FlicDashboardWorker

git pull
backend\.venv\Scripts\python.exe -m pip install -r requirements.backend.txt
npm ci
npm run build

Start-Service FlicDashboardWorker, FlicDashboardApi
Get-Service FlicDashboardApi, FlicDashboardWorker
Invoke-RestMethod http://127.0.0.1:5001/health/live
```

Không chạy thêm lệnh Uvicorn thủ công sau khi hai Windows Service đã hoạt động.

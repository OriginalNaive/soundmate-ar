# SoundMate AR PostgreSQL 設置腳本
# 此腳本將協助您在 Windows 上安裝和配置 PostgreSQL

Write-Host "🚀 SoundMate AR PostgreSQL 設置開始..." -ForegroundColor Green
Write-Host ""

# 檢查是否以管理員身份運行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "⚠️  此腳本需要管理員權限來安裝 PostgreSQL" -ForegroundColor Yellow
    Write-Host "請以管理員身份重新運行 PowerShell 並執行此腳本" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "步驟："
    Write-Host "1. 右鍵點擊 PowerShell 圖標"
    Write-Host "2. 選擇 '以管理員身份執行'"
    Write-Host "3. 重新執行此腳本"
    pause
    exit 1
}

# 檢查 Chocolatey 是否已安裝
Write-Host "🔍 檢查 Chocolatey 套件管理器..." -ForegroundColor Cyan
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "📦 安裝 Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # 重新載入環境變數
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Host "✅ Chocolatey 安裝完成" -ForegroundColor Green
} else {
    Write-Host "✅ Chocolatey 已安裝" -ForegroundColor Green
}

Write-Host ""

# 檢查 PostgreSQL 是否已安裝
Write-Host "🔍 檢查 PostgreSQL..." -ForegroundColor Cyan
$postgresInstalled = Get-Command pg_config -ErrorAction SilentlyContinue

if (!$postgresInstalled) {
    Write-Host "📦 安裝 PostgreSQL..." -ForegroundColor Yellow
    choco install postgresql --version 15.3 -y
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL 安裝完成" -ForegroundColor Green
    } else {
        Write-Host "❌ PostgreSQL 安裝失敗" -ForegroundColor Red
        pause
        exit 1
    }
} else {
    Write-Host "✅ PostgreSQL 已安裝" -ForegroundColor Green
}

Write-Host ""

# 設置 PostgreSQL 服務
Write-Host "⚙️  配置 PostgreSQL 服務..." -ForegroundColor Cyan
$service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -ne "Running") {
        Start-Service $service.Name
        Write-Host "✅ PostgreSQL 服務已啟動" -ForegroundColor Green
    } else {
        Write-Host "✅ PostgreSQL 服務正在運行" -ForegroundColor Green
    }
    
    # 設置為自動啟動
    Set-Service $service.Name -StartupType Automatic
    Write-Host "✅ PostgreSQL 服務已設置為自動啟動" -ForegroundColor Green
} else {
    Write-Host "⚠️  找不到 PostgreSQL 服務，嘗試手動啟動..." -ForegroundColor Yellow
    
    # 嘗試找到 PostgreSQL 安裝路徑
    $possiblePaths = @(
        "C:\Program Files\PostgreSQL\15\bin",
        "C:\Program Files\PostgreSQL\14\bin",
        "C:\Program Files\PostgreSQL\13\bin",
        "C:\ProgramData\chocolatey\lib\postgresql\tools\postgresql\bin"
    )
    
    $pgPath = $null
    foreach ($path in $possiblePaths) {
        if (Test-Path "$path\pg_ctl.exe") {
            $pgPath = $path
            break
        }
    }
    
    if ($pgPath) {
        Write-Host "找到 PostgreSQL 安裝路徑: $pgPath" -ForegroundColor Green
        $env:Path += ";$pgPath"
        [Environment]::SetEnvironmentVariable("Path", $env:Path, [EnvironmentVariableTarget]::Machine)
    }
}

Write-Host ""

# 測試 PostgreSQL 連線
Write-Host "🔗 測試 PostgreSQL 連線..." -ForegroundColor Cyan
$password = "postgres"

# 等待 PostgreSQL 完全啟動
Start-Sleep -Seconds 5

try {
    # 嘗試連接到 PostgreSQL
    $env:PGPASSWORD = $password
    $result = & psql -U postgres -d postgres -c "SELECT version();" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL 連線成功" -ForegroundColor Green
        Write-Host "版本資訊: " -NoNewline
        Write-Host ($result | Select-String "PostgreSQL") -ForegroundColor Gray
    } else {
        Write-Host "⚠️  無法連接到 PostgreSQL" -ForegroundColor Yellow
        Write-Host "這可能是因為密碼不正確或服務未完全啟動" -ForegroundColor Yellow
        Write-Host "預設密碼通常是 'postgres'" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  連線測試失敗: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# 提供後續步驟指引
Write-Host "📋 後續步驟：" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 驗證 PostgreSQL 安裝:" -ForegroundColor White
Write-Host "   psql -U postgres -d postgres" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 設置資料庫（在專案目錄執行）:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   node scripts/setup-database.js" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 啟動應用程序:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""

# 詢問是否現在設置資料庫
$setupNow = Read-Host "是否現在設置 SoundMate AR 資料庫？(y/n)"

if ($setupNow -eq "y" -or $setupNow -eq "Y") {
    Write-Host ""
    Write-Host "🔧 設置 SoundMate AR 資料庫..." -ForegroundColor Cyan
    
    $backendPath = Join-Path $PSScriptRoot "backend"
    
    if (Test-Path $backendPath) {
        Set-Location $backendPath
        
        # 安裝 npm 依賴（如果需要）
        if (!(Test-Path "node_modules")) {
            Write-Host "📦 安裝 Node.js 依賴..." -ForegroundColor Yellow
            npm install
        }
        
        # 執行資料庫設置
        Write-Host "🗃️  執行資料庫設置..." -ForegroundColor Yellow
        node scripts/setup-database.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "🎉 SoundMate AR 資料庫設置完成！" -ForegroundColor Green
            Write-Host ""
            Write-Host "您現在可以啟動應用程序了:" -ForegroundColor White
            Write-Host "npm run dev" -ForegroundColor Gray
        } else {
            Write-Host ""
            Write-Host "❌ 資料庫設置失敗" -ForegroundColor Red
            Write-Host "請檢查 PostgreSQL 是否正確安裝和運行" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ 找不到 backend 目錄" -ForegroundColor Red
        Write-Host "請確保在 SoundMate AR 專案根目錄執行此腳本" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🏁 設置完成！" -ForegroundColor Green
pause
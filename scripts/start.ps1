# CLIProxyAPI 启动脚本（隐藏窗口后台运行，日志写入 logs\）
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$exe   = Join-Path $PSScriptRoot 'cli-proxy-api.exe'
$logDir = Join-Path $PSScriptRoot 'logs'
$pidFile = Join-Path $logDir 'pid.txt'
$outLog  = Join-Path $logDir 'out.log'
$errLog  = Join-Path $logDir 'err.log'

if (-not (Test-Path $exe)) { Write-Host "[start] 找不到 $exe"; exit 1 }
if (-not (Test-Path (Join-Path $PSScriptRoot 'config.yaml'))) { Write-Host "[start] 找不到 config.yaml"; exit 1 }
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

# 从 config.yaml 读取端口 / 管理密码 / API 密钥，用于窗口显示
$port = '8317'; $hostIp = '127.0.0.1'; $mgmt = ''; $apiKey = ''
foreach ($line in Get-Content (Join-Path $PSScriptRoot 'config.yaml')) {
    if ($line -match '^\s*host:\s*"([^"]*)"') { if ($Matches[1]) { $hostIp = $Matches[1] } }
    elseif ($line -match '^\s*port:\s*(\d+)') { $port = $Matches[1] }
    elseif ($line -match '^\s*secret-key:\s*"([^"]*)"') { $mgmt = $Matches[1] }
    elseif (-not $apiKey -and $line -match '^\s*-\s*"([^"]+)"') { $apiKey = $Matches[1] }
}

# 程序启动时会把 config.yaml 里的明文密码改写成 bcrypt 哈希，
# 所以明文密码另存于 mgmt_key.txt 用于显示
$mgmtFile = Join-Path $PSScriptRoot 'mgmt_key.txt'
$mgmtShow = ''
if ($mgmt -match '^\$2[aby]\$') {
    if (Test-Path $mgmtFile) { $mgmtShow = (Get-Content $mgmtFile -First 1).Trim() }
} elseif ($mgmt) {
    $mgmtShow = $mgmt
    Set-Content -Path $mgmtFile -Value $mgmtShow -Encoding UTF8
}

# 已在运行则不重复启动
if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue) -and
        (Get-Process -Id $oldPid).ProcessName -eq 'cli-proxy-api') {
        Write-Host "[start] 已在运行 (PID $oldPid)，无需重复启动。"
        Write-Host ""
        Write-Host "======== CLIProxyAPI 信息 ========"
        Write-Host " API 接口  : http://$hostIp`:$port"
        Write-Host " 管理面板  : http://$hostIp`:$port/management.html"
        if ($mgmtShow) { Write-Host " 管理密码  : $mgmtShow" }
        elseif ($mgmt) { Write-Host " 管理密码  : (未知，请把新密码明文写入 config.yaml 的 secret-key 后重启)" }
        else { Write-Host " 管理面板  : 未启用 (config.yaml 中 secret-key 为空)" }
        if ($apiKey) { Write-Host " 客户端密钥: $apiKey" }
        Write-Host "=================================="
        exit 0
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

# 保留上一次日志
if (Test-Path $outLog) { Move-Item $outLog (Join-Path $logDir 'out.prev.log') -Force }
if (Test-Path $errLog) { Move-Item $errLog (Join-Path $logDir 'err.prev.log') -Force }

$p = Start-Process -FilePath $exe `
        -ArgumentList '--config', 'config.yaml' `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $outLog `
        -RedirectStandardError $errLog `
        -PassThru
Set-Content -Path $pidFile -Value $p.Id

Start-Sleep -Seconds 2
if (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) {
    Write-Host "[start] 启动成功 PID $($p.Id)  日志: logs\out.log"
    Write-Host ""
    Write-Host "======== CLIProxyAPI 信息 ========"
    Write-Host " API 接口  : http://$hostIp`:$port"
    Write-Host " 管理面板  : http://$hostIp`:$port/management.html"
    if ($mgmtShow) { Write-Host " 管理密码  : $mgmtShow" }
    elseif ($mgmt) { Write-Host " 管理密码  : (未知，请把新密码明文写入 config.yaml 的 secret-key 后重启)" }
    else { Write-Host " 管理面板  : 未启用 (config.yaml 中 secret-key 为空)" }
    if ($apiKey) { Write-Host " 客户端密钥: $apiKey" }
    Write-Host "=================================="
} else {
    Write-Host "[start] 进程已退出，可能配置有误，请查看 logs\err.log / logs\out.log"
    Get-Content $errLog -ErrorAction SilentlyContinue | Select-Object -First 20
    exit 1
}

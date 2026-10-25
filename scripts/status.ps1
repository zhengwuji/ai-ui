# CLIProxyAPI 状态检查
Set-Location $PSScriptRoot
$logDir = Join-Path $PSScriptRoot 'logs'
$pidFile = Join-Path $logDir 'pid.txt'

# 从 config.yaml 读取端口 / 管理密码 / API 密钥，用于显示
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

$proc = Get-Process -Name 'cli-proxy-api' -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "[status] 运行中  PID $($proc.Id)"
} else {
    Write-Host "[status] 未运行"
}

# 检查端口是否可连
$client = New-Object System.Net.Sockets.TcpClient
try {
    $task = $client.ConnectAsync($hostIp, [int]$port)
    if ($task.Wait(1500) -and $client.Connected) {
        Write-Host "[status] 端口 $port 可访问"
    } else {
        Write-Host "[status] 端口 $port 无响应"
    }
} catch {
    Write-Host "[status] 端口 $port 无响应"
} finally {
    $client.Close()
}

Write-Host ""
Write-Host "======== CLIProxyAPI 信息 ========"
Write-Host " API 接口  : http://$hostIp`:$port"
Write-Host " 管理面板  : http://$hostIp`:$port/management.html"
if ($mgmtShow) { Write-Host " 管理密码  : $mgmtShow" }
elseif ($mgmt) { Write-Host " 管理密码  : (未知，请把新密码明文写入 config.yaml 的 secret-key 后重启)" }
else { Write-Host " 管理面板  : 未启用 (config.yaml 中 secret-key 为空)" }
if ($apiKey) { Write-Host " 客户端密钥: $apiKey" }
Write-Host "=================================="

if (Test-Path (Join-Path $logDir 'out.log')) {
    Write-Host ""
    Write-Host "[status] 最近日志 (logs\out.log 末尾 5 行):"
    Get-Content (Join-Path $logDir 'out.log') -Tail 5 -ErrorAction SilentlyContinue
}

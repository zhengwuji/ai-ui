# CLIProxyAPI 停止脚本
Set-Location $PSScriptRoot
$logDir  = Join-Path $PSScriptRoot 'logs'
$pidFile = Join-Path $logDir 'pid.txt'

$stopped = $false

if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq 'cli-proxy-api') {
        Stop-Process -Id $oldPid -Force
        Write-Host "[stop] 已停止 PID $oldPid"
        $stopped = $true
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

# 兜底：按进程名清理（防止 pid 文件丢失）
Get-Process -Name 'cli-proxy-api' -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force
    Write-Host "[stop] 已停止残留进程 PID $($_.Id)"
    $stopped = $true
}

if (-not $stopped) { Write-Host "[stop] 没有在运行的 cli-proxy-api 进程" }

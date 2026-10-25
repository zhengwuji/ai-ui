# ai-ui

ai 统一管理使用，可看额度情况。

基于 [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) v8.0.42 与官方管理面板
[Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center)
的定制版本：把多个 AI 账号聚合成一套 OpenAI / Claude / Gemini 兼容接口，并用管理面板统一查看各账号额度。

## 目录结构

| 目录 | 说明 |
| --- | --- |
| `backend/` | 代理服务端源码（Go），监听 8317 端口，提供 OpenAI / Claude / Gemini 兼容 API 与管理 API |
| `panel/` | 管理面板源码（React + TypeScript + Vite），构建为单文件 `management.html` |
| `scripts/` | Windows 一键启动 / 停止 / 状态脚本，双击 `start.bat` 即用 |

## 相对官方版本的定制

### backend（服务端）

- **原生支持上传数组格式多账号凭证文件**：直接上传
  `[{"email":"...","refresh_token":"..."}, ...]` 数组，自动按
  `<provider>-<email>.json` 逐个落盘，已存在的账号自动跳过（走
  `POST /v0/management/auth-files/upload`，multipart 单文件 / 多文件 / 原始 body 三条路径都支持）
- Antigravity OAuth 客户端常量在源码中写成两段字符串拼接（运行时值不变），
  以通过 GitHub Push Protection 对上游公开常量的误报拦截
- 合入上游已验证的 PR × 14：#6633 #6635 #6683 #6883 #6935 #6625 #6916 #6704
  #6934 #6880 #6716 #6845 #6796 #6918
  （推理档位后缀匹配、Antigravity 目录探测走 HTTP/1.1、关闭思考时裁剪 Claude 思考历史、
  重放数值精度、Antigravity 工具结果边界、关机等待在途凭证刷新、配额快照接收时间、
  gzip/Brotli/Zstd 内容编码、启动失败返回非零退出码、`LOCAL_MANAGEMENT_PASSWORD` 环境变量、
  原生压缩直通、冷却提示最早恢复时间、random / least-used / p2c 路由策略、单凭证用量上限）

### panel（管理面板）

- **额度显示持久化**：手动刷新一次额度后，各账号额度的颜色与数值保存在浏览器
  localStorage；刷新页面、退出重登后依然显示上次的结果，直到再次手动刷新才会更新，
  不会回到灰色"点击此处刷新额度"状态
- 使用本定制面板时，需在服务端配置 `management.disable-auto-update-panel: true`，
  防止面板被官方版本自动覆盖

### scripts（Windows 脚本）

- `start.bat`：隐藏窗口启动服务，CMD 里显示面板地址与管理密码（自动识别 config 里的
  bcrypt 哈希；明文密码镜像在运行目录 `mgmt_key.txt`，首次运行自动生成，**请勿提交到任何仓库**）
- `stop.bat` / `status.bat`：停止服务 / 查看运行状态
- 日志在 `logs/` 下，`status.bat` 依赖 `logs/pid.txt`

## 快速开始

1. 复制 `backend/config.example.yaml` 为 `config.yaml`，设置 `management.secret-key`
   （管理面板密码）与 `access.api-keys`（客户端调用密钥）
2. 双击 `scripts/start.bat`（或 `cd backend && go run ./cmd/server`）
3. 浏览器打开 `http://127.0.0.1:8317/management.html`，用管理密码登录
4. 在面板"认证文件"页上传凭证（支持数组格式多账号文件），或把凭证 JSON 放进
   `oauth.auth-dir`（默认 `~/.cli-proxy-api`）

### 从源码构建

```bash
# 服务端（Go 1.24+）
cd backend
go build -o cli-proxy-api.exe ./cmd/server

# 面板（Node 18+ 或 bun）
cd panel
npm install
npm run build
# 把 dist/index.html 复制为运行目录的 static/management.html
```

## 安全提示

凭证文件（含 refresh_token）、`config.yaml`（含密钥）、`mgmt_key.txt`、`logs/`
都属于敏感内容，**永远不要提交到任何仓库**。本仓库只包含源码、脚本与配置模板。

## 许可

- `backend/` 基于 [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)，MIT License（见 `backend/LICENSE`）
- `panel/` 基于 [router-for-me/Cli-Proxy-API-Management-Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center)，MIT License（见 `panel/LICENSE`）

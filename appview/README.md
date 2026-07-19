# etzhayyim-project-github App migration

このディレクトリは `legacy-runtime` 実装を残したまま、App 版を段階移行するための配置先です。

## 対象 App services

- `github-hvks8vmc`

## App 実装方針

- 各 service は `projects/*/wasm/*-component` として順次実装。
- 既存 App runtime は互換運用のため維持。
- HTTP/cron/job エンドポイントから優先して移植。

## 実装済みコンポーネント

- `github-mcp-component` (`github-hvks8vmc` 対応)
  - `POST /api/mcp`, `POST /{nanoid}/api/mcp`
  - 既存互換 REST: `/jobs/git-flush`, `/api/state/*`, `/api/proposal`, `/api/issues`
- `github-webhook-bridge-component`
  - `GET|POST /webhooks` (公開URL: `https://github.etzhayyim.com/webhooks`)
  - GitHub App callback query を upstream (`https://git.systems.etzhayyim.dev/webhooks/github`) へ転送

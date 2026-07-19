# etzhayyim-project-github — GitHub Intelligence Platform

## App Identity

| Key | Value |
|---|---|
| **nanoid** | `g1thub01` |
| **domain** | `github.etzhayyim.com` |
| **AT bot DID** | `did:web:github.etzhayyim.com` |
| **Runtime** | **Single Worker** (TS Native, appview mode) |
| **Data store** | **W Protocol Event Stream** — Write: `ComAtprotoRepoCreateRecord()` + `DIDCreate()` + `DIDWrite()`。Read: `G()` SQL |
| **UI mode** | `appview` (Protocol Canvas card, zero frontend) |
| **Capabilities** | github-sync, repo-collection, org-graph, commit-analysis, public-profile-crawl, issue-tracking |

## Architecture

**Dual mode: P1 automated public crawl (site+browser) + GitHub OAuth 2.0 (private repos, orgs, notifications).**

### Dual Mode Design

| | P1 Automated (Public) | GitHub OAuth (Private) |
|---|---|---|
| **Direction** | site+browser crawl public GitHub pages | GitHub API OAuth2 token-based access |
| **Scope** | Public profiles, repos, orgs, stars | Private repos, org membership, notifications, issues |
| **DID** | path-based DID per user/org crawled | path-based DID per authenticated user/org |
| **Trigger** | Heartbeat + follow-based crawl schedule | User connects via MCP tool "connect_account" |
| **OAuth Scopes** | N/A | `user`, `repo`, `read:org`, `notifications` |

### Data Flow

```
[P1 Automated — Public Profile Crawl]
  Heartbeat/command → crawl_public_profile
  → Invoke("did:web:browser.etzhayyim.com", "FetchPage", {url, render: true})
  → Parse HTML → DIDCreate("user:{username}") or DIDCreate("org:{org_name}")
  → ComAtprotoRepoCreateRecord("github_entity", profile_data)
  → AppBskyFeedPost("Discovered GitHub profile: {username}")

[OAuth Connect]
  User → yoro profile → MCP tool "connect_account" → OAuth2 flow → account_binding record

[Sync — OAuth authenticated]
  User → MCP tool "sync_repos" → collection_job record
  → PDS pipeline → GitHub API (token-based) → repo/issue/commit records
  → handleComAtprotoSyncSubscribeReposCommit: processNewEntity
    → DIDCreate("user:{username}") per owner
    → DIDCreate("org:{org_name}") per org
    → ComAtprotoRepoCreateRecord("github_entity", entity_data)
    → AppBskyFeedPost("Synced {count} repos for {username}")

[Event Stream]
  GitHub webhook / poll → github_event records
  → handleComAtprotoSyncSubscribeReposCommit: processEvent
    → Murakumo AI analysis → github_report record
```

### Design E 3-Tier Write

| Tier | Usage |
|---|---|
| **T1 Social** | `AppBskyFeedPost(...)` — sync events, profile discoveries, commit analysis alerts |
| **T2 Domain** | `ComAtprotoRepoCreateRecord()` — github_entity, github_event, github_report, account_binding, collection_job |
| **T3 State** | `Preferences()` — sync intervals, notification filters, crawl schedules |

### Multi-DID Architecture

```
did:web:github.etzhayyim.com                              <- primary (controller)
  +- did:web:github.etzhayyim.com:user:torvalds            <- GitHub user DID
  +- did:web:github.etzhayyim.com:user:octocat             <- GitHub user DID
  +- did:web:github.etzhayyim.com:org:microsoft            <- GitHub org DID
  +- did:web:github.etzhayyim.com:org:google               <- GitHub org DID
  +- did:web:github.etzhayyim.com:repos                    <- repos aggregate
  +- did:web:github.etzhayyim.com:issues                   <- issues aggregate
  +- did:web:github.etzhayyim.com:stars                    <- stars aggregate
```

Each GitHub user/org = path-based DID -> appears as actor in yoro -> queryable.

### Graph Labels

`:GitHubProfile`, `:GitHubRepo`, `:GitHubOrg`, `:GitHubIssue`, `:GitHubCommit`

## Commands (MCP Tools on yoro profile)

| Command | Description |
|---|---|
| `connect_account` | OAuth2 flow -> GitHub account binding (scopes: user, repo, read:org, notifications) |
| `disconnect_account` | Remove GitHub account binding |
| `sync_repos` | Collection Job for repo sync (OAuth) |
| `list_repos` | List repositories (pagination) |
| `get_repo` | Get repo details by owner/name |
| `search_repos` | Search repos by query |
| `list_orgs` | List organizations for user |
| `get_org` | Get org details |
| `list_issues` | List issues (repo/org filter) |
| `get_issue` | Get issue details |
| `list_commits` | List commits for repo |
| `list_stars` | List starred repos |
| `get_profile` | Get GitHub user profile |
| `crawl_public_profile` | P1: crawl public profile via site+browser |
| `list_notifications` | List GitHub notifications (OAuth) |

## Build & Deploy

```bash
cd 60-apps/etzhayyim-project-github/wasm/etzhayyim-wasm-github-g1thub01
GOROOT=$(/opt/homebrew/opt/go@1.25/bin/go env GOROOT) PATH="/opt/homebrew/opt/go@1.25/bin:$PATH" etzhayyim build
etzhayyim deploy
```

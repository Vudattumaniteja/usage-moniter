# Research: Antigravity CLI Session and Quota Extraction

## Overview

This document investigates how the Antigravity CLI (`agy`) and Antigravity 2.0 desktop platform track, manage, and expose session limits, model quotas, and token consumption. It details the exact technical mechanisms, protocols, endpoints, payload schemas, and Windows-specific discovery procedures required to build a real-time provider adapter for the Windows AI Usage Notch Monitor.

Antigravity uses a local agent daemon and language server architecture. Rather than relying on public REST APIs, the primary mechanism for real-time quota extraction is querying an internal Connect-RPC service listening on `127.0.0.1`.

---

## 1. Antigravity Quota and Session Architecture

### Multi-Tiered Quota Pools

Antigravity groups AI consumption into two distinct model families:
1. **Gemini Models**: Native Google models (Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.5 Flash, Gemini 3.1 Pro).
2. **Claude and GPT Models**: Third-party models (Claude Opus 4.6, Claude Sonnet 4.6, GPT-OSS 120B).

Within each group, quota is governed by two complementary limit windows:
- **5-Hour Rolling Session Limit (300 minutes)**: Smooths short-term demand and fairly distributes global capacity. Quota is consumed proportionally to token cost.
- **Weekly Account Limit (10,080 minutes / 7 days)**: Tied directly to the user's subscription tier (e.g., Free, Google AI Pro, Google AI Ultra).

### Data Source Hierarchy

A real-time monitor on Windows should implement a 3-tier retrieval hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Antigravity 2.0 App / IDE Local Language Server          │
│    (Active when Antigravity GUI or IDE extension is open)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Fallback if app not running
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Antigravity CLI (`agy`) Embedded Localhost Server         │
│    (Active when `agy` is open, or managed by local daemon)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Fallback if offline/headless
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Google Cloud Code / Vertex AI Remote OAuth API           │
│    (Uses cached OAuth tokens from ~/.gemini/oauth_creds.json)│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Local Connect-RPC Protocol and Endpoints

Both the Antigravity desktop application (`language_server_windows_x64.exe`) and the `agy` CLI binary (`agy.exe`) host an embedded Connect-RPC HTTPS server bound to loopback (`127.0.0.1`) on a dynamic port.

### Connection Parameters

- **Transport**: HTTPS (Self-signed localhost certificate; client must bypass certificate validation on `127.0.0.1`).
- **Protocol**: Connect-RPC (JSON over HTTP/1.1 or HTTP/2).
- **Request Method**: `POST`
- **Standard Headers**:
  - `Content-Type`: `application/json`
  - `Connect-Protocol-Version`: `1`
  - `X-Codeium-Csrf-Token`: `<csrf_token>` *(Required for App/IDE processes; empty or omitted for standalone `agy.exe`)*.

---

### Primary Endpoint: `RetrieveUserQuotaSummary`

The primary and authoritative endpoint for quota tracking in Antigravity 2.x is `RetrieveUserQuotaSummary`.

- **Path**: `/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary`
- **Request Body**: `{}`

#### Verified Response Payload

```json
{
  "response": {
    "groups": [
      {
        "displayName": "Gemini Models",
        "description": "Models within this group: Gemini Flash, Gemini Pro",
        "buckets": [
          {
            "bucketId": "gemini-weekly",
            "displayName": "Weekly Limit Remaining",
            "description": "You have used some of your weekly limit, it will fully refresh in 4 days, 15 hours.",
            "window": "weekly",
            "remainingFraction": 0.7375718,
            "resetTime": "2026-09-02T10:30:34Z"
          },
          {
            "bucketId": "gemini-5h",
            "displayName": "Five Hour Limit Remaining",
            "description": "You have used some of your 5-hour limit, it will fully refresh in 3 hours, 34 minutes.",
            "window": "5h",
            "remainingFraction": 0.6798452,
            "resetTime": "2026-08-28T22:22:02Z"
          }
        ]
      },
      {
        "displayName": "Claude and GPT models",
        "description": "Models within this group: Claude Opus, Claude Sonnet, GPT-OSS",
        "buckets": [
          {
            "bucketId": "3p-weekly",
            "displayName": "Weekly Limit Remaining",
            "window": "weekly",
            "remainingFraction": 1.0,
            "resetTime": "2026-09-04T18:47:26Z"
          },
          {
            "bucketId": "3p-5h",
            "displayName": "Five Hour Limit Remaining",
            "window": "5h",
            "remainingFraction": 1.0,
            "resetTime": "2026-08-28T23:47:26Z"
          }
        ]
      }
    ],
    "description": "Within each group, models share a weekly limit and a 5-hour limit. Quota is consumed proportionally to the cost of the tokens."
  }
}
```

#### Field Semantics
- `response.groups[]`: High-level model pools (`Gemini Models`, `Claude and GPT models`).
- `buckets[].bucketId`: Stable identifiers (`gemini-5h`, `gemini-weekly`, `3p-5h`, `3p-weekly`).
- `buckets[].window`: Cadence window (`5h` or `weekly`).
- `buckets[].remainingFraction`: Float between `0.0` (exhausted) and `1.0` (100% remaining).
- `buckets[].resetTime`: ISO-8601 UTC timestamp string representing when the window refreshes.
- `buckets[].disabled`: Optional boolean indicating if the model pool is disabled for this tier.

---

### Fallback Endpoint 1: `GetUserStatus`

Used if `RetrieveUserQuotaSummary` is unavailable (e.g. older language server builds).

- **Path**: `/exa.language_server_pb.LanguageServerService/GetUserStatus`
- **Request Body**: `{}`
- **Response Fields**:
  - `userStatus.userEmail`: Authenticated Google account email.
  - `userStatus.plan`: User plan tier (`free`, `pro`, `ultra`).
  - `userStatus.modelConfigs[]`: Array of models with individual `quotaInfo` objects containing `remainingFraction` and `resetTime`.

---

### Fallback Endpoint 2: `GetCommandModelConfigs`

Provides a catalog of all supported models, tier permissions, and per-model quota fractions.

- **Path**: `/exa.language_server_pb.LanguageServerService/GetCommandModelConfigs`
- **Request Body**: `{}`
- **Models Returned**: `Gemini 3.7 Flash`, `Gemini 3.6 Flash`, `Gemini 3.5 Flash`, `Gemini 3.1 Pro`, `Claude Sonnet 4.6`, `Claude Opus 4.6`, `GPT-OSS 120B`.

---

### Port Connectivity Probe: `GetUnleashData`

A lightweight call to test whether a discovered port is an active LanguageServer Connect-RPC port.

- **Path**: `/exa.language_server_pb.LanguageServerService/GetUnleashData`
- **Request Body**: `{}`
- **Response**: `200 OK` with JSON configuration payload.

---

## 3. Windows Process and Port Discovery Procedure

On Windows, the local daemon or Tauri application discovers the active Antigravity port and credentials through a 4-step sequence:

```
Step 1: Process Scan ──> Step 2: Extract CLI Args ──> Step 3: Enumerate TCP Ports ──> Step 4: HTTPS Probe
(Win32_Process)          (--csrf_token)               (Get-NetTCPConnection)          (RetrieveUserQuotaSummary)
```

### Step 1: Scan for Running Processes

Locate active Antigravity language server processes or `agy.exe` instances.

**PowerShell equivalent**:
```powershell
Get-CimInstance Win32_Process -Filter "Name = 'agy.exe' OR Name LIKE '%language_server%'" | Select-Object ProcessId, CommandLine, ExecutablePath
```

**Process Targets**:
- `language_server_windows_x64.exe` (Antigravity 2.0 app or IDE extension).
- `agy.exe` (Default location: `%LOCALAPPDATA%\agy\bin\agy.exe`).

### Step 2: Extract Command-Line Arguments

When scanning `language_server_windows_x64.exe`, extract:
- `--csrf_token <token>`: Passed in the `X-Codeium-Csrf-Token` request header.
- `--app_data_dir <dir>`: Distinguishes between standalone app (`antigravity`) and IDE extension (`antigravity-ide`).
- `--extension_server_port <port>`: Optional HTTP fallback port.

*(Note: `agy.exe` processes do not require a CSRF token).*

### Step 3: Enumerate Listening TCP Ports for Process ID

Identify all local ports listening under the target PID.

**PowerShell equivalent**:
```powershell
Get-NetTCPConnection -OwningProcess <PID> -State Listen | Where-Object { $_.LocalAddress -in @('127.0.0.1', '0.0.0.0', '::') } | Select-Object LocalPort
```

**In Rust (Tauri native backend)**:
Call `GetExtendedTcpTable` from `iphlpapi.dll` with `TCP_TABLE_OWNER_PID_LISTENER` to list listening ports for the PID without spawning external shells.

### Step 4: Probe Connect-RPC HTTPS Port

Loop through the discovered listening ports and send an HTTPS `POST` request to `/exa.language_server_pb.LanguageServerService/GetUnleashData` or `/RetrieveUserQuotaSummary` with `Connect-Protocol-Version: 1`. The first port returning `200 OK` is selected as the active connect port.

---

## 4. Standalone CLI Background Daemon Management

When the user is not running the full Antigravity GUI application, our desktop app can keep a background `agy` instance alive to maintain access to the rich `RetrieveUserQuotaSummary` endpoint.

### Daemon Lifecycle Guidelines

1. **Discovery & Path Detection**:
   - Check standard path `%LOCALAPPDATA%\agy\bin\agy.exe` or resolve via `Get-Command agy`.
2. **Spawning**:
   - Launch `agy.exe` in background mode with redirected standard input/output.
   - Wait 1.5 to 3.0 seconds for internal keyring authentication and port binding.
3. **Buffer Draining**:
   - Continuously drain stdout/stderr streams to prevent buffer saturation on Windows anonymous pipes.
4. **Idle Timeout**:
   - Keep the process warm during active user interactions.
   - If no usage query occurs for 180 seconds, terminate the background `agy.exe` process to conserve memory.
5. **App Shutdown Cleanup**:
   - Register process handle on Windows job object or send `WM_CLOSE`/`SIGTERM` tree termination on app exit.

---

## 5. Remote Google Cloud OAuth Fallback

If local language server processes cannot be started or probed, the provider adapter can fall back to remote Google Cloud Code APIs using local credentials.

### Credential Locations
- `~/.gemini/oauth_creds.json`
- `~/.gemini/jetski-standalone-oauth-token`
- Windows Credential Manager

### Remote Endpoints
- `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary`
- `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota`
- `POST https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`

**Headers**:
- `Authorization`: `Bearer <access_token>`
- `Content-Type`: `application/json`

---

## 6. Normalization and Mapping to Domain Model

The extracted Connect-RPC payload maps cleanly to our domain's `UsageSnapshot`:

```typescript
export interface UsageSnapshot {
  provider: 'antigravity';
  sessionUsedPercent: number;    // 5-hour rolling session percentage (0-100)
  sessionResetTime?: string;     // ISO-8601 UTC timestamp or formatted countdown
  modelUsedPercent?: number;     // Weekly baseline quota percentage (0-100)
  modelResetTime?: string;       // ISO-8601 UTC timestamp for weekly reset
  status: 'ok' | 'warning' | 'exhausted' | 'unauthenticated' | 'error';
  rawDetails?: {
    geminiSessionUsed: number;
    geminiWeeklyUsed: number;
    claudeSessionUsed: number;
    claudeWeeklyUsed: number;
    accountEmail?: string;
    accountPlan?: string;
  };
}
```

### Normalization Logic

```typescript
function normalizeAntigravityQuota(summaryResponse: any): UsageSnapshot {
  const groups = summaryResponse?.response?.groups || [];
  
  // Find Gemini group and Claude/GPT group
  const geminiGroup = groups.find((g: any) => g.displayName?.toLowerCase().includes('gemini'));
  const thirdPartyGroup = groups.find((g: any) => 
    g.displayName?.toLowerCase().includes('claude') || g.displayName?.toLowerCase().includes('gpt')
  );

  const gemini5h = geminiGroup?.buckets?.find((b: any) => b.window === '5h' || b.bucketId?.includes('5h'));
  const geminiWeekly = geminiGroup?.buckets?.find((b: any) => b.window === 'weekly' || b.bucketId?.includes('weekly'));
  
  const tp5h = thirdPartyGroup?.buckets?.find((b: any) => b.window === '5h' || b.bucketId?.includes('5h'));
  const tpWeekly = thirdPartyGroup?.buckets?.find((b: any) => b.window === 'weekly' || b.bucketId?.includes('weekly'));

  // Calculate used percentages: (1 - remainingFraction) * 100
  const sessionRemaining = gemini5h?.remainingFraction ?? 1.0;
  const weeklyRemaining = geminiWeekly?.remainingFraction ?? 1.0;
  
  const sessionUsedPercent = Math.max(0, Math.min(100, Math.round((1.0 - sessionRemaining) * 100)));
  const modelUsedPercent = Math.max(0, Math.min(100, Math.round((1.0 - weeklyRemaining) * 100)));

  // Determine health status
  let status: UsageSnapshot['status'] = 'ok';
  if (sessionUsedPercent >= 100 || modelUsedPercent >= 100) {
    status = 'exhausted';
  } else if (sessionUsedPercent >= 80 || modelUsedPercent >= 80) {
    status = 'warning';
  }

  return {
    provider: 'antigravity',
    sessionUsedPercent,
    sessionResetTime: gemini5h?.resetTime,
    modelUsedPercent,
    modelResetTime: geminiWeekly?.resetTime,
    status,
    rawDetails: {
      geminiSessionUsed: sessionUsedPercent,
      geminiWeeklyUsed: modelUsedPercent,
      claudeSessionUsed: tp5h ? Math.round((1.0 - (tp5h.remainingFraction ?? 1.0)) * 100) : 0,
      claudeWeeklyUsed: tpWeekly ? Math.round((1.0 - (tpWeekly.remainingFraction ?? 1.0)) * 100) : 0,
    }
  };
}
```

---

## 7. Concrete Implementation Recommendations for Tauri App

1. **Rust Backend Implementation (`src-tauri`)**:
   - Implement an `AntigravityPortScanner` in Rust utilizing `iphlpapi.dll` (`GetExtendedTcpTable`) to detect listening ports of `agy.exe` and `language_server_windows_x64.exe` with sub-millisecond overhead.
   - Use `reqwest` with `.danger_accept_invalid_certs(true)` to probe `https://127.0.0.1:<port>` endpoints.
   - Expose a single Tauri command: `get_antigravity_usage() -> Result<UsageSnapshot, String>`.

2. **Polling Frequency**:
   - **Active State (UI Open / Visible)**: Poll every 30 seconds.
   - **Warning / Near-Limit State (>80% used)**: Poll every 10 seconds.
   - **Idle / Minimized**: Poll every 60 seconds.

3. **UI Display in Notch & Popover**:
   - **Usage Ring**: Render `sessionUsedPercent` (5-hour limit) as the main ring fill and `modelUsedPercent` (weekly limit) as an accent or secondary ring.
   - **Popover Card**: Display separate gauges for **Gemini Models** (5h + Weekly) and **Claude & GPT Models** (5h + Weekly), along with live countdown timers targeting `resetTime`.

---

## 8. Primary Sources Cited

1. **Google Antigravity CLI Reference & Documentation**:
   - `https://antigravity.google/docs/cli/reference`
   - `https://antigravity.google/docs/cli/features`
2. **Local Machine Runtime Probes**:
   - Active `agy.exe` binary at `C:\Users\Manit\AppData\Local\agy\bin\agy.exe`
   - Live Connect-RPC HTTPS response on `127.0.0.1` verified against `RetrieveUserQuotaSummary` and `GetUserStatus`
3. **Open-Source Provider Implementations**:
   - CodexBar Antigravity Provider (`steipete/CodexBar/docs/antigravity.md`, `AntigravityStatusProbe.swift`, `AntigravityCLISession.swift`)
   - Open VSX Antigravity Language Server Protocol Specifications

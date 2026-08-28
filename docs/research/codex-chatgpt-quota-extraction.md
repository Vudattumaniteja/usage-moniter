# Research: Codex and ChatGPT Personal Usage Rate Limit Extraction

## Overview

This document analyzes the mechanisms, endpoints, session tokens, and local credential stores available to extract personal ChatGPT Plus/Team rolling limits and OpenAI API quota metrics programmatically for the Windows desktop usage monitor.

Tracking OpenAI usage spans two distinct architectures:
1. **ChatGPT Web and Codex CLI Limits**: Account-level rolling caps (such as 3-hour or 5-hour rolling limits and 7-day secondary limits) for ChatGPT Plus, Team, Pro, and Codex CLI users.
2. **OpenAI Platform API Limits**: Organization and project quotas measured in requests per minute (RPM), tokens per minute (TPM), and monthly dollar spend.

---

## 1. ChatGPT Web and Codex CLI Quota Extraction

### Primary Endpoint: `GET https://chatgpt.com/backend-api/wham/usage`

The primary endpoint used by the OpenAI Codex CLI and desktop tools to query live rate limit utilization is the internal `wham/usage` route.

- **URL**: `https://chatgpt.com/backend-api/wham/usage`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer <chatgpt_access_token>`
  - `User-Agent`: Standard browser or client user agent
  - `Accept`: `application/json`
  - `chatgpt-account-id`: `<optional_account_id>` (Required for workspace and Team accounts to target specific workspaces)

### Response Payload Schema

```json
{
  "plan_type": "plus",
  "rate_limit": {
    "allowed": true,
    "limit_reached": false,
    "primary_window": {
      "used_percent": 24,
      "limit_window_seconds": 18000,
      "reset_after_seconds": 7320,
      "reset_at": 1776111121
    },
    "secondary_window": {
      "used_percent": 8,
      "limit_window_seconds": 604800,
      "reset_after_seconds": 541200,
      "reset_at": 1776672455
    }
  },
  "credits": {
    "has_credits": false,
    "unlimited": false,
    "balance": "0"
  }
}
```

### Response Field Semantics

- `plan_type`: String identifier for the subscription tier. Known values include `plus`, `pro`, `team`, `free`, `enterprise`, `business`, and `prolite`. Adapters must treat this as an open string rather than a rigid enum to prevent crashes when new plan tiers appear.
- `rate_limit.allowed`: Boolean indicating if requests are currently permitted.
- `rate_limit.limit_reached`: Boolean indicating if the active rolling window is saturated.
- `rate_limit.primary_window`: Represents the short-term rolling rate limit window (e.g. 5 hours / 18,000 seconds or 3 hours / 10,800 seconds depending on plan and model configuration).
  - `used_percent`: Integer or float percentage (0 to 100) of consumed quota.
  - `limit_window_seconds`: Total window duration in seconds.
  - `reset_after_seconds`: Seconds remaining until full reset.
  - `reset_at`: Unix timestamp in seconds when the window resets.
- `rate_limit.secondary_window`: Represents the long-term rolling quota window (e.g. 7-day / 604,800 seconds weekly limit).
  - `used_percent`: Integer or float percentage (0 to 100) of weekly quota consumed.
  - `reset_at`: Unix timestamp in seconds for weekly reset.
- `credits`: Structured object containing reset credit balances or additional prepaid compute credits.

### Reset Credits Endpoint: `GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits`

- **URL**: `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits`
- **Method**: `GET`
- **Headers**: Same Bearer authentication as `wham/usage`.
- Returns available promotional or paid reset credit vouchers that bypass or reset a saturated window.

---

## 2. OpenAI Platform API Quota and Rate Limit Extraction

For users using standard OpenAI Platform API keys (`sk-...`), quota metrics are exposed through response headers and organization admin endpoints.

### Real-Time Response Headers (`x-ratelimit-*`)

Every request sent to `https://api.openai.com/v1/chat/completions` or `https://api.openai.com/v1/responses` returns real-time quota state in HTTP headers:

| Header Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `x-ratelimit-limit-requests` | Integer | Maximum requests allowed per minute (RPM) | `500` |
| `x-ratelimit-remaining-requests` | Integer | Remaining requests in the current 1-minute window | `482` |
| `x-ratelimit-reset-requests` | Duration string | Time until the request quota window resets | `2.16s` or `15ms` |
| `x-ratelimit-limit-tokens` | Integer | Maximum tokens allowed per minute (TPM) | `30000` |
| `x-ratelimit-remaining-tokens` | Integer | Remaining tokens in current 1-minute window | `27400` |
| `x-ratelimit-reset-tokens` | Duration string | Time until the token quota window resets | `520ms` |
| `Retry-After` | Integer | Seconds to wait before retry (returned on HTTP 429) | `6` |

### Organization Usage and Costs Endpoints

For macro usage metrics (aggregate token volume and billing spend), OpenAI provides organization endpoints requiring an Organization Admin API Key (`OPENAI_ADMIN_KEY`):

1. **Completions Token Usage**:
   - `GET https://api.openai.com/v1/organization/usage/completions?start_time={unix_epoch}&end_time={unix_epoch}&bucket_width=1d`
   - Returns time-bucketed input tokens, output tokens, and cached tokens grouped by project or model.
2. **Organization Costs**:
   - `GET https://api.openai.com/v1/organization/costs?start_time={unix_epoch}&end_time={unix_epoch}`
   - Returns monetary amount spent against monthly credit limits.

*Limitation*: Standard developer API keys (`sk-proj-...`) cannot access `/v1/organization/usage/*` unless granted Admin permissions.

---

## 3. Local Credential Extraction and Auth Token Storage

### Method A: OpenAI Codex CLI Cached Credentials (`auth.json`)

When a developer runs `codex login`, credentials are saved locally in plaintext JSON.

- **Windows Path**: `%USERPROFILE%\.codex\auth.json` (e.g. `C:\Users\<username>\.codex\auth.json`)
- **macOS/Linux Path**: `~/.codex/auth.json`

#### File Structure

```json
{
  "auth_mode": "chatgpt",
  "tokens": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "rt_...",
    "id_token": "eyJhbGciOiJSUzI1NiIs...",
    "account_id": "user-..."
  }
}
```

#### Token Refresh Mechanics and Rotation Warning

- **OAuth Client ID**: `app_EMoamEEZ73f0CkXaXp7hrann` (Public client, PKCE)
- **Token Endpoint**: `POST https://auth.openai.com/oauth/token`
- **Refresh Payload**:
  ```json
  {
    "client_id": "app_EMoamEEZ73f0CkXaXp7hrann",
    "grant_type": "refresh_token",
    "refresh_token": "<current_refresh_token>"
  }
  ```
- **Token Rotation Risk**: OpenAI uses refresh token rotation. When a refresh request succeeds, the previous `refresh_token` becomes invalid and a new one is returned. If our monitor app calls the refresh endpoint independently of Codex CLI without updating `%USERPROFILE%\.codex\auth.json`, Codex CLI will fail on its next launch with `refresh_token_reused`.
- **Recommendation**: The desktop monitor should read `tokens.access_token` passively. If the access token expires (HTTP 401), re-read the file in case Codex CLI refreshed it. If our app performs the refresh directly, it must write back the new `refresh_token` and `access_token` to `%USERPROFILE%\.codex\auth.json` atomically.

### Method B: ChatGPT Web Browser Session Extraction

ChatGPT web users authenticate via NextAuth on `chatgpt.com`.

- **Session Endpoint**: `GET https://chatgpt.com/api/auth/session`
- **Cookies**: `__Secure-next-auth.session-token` or `__Secure-next-auth.callback-url`
- **Windows Browser Stores**:
  - Google Chrome: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Network\Cookies`
  - Microsoft Edge: `%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Network\Cookies`
  - Firefox: `%APPDATA%\Mozilla\Firefox\Profiles\<profile>\cookies.sqlite`
- **Mechanism**: On Windows, Chromium browsers encrypt cookies with AES-256-GCM using a master key encrypted via Windows DPAPI inside `%LOCALAPPDATA%\<Browser>\User Data\Local State`. Extracting these cookies requires reading the SQLite file (using a temporary copy to avoid file locks) and decrypting with the Windows CryptUnprotectData API.
- **Payload from `/api/auth/session`**:
  ```json
  {
    "user": {
      "id": "user-...",
      "name": "User Name",
      "email": "user@example.com",
      "image": "https://..."
    },
    "expires": "2026-09-28T00:00:00.000Z",
    "accessToken": "eyJhbGciOi..."
  }
  ```

### Method C: Manual User Bearer Token / API Key Input

To avoid brittle cookie scraping and file permission issues:
1. Provide a Settings input field where users can paste their ChatGPT `accessToken` or OpenAI API key.
2. Store the token in the Windows Credential Manager via Tauri's keyring plugin or encrypted local SQLite.

---

## 4. Mapping to the App Domain Model

The data extracted from `https://chatgpt.com/backend-api/wham/usage` maps directly into our `UsageSnapshot` model defined in `CONTEXT.md`:

```typescript
import { UsageSnapshot } from '../types';

export function mapWhamUsageToSnapshot(data: WhamUsageResponse): UsageSnapshot {
  const primary = data.rate_limit?.primary_window;
  const secondary = data.rate_limit?.secondary_window;
  const isExhausted = data.rate_limit?.limit_reached || (primary && primary.used_percent >= 100);

  let status: UsageSnapshot['status'] = 'ok';
  if (isExhausted) {
    status = 'exhausted';
  } else if (primary && primary.used_percent >= 80) {
    status = 'warning';
  }

  return {
    provider: 'codex',
    sessionUsedPercent: primary ? primary.used_percent : 0,
    sessionResetTime: primary ? primary.reset_at * 1000 : Date.now(),
    modelUsedPercent: secondary ? secondary.used_percent : undefined,
    modelResetTime: secondary ? secondary.reset_at * 1000 : undefined,
    status
  };
}
```

---

## 5. Failure Modes and Resilience Strategy

1. **HTTP 401 Unauthorized**:
   - Cause: Expired `access_token` or revoked session.
   - Action: Set status to `unauthenticated`. Attempt to re-read `%USERPROFILE%\.codex\auth.json` or trigger a refresh.
2. **HTTP 429 Rate Limiting on `wham/usage`**:
   - Cause: Aggressive polling.
   - Action: Enforce a minimum polling interval of 60 to 120 seconds. Back off exponentially if 429 is received.
3. **Schema Variations (`null` windows or new `plan_type`)**:
   - Cause: Fresh accounts or idle periods where `primary_window` is omitted, or new plan variants like `prolite`.
   - Action: Use optional chaining and default `used_percent` to 0 when `primary_window` is null. Parse `plan_type` as a loose string.
4. **Multi-Workspace Accounts**:
   - If an account belongs to multiple organizations or Team workspaces, pass the `chatgpt-account-id` header to query the intended workspace.

---

## 6. Implementation Recommendations

1. **Primary Provider Adapter (`CodexAdapter`)**:
   - Read `%USERPROFILE%\.codex\auth.json` on startup.
   - If present and `auth_mode == "chatgpt"`, extract `tokens.access_token` and `tokens.account_id`.
   - Poll `https://chatgpt.com/backend-api/wham/usage` every 60 seconds from the Tauri Rust backend (avoiding browser CORS restrictions).
2. **Fallback Manual Token Input**:
   - Allow users without the Codex CLI to paste their session `accessToken` in the popover settings.
3. **Platform API Fallback (`OpenAIPlatformAdapter`)**:
   - If user supplies a standard API Key (`sk-...`), monitor `x-ratelimit-*` headers during requests or query `/v1/organization/usage/completions` if an Admin key is configured.
4. **Storage Security on Windows**:
   - Store manual tokens using Windows DPAPI or the system credential vault.

---

## Primary Sources & References

- [OpenAI Rate Limits Documentation](https://platform.openai.com/docs/guides/rate-limits)
- [OpenAI Organization Usage API Reference](https://platform.openai.com/docs/api-reference/usage)
- [CodexBar Reverse Engineering Reference (`steipete/CodexBar`)](https://github.com/steipete/CodexBar)
- [OpenAI OAuth Token Specification (`auth.openai.com`)](https://auth.openai.com/oauth/token)

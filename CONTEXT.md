# Domain Context

## Glossary

### Notch
The screen-edge docked overlay window pinned to the right edge of the Windows desktop displaying live AI service usage gauges. Uses an organic cubic Bezier fillet boundary (`generateRightEdgeNotchPath`) in pitch black (`#050505`) with soft shadow over transparent frameless windowing.

### Usage Ring
The circular progress gauge inside the Notch representing the percentage of session quota used for a given provider. Each ring contains a dark inner button with the official brand SVG logo (`AntigravityLogo`, `OpenAILogo`), a circular progress stroke, and a numeric percentage readout underneath.

### Popover Card
The dark speech-bubble card (`#0c0d10`) that expands to the left of the Notch when hovering or clicking a Usage Ring. Includes a directional caret pointing to the active ring, and displays:
- Provider identity and plan badge
- **Current session** progress bar and remaining countdown timer
- **Model / Weekly quota** progress bar and reset target

### Provider Adapter
A backend module responsible for extracting and normalizing session quota, rate limits, and reset timestamps from a specific AI tool or service.
- **Antigravity Adapter:** Probes local Connect-RPC endpoint `POST http://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary` discovered via Win32 process list and TCP table.
- **Codex Adapter:** Queries `GET https://chatgpt.com/backend-api/wham/usage` with Bearer token read from `%USERPROFILE%\.codex\auth.json`.

### Usage Snapshot
The normalized data record for an AI provider, containing:
- `provider`: Provider identifier (`antigravity`, `codex`)
- `sessionUsedPercent`: Percentage of current session quota used (0–100)
- `sessionResetTime`: Timestamp or millisecond countdown until the current session limit resets
- `modelUsedPercent`: Percentage of rolling model limit used (if applicable)
- `modelResetTime`: Timestamp or millisecond countdown until the rolling limit resets
- `status`: Health status (`ok`, `warning`, `exhausted`, `unauthenticated`, `error`)

## Design & UI Architecture

- **Visual Baseline:** Variant A (Organic Bezier Notch with speech-bubble popover card).
- **Supported Providers (Phase 1):** Google Antigravity & OpenAI Codex / ChatGPT.
- **Color Codes:**
  - Antigravity: `#38bdf8` (Sky Blue) / `#eab308` (Lime Yellow)
  - Codex / ChatGPT: `#10b981` (Emerald Green)
  - Warning status (80%+): `#ff9f0a` (Amber)
  - Exhausted status (95%+): `#ff453a` (Red/Rose)

## Operational Policies & Architecture

### Polling Cadence
- **Antigravity (Local):** 15-second loopback Connect-RPC poll. Passive probe when process is closed.
- **Codex (Remote):** 60-second HTTPS poll to `chatgpt.com/backend-api/wham/usage`.
- **On-demand Refresh:** Debounced 5-second poll triggered on popover hover or click.

### Countdown Interpolation
- 1-second client-side clock tick against `resetTime` / `reset_at`.
- Verification poll triggered at zero countdown (`Ready`) with single 15-second retry if quota is still reported saturated.

### Caching & Persistence
- Persisted to `%LOCALAPPDATA%\usage-monitor\cache.json`.
- Instant startup render with syncing state; snapshots older than 15 minutes flagged as stale.

### Error Handling & Backoff
- **401 Unauthenticated:** Suspend polling; auto-resume on `%USERPROFILE%\.codex\auth.json` file change or manual retry.
- **429 Rate Limit:** Exponential backoff (30s -> 60s -> 120s -> 300s max) or respect `Retry-After`.
- **Offline:** Pause remote calls; resume on OS network reconnection event.


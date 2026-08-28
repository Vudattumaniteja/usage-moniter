# Domain Context

## Glossary

### Notch
The screen-edge docked overlay window pinned to the edge of the Windows desktop displaying live AI service usage gauges.

### Usage Ring
The circular progress gauge inside the Notch representing the percentage of session or model quota used for a given provider.

### Popover Card
The card that expands when hovering or clicking a Usage Ring, showing detailed session consumption, model limits, and reset countdown timers.

### Provider Adapter
A backend module responsible for extracting and normalizing session quota, rate limits, and reset timestamps from a specific AI tool or service.

### Usage Snapshot
The normalized data record for an AI provider, containing:
- `provider`: Provider identifier (`antigravity`, `codex`, `claude`)
- `sessionUsedPercent`: Percentage of current session quota used
- `sessionResetTime`: Timestamp or countdown until the current session limit resets
- `modelUsedPercent`: Percentage of rolling model limit used (if applicable)
- `modelResetTime`: Timestamp or countdown until the rolling limit resets
- `status`: Health status (`ok`, `warning`, `exhausted`, `unauthenticated`, `error`)

# Usage Monitor

A persistent Windows desktop overlay displaying real-time quota and session limits for AI providers.

## Language

**Notch**:
The edge-docked floating overlay window pinned to the screen border displaying AI provider gauges.
_Avoid_: Island, sidebar, widget, dock

**Provider**:
An AI development tool or assistant whose usage limits and reset windows are tracked (such as Antigravity or Codex).
_Avoid_: Engine, model, vendor, backend

**Session Quota**:
The active rolling window usage limit and remaining time before reset for a Provider.
_Avoid_: Rate limit, token bucket, hourly limit

**Usage Gauge**:
The circular progress ring showing the percentage of current quota consumed by a Provider.
_Avoid_: Meter, spinner, ring, dial

**Hover Card**:
The expandable informational card that reveals detailed session and model reset statistics when interacting with a Provider gauge.
_Avoid_: Tooltip, popover, flyout, modal

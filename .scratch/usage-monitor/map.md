# Map: Usage Monitor Notch Overlay

## Destination

A complete, runnable Windows desktop app running as a persistent right-edge notch overlay that displays real-time session quotas, usage percentages, and reset countdowns for Antigravity CLI and Codex/ChatGPT.

## Notes

- Domain: Windows desktop overlay, AI session quota tracking, transparent frameless UI.
- Skills: `codebase-design`, `tdd`, `unslop`.
- Coding standards: Follow AGENTS.md (TypeScript/modular code, TDD for business logic, clean separation of data fetching and UI rendering).
- Focus for initial milestone: Antigravity and Codex providers only.

## Decisions so far

<!-- the index: one line per closed ticket -->

## Not yet specified

- Handling fullscreen application detection and notch auto-hide behavior.
- Support and pluggable adapter architecture for additional providers (Claude, Cursor, Copilot).
- Windows system tray menu, startup on boot, and settings modal for credential management.
- Desktop toast notifications when quota utilization crosses critical thresholds (e.g. 80%, 95%).

## Out of scope

- macOS and Linux window manager support for this effort (Windows only).
- Payment processing or automatic quota top-up purchases.

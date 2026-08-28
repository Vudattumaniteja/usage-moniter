# Issue authoring

Guide for creating backlog issues, managing triage gates, and preparing tickets for autonomous agent runs in this repository.

## Execution model

Autonomous execution follows atomic task isolation:
- **One issue, one session**: Each task runs in a dedicated agent session with a clean context window.
- **Strict gating**: Agents only pick up issues that satisfy both specification and authorization gates.
- **Verifiable handoff**: An issue must be implemented, verified with local tests and builds, and merged via pull request before moving to the next issue.

## Issue authoring standard

All issues created for automated or semi-automated execution must contain these four sections:

```markdown
## Objective
A concise 1 to 2 sentence summary of what must be built or fixed and why.

## Acceptance Criteria
- [ ] Explicit behavior or API contract fulfilled
- [ ] Target files created or updated at specific paths
- [ ] Edge cases and error states handled

## Verification Plan
- Automated tests: `pnpm test` (or `pnpm test <path-to-test>`)
- Build verification: `pnpm build`

## Dependencies
- `Blocked by: #<id>` (or `None`)
- `Part of #<parent-id>` (if belonging to an epic)
```

## Ticket classification

### 1. Atomic child issues
- Scoped to a single verifiable behavior or bug fix that completes in one session.
- Carries exact acceptance criteria and executable verification commands.
- Marked with `ready-for-agent` once fully specified.
- Marked with `AFK` once authorized for unattended execution.

### 2. Parent epics
- Groups related child issues, milestones, or multi-step features.
- Carries the `epic` label.
- Lists child tasks as a checklist linking to child issue numbers.

## Triage and gating labels

| Label | Role | Action |
| ----- | ---- | ------ |
| `needs-triage` | Newly created or unreviewed | Skipped by runner |
| `needs-info` | Missing details or clarification | Skipped by runner |
| `ready-for-agent` | Fully specified for autonomous execution | Evaluated for gate readiness |
| `AFK` | Unattended execution authorized | Evaluated for gate readiness |
| `ready-for-human` | Requires human implementation | Skipped by runner |
| `status blocked` | Execution halted due to an issue blocker | Halts execution immediately |
| `epic` | Parent tracking ticket | Informational |
| `wontfix` | Discarded | Skipped by runner |

### Applying labels via GitHub CLI

Mark an issue ready for autonomous execution:
```bash
gh issue edit <number> --add-label "ready-for-agent,AFK"
```

Mark an issue as blocked:
```bash
gh issue edit <number> --add-label "status blocked" --remove-label "ready-for-agent"
```

Mark a parent epic:
```bash
gh issue edit <number> --add-label "epic"
```

## Gating checklist

Before applying `ready-for-agent` and `AFK`, check that:
1. The objective defines what and why in 1 to 2 sentences.
2. Acceptance criteria use markdown checkboxes with concrete requirements.
3. Verification plan contains runnable terminal commands (`pnpm test`, `pnpm build`).
4. Dependencies explicitly state `None`, `Blocked by: #<id>`, or `Part of #<parent-id>`.
5. The issue scope fits inside a single context window session.

## Blocker protocol

If a worker encounters conflicting requirements, missing dependencies, broken environments, or failing tests outside the issue scope:
1. Apply the `status blocked` label:
   ```bash
   gh issue edit <number> --add-label "status blocked"
   ```
2. Post a diagnostic comment on the issue explaining the failure and required action.
3. Halt execution immediately.

## Reference templates

### Atomic child issue template

```markdown
## Objective
Add memory footprint calculation to the process monitor service to track per-process resource usage.

## Acceptance Criteria
- [ ] Calculate RSS memory in megabytes for each monitored process.
- [ ] Return memory stats in the process list payload from `src/services/processMonitor.ts`.
- [ ] Handle permission errors gracefully when inspecting elevated processes.

## Verification Plan
- `pnpm test src/services/__tests__/processMonitor.test.ts`
- `pnpm build`

## Dependencies
- None
```

### Parent epic template

```markdown
# Epic: Resource Monitoring Dashboard

Coordinate CPU, memory, and disk tracking widgets in the frontend interface.

## Child tasks
- [ ] #10 Implement process memory calculation service
- [ ] #11 Add process list table UI component
- [ ] #12 Connect UI to Tauri backend events

## Dependencies
- None
```

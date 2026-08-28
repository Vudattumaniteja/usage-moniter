# Triage labels

This file maps triage roles to the label strings used in this repository's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning |
| -------------------------- | -------------------- | ------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified for agent execution |
| `afk`                      | `AFK`                | Unattended execution authorized |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation |
| `blocked`                  | `status blocked`     | Execution halted due to an issue blocker |
| `epic`                     | `epic`               | Parent issue tracking child tasks |
| `wontfix`                  | `wontfix`            | Will not be actioned |

### Gating rule for automated workers

Autonomous agent execution requires both `ready-for-agent` (specification gate) and `AFK` (authorization gate). See [issue-authoring.md](file:///C:/Users/Manit/projects/usage-moniter/docs/agents/issue-authoring.md).


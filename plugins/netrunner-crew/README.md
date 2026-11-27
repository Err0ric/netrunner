# netrunner-crew: hacker crabs for Claude Code subagents

Part of the [Netrunner theme for Claude Code](../../README.md). A fork of savvy-progress from [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit) (MIT).

- **Crew row**: while subagents run, one compact line above the prompt shows them as walking crabs in hacker outfits (hoodie, mohawk, radio, solder, cap, recon), with a count and the first one's task: `2 agents running · Refactor the parser ×2`. With the `netrunner` plugin it joins the WAITING line. It sizes itself to the window: up to 5 crabs, 3 in a narrow one, and the task cut with an ellipsis.
- **Agents panel** (`×N` on the row, or `/crew`; `/crew open` brings it forward without toggling): running, finished and planned subagents with model, effort, task progress, context, estimated cost and time.
- **Progress bar** for [savvy-flow](https://github.com/johnnyvizz/claude-kit) runs: the flow's title, phase and accepted tasks.
- No window opens on its own unless you ask for it (`autoOpen`).

## Tools it adds

- `mcp__netrunner-crew__progress`: an orchestrator reports the plan, phase and accepted tasks. Only the main session can.
- `mcp__netrunner-crew__step`: a worker reports its own steps (`done`, `total`, `note`).

Cost is a rough estimate from token counts and a built-in per-model price table (`PRICES` in `hooks/register.tsx`), not a bill.

## Settings

In `/config`, or in `~/.claude/settings.json` under `pluginConfigs` → `netrunner-crew@netrunner` → `options`:

| Option | Values | Default |
| --- | --- | --- |
| `autoOpen` | `off`: the panel opens only from `×N` or `/crew`. `savvy`: also when a `savvy-*` worker starts or a plan is reported. `any`: also once per session when any subagent starts | `off` |
| `finished` | `show` or `hide` finished agents in the panel | `show` |
| `language` | `auto`, `en`, `ru`, `he` (Hebrew draws right to left) | `auto` |

If you also use the original savvy-progress, keep only one of the two: both draw a band and a panel.

Install: see the [repository README](../../README.md).

# AGENTS

Rules for any coding agent (Claude Code, Codex, Cursor, Antigravity) working in this repository. `CLAUDE.md` is the full rule set; read it first.

- Stage: released (v0.13.0), built and bundled for macOS, Windows and Linux. `./formtools agents sync` mirrors `.claude/skills` into `.agents/skills`; `./formtools agents check` (also in CI) fails on drift. The plan of record is `DEV_PLAN.md` in the planning sidecar. Code changes route through `.claude/skills/formtools-harness`; using the app through MCP routes through `.claude/skills/formtools-driving`.
- You are an outside agent to the running app. Tools that only read always work. Any other tool (including the ones behind `./formtools cli convert`, `resize` and `rename --apply`) is asked about in the formtools window (Deny, Allow once, Always allow) unless the person chose Allowed in Settings, Integration, Outside agents, and is refused under Blocked or when no window is open to ask. Only the window can change that choice: when a call is refused, tell the person what the refusal says and stop. `agents/manifest.json` lists every tool and which ones ask.
- Research lives in `docs/encyclopedia/` (start at `INDEX.md`). Paraphrase only; every page keeps its Sources list.
- Before adding a dependency, check `docs/encyclopedia/engines/engine-licensing-matrix.md` and add a `NOTICE.md` row in the same commit.
- Edits are surgical and hand-made. No emoji. No em dash in Markdown. Versions are `v*.*.*`.
- Commits: author and committer `nodemode-ai <mackin@nodemode.ai>`, no attribution trailers of any kind.

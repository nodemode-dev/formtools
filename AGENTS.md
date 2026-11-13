# AGENTS

Rules for any coding agent (Claude Code, Codex, Cursor) working in this repository. `CLAUDE.md` is the full rule set; read it first.

- Stage: alpha (v0.6.4). `./formtools agents sync` mirrors `.claude/skills` into `.agents/skills`; `./formtools agents check` (also in CI) fails on drift. The plan of record is `DEV_PLAN.md` in the planning sidecar. Code changes route through `.claude/skills/formtools-harness`; using the app through MCP routes through `.claude/skills/formtools-driving`.
- Research lives in `docs/encyclopedia/` (start at `INDEX.md`). Paraphrase only; every page keeps its Sources list.
- Before adding a dependency, check `docs/encyclopedia/engines/engine-licensing-matrix.md` and add a `NOTICE.md` row in the same commit.
- Edits are surgical and hand-made. No emoji. No em dash in Markdown. Versions are `v*.*.*`.
- Commits: author and committer `nodemode-ai <mackin@nodemode.ai>`, no attribution trailers of any kind.

---
name: terminal-operator
description: Terminals, pseudo-terminals, Claude Code, the Chat tab, the window bridge and child processes in formtools. Use when changing the terminal dock (xterm in the window, PTYs in the engine), the Claude Code tabs or the Chat and its stream, the /api/live bridge that runs commands for agents, the in-app token on /mcp, or the window-only command list. Lists the real files and the rules process code must follow.
---

# terminal-operator

formtools has a terminal dock with shell, Claude Code and Chat tabs, ported from formvis with formlit's engine choices. The engine owns every process; the window only draws and sends keys.

## What exists

| Where | What it does |
| --- | --- |
| `backend/app/services/terminal.py`, `routers/terminal.py` | PTY sessions (`ptyprocess`, `pywinpty` on Windows, imported softly) with a 256 KB scrollback, resize, restart and close under `/api/terminal`; output on the WebSocket `/api/terminal/{id}/stream` (text frames are output, a binary frame is `{"type": "exit"}`; the window sends `input` and `resize`). Loopback Host and Origin, at most 24 sockets. A new shell starts in the home folder with `FORMTOOLS_TERMINAL`, `FORMTOOLS_ENGINE_URL` and `FORMTOOLS_MCP_URL` set |
| `backend/app/services/claude_code.py`, `routers/claude_code.py` | Finds `claude` (`FORMTOOLS_CLAUDE_BIN`, PATH, the usual install folders, the login shell). `POST /api/terminal/claude` opens a Claude Code tab with `--mcp-config` for this engine's own port and `--allowedTools mcp__formtools`; the Chat runs Claude Code in stream-JSON under `/api/agent/claude/{status,start,send,stop,permission}` and `/api/agent/claude/stream`; `/api/claude-code/status` reports the tab. Both work in `<data>/Agent` or `FORMTOOLS_AGENT_DIR` |
| `backend/app/services/agents.py` | `INAPP_TOKEN`, new each run. It reaches Claude Code only as `FORMTOOLS_INAPP_TOKEN` in the child's environment, expanded into the `x-formtools-inapp` header; never in argv. `routers/mcp.py` names such a caller "Claude Code in formtools" |
| `backend/app/services/bridge.py`, `routers/live.py` | The window attaches to `/api/live`; `run_command` sends `{"t": "run", "id", "command", "params"}` and waits up to 60 seconds for `{"t": "result", "id", "ok", "result" or "error"}`. `POST /api/commands/catalogue` holds the window's mirrored commands for `list_commands` and `describe_command` |
| `backend/app/routers/mcp.py` | `WINDOW_ONLY`: `terminal-toggle`, `terminal-new`, `claude-code`, `claude-chat` are refused to every agent; `frontend/src/automation/bridge.ts` refuses the same set |
| `backend/app/main.py` | Binds the event loop for the PTY pumps at start; stops the Chat and closes every terminal at shutdown |
| `frontend/src/ui/terminal-dock.ts`, `ui/chat-pane.ts`, `io/api.ts` | The dock, its tabs and the Chat pane, speaking the routes above |

## Rules for terminal and process code

1. Process control belongs to the engine, never to page code. The page talks to the engine through `frontend/src/io/api.ts`.
2. A PTY endpoint runs code on this computer: every route and socket keeps the loopback Host and Origin checks, and the engine binds 127.0.0.1 only behind `core/guard.py`.
3. Every child ends when the dock closes it or the engine stops; never leave orphans.
4. Windows uses ConPTY through pywinpty; `setup/freeze_backend.bat` collects `winpty`, `setup/freeze_backend` adds `ptyprocess`.
5. The in-app token stays out of argv and logs. Nothing reads or stores a Claude Code sign-in.
6. A new dock command that starts a process is added to `WINDOW_ONLY` on both sides.
7. Record the change in `backend/HASHOUT_LOG.md` or `frontend/HASHOUT_LOG.md`, and update this table with any new file.

## Do not

- Do not shell out from a request handler with `shell=True` or an unvalidated string.
- Do not auto-approve a Chat permission request on the person's behalf.

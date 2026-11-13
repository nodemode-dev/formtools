---
name: terminal
description: Terminals, shells and Claude Code in relation to formtools when an agent is driving it. Use when the person asks for a terminal inside formtools, to run a shell command from formtools, to have formtools start Claude Code or the Chat, or how to start or reconnect formtools so the MCP tools work. formtools has a terminal dock for the person but no MCP terminal tool; this says what an agent can and cannot do there and what to ask the person to run.
---

# terminal

The formtools window has a terminal dock above the status bar for the person: shell tabs, Claude Code tabs and a Chat tab, opened with the title bar buttons or the View commands Terminal (Mod+J), New Terminal, Claude Code (Mod+Shift+J) and Chat with Claude (Mod+Alt+J). The engine owns every process in it. These four commands are window-only: `run_command` refuses `terminal-toggle`, `terminal-new`, `claude-code` and `claude-chat` for every agent, and `list_commands` does not offer them. Do not claim to run shell commands "inside formtools".

## When you are the Claude Code in the dock

A Claude Code tab or the Chat tab started by formtools runs the person's own `claude` with formtools' MCP server already attached (`mcp__formtools`) and works in formtools' `Agent` folder in its data folder. The window's own tab is recognised by a per-run token, so `/api/mcp/status` lists it as "Claude Code in formtools". Use the tools as in the main skill: absolute paths, `fs_list` first, plan before writing.

## What the person may need to run

Commands for the person to run in the formtools folder, or for you to run in your own shell only when you have one and the person asked.

| Goal | Command |
| --- | --- |
| Start formtools (engine and window) for development | `./formtools boot` |
| Check the machine is ready | `./formtools doctor` |
| Connect Claude Code, Codex and Cursor for this user account | `./formtools agents install` (add `--dry-run` first to see what it would change) |
| Run the MCP server as a client does (stdio) | `./formtools mcp` (starts the engine if none is running) |
| Windows | the same commands through `formtools.bat` |

Inside the formtools repository `.mcp.json`, `.cursor/mcp.json` and `.codex/config.toml` already run `./formtools mcp`. `GET http://127.0.0.1:8240/api/mcp/status` reports whether a window is attached, the protocol versions, the tool count and the clients seen since the engine started.

## Reconnect checklist

1. Call `fs_list` on the home folder. If it answers, the connection is fine.
2. `run_command` says no formtools window is open: ask the person to open formtools; the file tools still work without it.
3. No formtools tools at all: the server is not registered in this client. Ask the person to run `./formtools agents install`, then restart the client.
4. The window did not answer in time: it is busy; wait and retry once.

## What to say when asked for more

- A shell or Claude Code inside formtools: the dock is the person's; point them to Terminal or Claude Code in the View menu and do the file task yourself with the tools.
- Changing how the dock works is a development task: use `formtools-harness`.

# MCP setup

claude-chan exposes a local MCP server (claude-chan-mcp) plus a WebSocket hub that browser pages connect to.

## Start


npm run build:server
node server/dist/cli.js


Environment:

| Variable | Default | Meaning |
|---|---|---|
| CLAUDE_CHAN_TOKEN | random per start | Shared token for hub and HTTP, at least 16 characters. Printed to stderr only when generated. |
| CLAUDE_CHAN_PORT | 8765 | WebSocket hub port (loopback only). |
| CLAUDE_CHAN_HTTP_PORT | unset | Also serve streamable HTTP at http://127.0.0.1:<port>/mcp (Bearer token). |

Flag --http-only skips stdio (requires CLAUDE_CHAN_HTTP_PORT).
stdout carries the MCP protocol; all logs go to stderr.

## .mcp.json (stdio)

json
{
 "mcpServers": {
 "claude-chan": {
 "command": "node",
 "args": ["server/dist/cli.js"],
 "env": { "CLAUDE_CHAN_TOKEN": "change-me-to-a-long-random-token", "CLAUDE_CHAN_PORT": "8765" }
 }
 }
}


## .mcp.json (HTTP)

json
{
 "mcpServers": {
 "claude-chan": {
 "type": "http",
 "url": "http://127.0.0.1:8766/mcp",
 "headers": { "Authorization": "Bearer change-me-to-a-long-random-token" }
 }
 }
}


Start the server with CLAUDE_CHAN_HTTP_PORT=8766 CLAUDE_CHAN_TOKEN=change-me-to-a-long-random-token node server/dist/cli.js --http-only.

## Tools

- claude_chan_act: play a motion/expression (see schema/claude_chan_act.json).
- claude_chan_say: show a speech bubble.
- claude_chan_set_mood: set the idle mood.
- claude_chan_set_state: report the agent state (idle, listening, thinking, working, waiting, speaking, success, error, sleeping); the mascot picks motion, expression and mood.
- claude_chan_list_motions: list available motions.

## System prompt snippet


You have a mascot, Claude-chan, driven by the claude_chan_* tools.
Call claude_chan_act briefly when starting, finishing or failing a task.
Use claude_chan_say for short messages (one sentence). Do not spam; skip it when idle.


## Security

The hub binds to loopback, requires the token, checks the Origin header, rate-limits and bounds message sizes. Keep the token out of shared configs.
